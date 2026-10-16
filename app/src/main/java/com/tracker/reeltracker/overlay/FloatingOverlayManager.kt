package com.tracker.reeltracker.overlay

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.provider.Settings
import android.view.*
import android.widget.TextView
import com.tracker.reeltracker.R

class FloatingOverlayManager(private val context: Context) {

    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var overlayView: View? = null
    private var params: WindowManager.LayoutParams? = null

    private var emojiTextView: TextView? = null
    private var countTextView: TextView? = null
    private var isVisible = false

    init {
        setupOverlayLayout()
    }

    private fun setupOverlayLayout() {
        if (!Settings.canDrawOverlays(context)) return

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 40
            y = 200
        }

        val inflater = LayoutInflater.from(context)
        overlayView = inflater.inflate(R.layout.layout_floating_pill, null)

        emojiTextView = overlayView?.findViewById(R.id.tv_reaction_emoji)
        countTextView = overlayView?.findViewById(R.id.tv_reel_count)

        attachTouchListener()
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun attachTouchListener() {
        val view = overlayView ?: return

        view.setOnTouchListener(object : View.OnTouchListener {
            private var initialX = 0
            private var initialY = 0
            private var initialTouchX = 0f
            private var initialTouchY = 0f

            override fun onTouch(v: View, event: MotionEvent): Boolean {
                val p = params ?: return false

                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = p.x
                        initialY = p.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        return true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        p.x = initialX + (event.rawX - initialTouchX).toInt()
                        p.y = initialY + (event.rawY - initialTouchY).toInt()
                        windowManager.updateViewLayout(view, p)
                        return true
                    }
                    MotionEvent.ACTION_UP -> {
                        snapToEdge(p)
                        return true
                    }
                }
                return false
            }
        })
    }

    private fun snapToEdge(p: WindowManager.LayoutParams) {
        val displayMetrics = context.resources.displayMetrics
        val screenWidth = displayMetrics.widthPixels

        p.x = if (p.x + (overlayView?.width ?: 0) / 2 < screenWidth / 2) {
            24
        } else {
            screenWidth - (overlayView?.width ?: 200) - 24
        }
        overlayView?.let { windowManager.updateViewLayout(it, p) }
    }

    fun showOverlay(currentCount: Int) {
        if (isVisible) {
            updateCounter(currentCount)
            return
        }

        if (overlayView != null && params != null && Settings.canDrawOverlays(context)) {
            try {
                windowManager.addView(overlayView, params)
                isVisible = true
                updateCounter(currentCount)
            } catch (e: Exception) {
                // Ignore if view cannot be added
            }
        }
    }

    fun hideOverlay() {
        if (!isVisible) return

        if (overlayView != null && isVisible) {
            try {
                windowManager.removeView(overlayView)
                isVisible = false
            } catch (e: Exception) {
                // Ignore if view cannot be removed
            }
        }
    }

    fun updateCounter(count: Int) {
        countTextView?.text = "Total: #$count"
        emojiTextView?.text = getBrainrotReactionEmoji(count)
    }

    private fun getBrainrotReactionEmoji(count: Int): String {
        return when {
            count == 0 -> "🌱"
            count in 1..5 -> "🙂"
            count in 6..15 -> "🤨"
            count in 16..25 -> "🫠"
            count in 26..40 -> "💀"
            count in 41..60 -> "🧟"
            else -> "🧠💥"
        }
    }

    fun destroy() {
        hideOverlay()
        overlayView = null
    }
}
