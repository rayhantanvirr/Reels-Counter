package com.tracker.reeltracker.service

import android.accessibilityservice.AccessibilityService
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.tracker.reeltracker.data.database.AppDatabase
import com.tracker.reeltracker.data.database.PlatformType
import com.tracker.reeltracker.data.database.ReelUsageEntity
import com.tracker.reeltracker.data.repository.ReelRepository
import com.tracker.reeltracker.detection.ReelDetector
import com.tracker.reeltracker.overlay.FloatingOverlayManager
import kotlinx.coroutines.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class ReelAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "ReelAccessService"
        const val DWELL_THRESHOLD_MS = 1500L
        
        const val PKG_INSTAGRAM = "com.instagram.android"
        const val PKG_TIKTOK = "com.zhiliaoapp.musically"
        const val PKG_TIKTOK_ALT = "com.ss.android.ugc.trill"
        const val PKG_YOUTUBE = "com.google.android.youtube"
        const val PKG_FACEBOOK = "com.facebook.katana"
    }

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private lateinit var detector: ReelDetector
    private lateinit var repository: ReelRepository
    private lateinit var overlayManager: FloatingOverlayManager

    private var dwellJob: Job? = null
    private var currentActivePlatform: PlatformType? = null
    private var currentVideoHash: Int? = null
    private var videoStartTimeMs: Long = 0L
    private var isCurrentlyDwelling = false
    private var activeEntityId: Long? = null

    private var sessionCount = 0

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "ReelAccessibilityService initialized")
        val dao = AppDatabase.getInstance(applicationContext).reelUsageDao()
        repository = ReelRepository(dao)
        detector = ReelDetector()
        overlayManager = FloatingOverlayManager(applicationContext)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        val packageName = event.packageName?.toString() ?: return

        val platform = detector.resolvePlatform(packageName)
        if (platform == null) {
            handleAppExited()
            return
        }

        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                evaluateWindowContent(platform, isNewWindow = true)
            }
            AccessibilityEvent.TYPE_VIEW_SCROLLED -> {
                evaluateWindowContent(platform, isNewWindow = false)
            }
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
                evaluateWindowContent(platform, isNewWindow = false)
            }
        }
    }

    private fun evaluateWindowContent(platform: PlatformType, isNewWindow: Boolean) {
        val rootNode = rootInActiveWindow ?: return

        try {
            val detectionResult = detector.detectReelContainer(platform, rootNode)

            if (detectionResult.isReel) {
                overlayManager.showOverlay(sessionCount)

                val newVideoHash = detectionResult.uniqueVideoSignature.hashCode()
                if (newVideoHash != currentVideoHash || isNewWindow) {
                    onVideoScrolledOrChanged(platform, newVideoHash, detectionResult.creatorTag, detectionResult.audioTitle)
                }
            } else {
                handleReelExited()
            }
        } finally {
            rootNode.recycle()
        }
    }

    private fun onVideoScrolledOrChanged(
        platform: PlatformType,
        videoHash: Int,
        creatorTag: String?,
        audioTitle: String?
    ) {
        finalizePreviousVideoDwell()
        dwellJob?.cancel()

        currentActivePlatform = platform
        currentVideoHash = videoHash
        videoStartTimeMs = SystemClock.elapsedRealtime()
        isCurrentlyDwelling = true

        dwellJob = serviceScope.launch {
            delay(DWELL_THRESHOLD_MS)

            isCurrentlyDwelling = false
            sessionCount++

            val now = System.currentTimeMillis()
            val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            val dateStr = dateFormat.format(Date(now))

            val newEntity = ReelUsageEntity(
                platform = platform,
                timestamp = now,
                dwellTimeMs = DWELL_THRESHOLD_MS,
                dateString = dateStr,
                creatorTag = creatorTag,
                audioTitle = audioTitle
            )

            val insertedId = repository.insertReelRecord(newEntity)
            activeEntityId = insertedId

            withContext(Dispatchers.Main) {
                overlayManager.updateCounter(sessionCount)
            }

            Log.d(TAG, "Reel counted on $platform (#$sessionCount, ID: $insertedId)")
        }
    }

    private fun finalizePreviousVideoDwell() {
        val entityId = activeEntityId
        if (entityId != null && videoStartTimeMs > 0L) {
            val totalWatchedMs = SystemClock.elapsedRealtime() - videoStartTimeMs
            if (totalWatchedMs >= DWELL_THRESHOLD_MS) {
                serviceScope.launch {
                    repository.updateDwellDuration(entityId, totalWatchedMs)
                }
            }
            activeEntityId = null
        }
    }

    private fun handleReelExited() {
        dwellJob?.cancel()
        finalizePreviousVideoDwell()
        isCurrentlyDwelling = false
        currentVideoHash = null
        overlayManager.hideOverlay()
    }

    private fun handleAppExited() {
        dwellJob?.cancel()
        finalizePreviousVideoDwell()
        currentActivePlatform = null
        currentVideoHash = null
        overlayManager.hideOverlay()
    }

    override fun onInterrupt() {
        handleAppExited()
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        overlayManager.destroy()
    }
}
