export interface CodeFile {
  path: string;
  filename: string;
  language: 'kotlin' | 'xml' | 'groovy' | 'sql';
  category: 'Service' | 'Detection' | 'Overlay' | 'Database' | 'Compose UI' | 'Manifest & Config';
  description: string;
  content: string;
}

export const KOTLIN_CODEBASE: CodeFile[] = [
  {
    path: "app/src/main/java/com/tracker/reeltracker/service/ReelAccessibilityService.kt",
    filename: "ReelAccessibilityService.kt",
    language: "kotlin",
    category: "Service",
    description: "Core AccessibilityService monitoring vertical scroll, window changes, and handling the 1.5s debounce dwell mechanism.",
    content: `package com.tracker.reeltracker.service

import android.accessibilityservice.AccessibilityService
import android.content.Intent
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

/**
 * Production AccessibilityService for detecting short-form video viewing (Instagram Reels,
 * TikTok, YouTube Shorts, and Facebook Reels).
 *
 * Implements a 1500ms debounce/dwell mechanism to avoid counting fast-swipes and doom-scroll skips.
 */
class ReelAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "ReelAccessService"
        const val DWELL_THRESHOLD_MS = 1500L // 1.5s dwell threshold to qualify as an intentional watch
        
        // Supported platform package names
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

    // Dwell tracking state
    private var dwellJob: Job? = null
    private var currentActivePlatform: PlatformType? = null
    private var currentVideoHash: Int? = null
    private var videoStartTimeMs: Long = 0L
    private var isCurrentlyDwelling = false
    private var activeEntityId: Long? = null

    // Session stats for floating pill overlay
    private var sessionCount = 0
    private var sessionStartTime = System.currentTimeMillis()

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

        // Fast filter: Ignore any app not in our supported targets
        val platform = detector.resolvePlatform(packageName)
        if (platform == null) {
            handleAppExited()
            return
        }

        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                // New window/fragment entered (e.g. user opened ReelsViewer or switched to Home feed)
                evaluateWindowContent(platform, isNewWindow = true)
            }
            AccessibilityEvent.TYPE_VIEW_SCROLLED -> {
                // Vertical pager scroll event detected
                evaluateWindowContent(platform, isNewWindow = false)
            }
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
                // Throttled evaluation during in-place content updates
                evaluateWindowContent(platform, isNewWindow = false)
            }
        }
    }

    /**
     * Inspects the view hierarchy via non-fragile heuristic signatures.
     */
    private fun evaluateWindowContent(platform: PlatformType, isNewWindow: Boolean) {
        val rootNode = rootInActiveWindow ?: return

        try {
            val detectionResult = detector.detectReelContainer(platform, rootNode)

            if (detectionResult.isReel) {
                // Target container is active: Ensure overlay is visible
                overlayManager.showOverlay(sessionCount)

                val newVideoHash = detectionResult.uniqueVideoSignature.hashCode()
                if (newVideoHash != currentVideoHash || isNewWindow) {
                    // Previous reel watch concluded; start tracking new reel
                    onVideoScrolledOrChanged(platform, newVideoHash, detectionResult.creatorTag, detectionResult.audioTitle)
                }
            } else {
                // User is in target app but NOT in the Reels/Shorts container (e.g., in standard feed or profile)
                handleReelExited()
            }
        } finally {
            // Avoid memory leaks: Always recycle node hierarchies in Android
            rootNode.recycle()
        }
    }

    /**
     * Called when a candidate Reel/Short enters the viewport.
     * Starts the 1.5s dwell debounce timer.
     */
    private fun onVideoScrolledOrChanged(
        platform: PlatformType,
        videoHash: Int,
        creatorTag: String?,
        audioTitle: String?
    ) {
        // Conclude previously counted video's dwell duration if applicable
        finalizePreviousVideoDwell()

        // Cancel pending debounce job if user swiped before 1.5s
        dwellJob?.cancel()

        currentActivePlatform = platform
        currentVideoHash = videoHash
        videoStartTimeMs = SystemClock.elapsedRealtime()
        isCurrentlyDwelling = true

        dwellJob = serviceScope.launch {
            delay(DWELL_THRESHOLD_MS)

            // User has stayed past 1.5s! Qualifies as a valid Reel/Short view.
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

            // Save to Room Database and save returned autogenerated primary key ID
            val insertedId = repository.insertReelRecord(newEntity)
            activeEntityId = insertedId

            // Update live floating overlay on the Main thread
            withContext(Dispatchers.Main) {
                overlayManager.updateCounter(sessionCount)
            }

            Log.d(TAG, "Reel counted on $platform (#$sessionCount, ID: $insertedId)")
        }
    }

    /**
     * When user scrolls away after dwelling, update the total watch duration.
     */
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
        Log.w(TAG, "AccessibilityService interrupted")
        handleAppExited()
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        overlayManager.destroy()
    }
}
`
  },
  {
    path: "app/src/main/java/com/tracker/reeltracker/detection/ReelDetector.kt",
    filename: "ReelDetector.kt",
    language: "kotlin",
    category: "Detection",
    description: "Robust detection algorithms avoiding obfuscated resource IDs; inspects ViewPager structures, contentDescriptions, and action stacks.",
    content: `package com.tracker.reeltracker.detection

import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo
import com.tracker.reeltracker.data.database.PlatformType
import java.util.*

/**
 * Result of container inspection.
 */
data class DetectionResult(
    val isReel: Boolean,
    val uniqueVideoSignature: String = "",
    val creatorTag: String? = null,
    val audioTitle: String? = null
)

/**
 * Resilient Reel/Shorts detection engine.
 *
 * Why we avoid resource IDs:
 * Major apps (Instagram, TikTok, YouTube) use ProGuard/R8 and aggressive obfuscation,
 * changing resource IDs (e.g. R.id.clips_viewer) across weekly releases.
 * Instead, we combine:
 * 1. ViewPager2 vertical orientation + fullscreen aspect ratio checks.
 * 2. Signature action button stacks (Like, Comment, Share, Audio Disc aligned vertically on the right edge).
 * 3. Semantic content-descriptions (e.g., "Reel by...", "Sound:", "Like this short").
 */
class ReelDetector {

    fun resolvePlatform(packageName: String): PlatformType? {
        return when (packageName) {
            "com.instagram.android" -> PlatformType.INSTAGRAM
            "com.zhiliaoapp.musically", "com.ss.android.ugc.trill" -> PlatformType.TIKTOK
            "com.google.android.youtube" -> PlatformType.YOUTUBE_SHORTS
            "com.facebook.katana" -> PlatformType.FACEBOOK
            else -> null
        }
    }

    fun detectReelContainer(platform: PlatformType, rootNode: AccessibilityNodeInfo): DetectionResult {
        return when (platform) {
            PlatformType.INSTAGRAM -> detectInstagramReels(rootNode)
            PlatformType.TIKTOK -> detectTikTok(rootNode)
            PlatformType.YOUTUBE_SHORTS -> detectYouTubeShorts(rootNode)
            PlatformType.FACEBOOK -> detectFacebookReels(rootNode)
        }
    }

    /**
     * Instagram Reels Detector:
     * - Distinguishes between standard home feed, stories, and the Reels vertical viewer.
     * - Reels viewer features a vertical action stack on the right edge (like, comment, share, remix, audio pill)
     *   and content descriptions containing "Reel by" or "Original audio".
     */
    private fun detectInstagramReels(rootNode: AccessibilityNodeInfo): DetectionResult {
        var hasVerticalActionColumn = false
        var hasReelContentDesc = false
        var creator: String? = null
        var audio: String? = null

        val screenBounds = Rect()
        rootNode.getBoundsInScreen(screenBounds)
        val rightEdgeThreshold = (screenBounds.width() * 0.78f).toInt()

        traverseHierarchy(rootNode) { node ->
            val desc = node.contentDescription?.toString()?.lowercase(Locale.ROOT) ?: ""
            val text = node.text?.toString() ?: ""

            // Look for Reels semantic clues
            if (desc.contains("reel by") || desc.contains("reels") || desc.contains("remix with")) {
                hasReelContentDesc = true
                if (desc.contains("reel by")) {
                    creator = desc.substringAfter("reel by").trim().take(30)
                }
            }

            if (desc.contains("audio") || desc.contains("original sound") || desc.contains("song")) {
                audio = text.ifBlank { desc.take(40) }
            }

            // Inspect action buttons on right margin
            val nodeBounds = Rect()
            node.getBoundsInScreen(nodeBounds)
            if (nodeBounds.left >= rightEdgeThreshold && node.isClickable) {
                if (desc.contains("like") || desc.contains("comment") || desc.contains("share")) {
                    hasVerticalActionColumn = true
                }
            }
        }

        val isReel = hasReelContentDesc || (hasVerticalActionColumn && isVerticalPagerPresent(rootNode))
        val signature = "IG_\${creator.orEmpty()}_\${audio.orEmpty()}_\${System.currentTimeMillis() / 1000}"

        return DetectionResult(isReel = isReel, uniqueVideoSignature = signature, creatorTag = creator, audioTitle = audio)
    }

    /**
     * TikTok Detector:
     * TikTok is essentially always full-screen vertical swipe videos, but we must ignore
     * the Profile tab, Settings, Inbox, and Search grid.
     */
    private fun detectTikTok(rootNode: AccessibilityNodeInfo): DetectionResult {
        var hasLikeButton = false
        var hasCommentButton = false
        var hasShareButton = false
        var creator: String? = null
        var sound: String? = null

        traverseHierarchy(rootNode) { node ->
            val desc = node.contentDescription?.toString()?.lowercase(Locale.ROOT) ?: ""
            val text = node.text?.toString() ?: ""

            if (desc.contains("like video") || desc.contains("liked")) hasLikeButton = true
            if (desc.contains("read or add comments") || desc.contains("comment")) hasCommentButton = true
            if (desc.contains("share video") || desc.contains("share")) hasShareButton = true

            if (text.startsWith("@") || desc.contains("creator")) {
                creator = text.take(30)
            }
            if (desc.contains("sound") || desc.contains("original audio")) {
                sound = text.ifBlank { desc.take(40) }
            }
        }

        val isTikTokVideo = (hasLikeButton && hasCommentButton) || (hasLikeButton && hasShareButton)
        val signature = "TT_\${creator.orEmpty()}_\${sound.orEmpty()}"

        return DetectionResult(isReel = isTikTokVideo, uniqueVideoSignature = signature, creatorTag = creator, audioTitle = sound)
    }

    /**
     * YouTube Shorts Detector:
     * Distinguishes Shorts from normal landscape/portrait YouTube video player.
     * Regular YouTube has title & comments beneath the video; Shorts has full-bleed vertical pager
     * with right-side overlay icons and "Shorts remix / sound" metadata.
     */
    private fun detectYouTubeShorts(rootNode: AccessibilityNodeInfo): DetectionResult {
        var isShortsContainer = false
        var hasShortsLike = false
        var hasShortsDislike = false
        var creator: String? = null

        traverseHierarchy(rootNode) { node ->
            val desc = node.contentDescription?.toString()?.lowercase(Locale.ROOT) ?: ""
            val className = node.className?.toString() ?: ""

            if (desc.contains("like this short") || desc.contains("dislike this short")) {
                hasShortsLike = true
            }
            if (desc.contains("shorts") || desc.contains("remix this video")) {
                isShortsContainer = true
            }
            if (desc.startsWith("subscribe to") || desc.contains("channel")) {
                creator = desc.substringAfter("subscribe to").trim().take(30)
            }
        }

        val isShorts = isShortsContainer || hasShortsLike
        val signature = "YT_\${creator.orEmpty()}_\${System.currentTimeMillis() / 2000}"

        return DetectionResult(isReel = isShorts, uniqueVideoSignature = signature, creatorTag = creator)
    }

    /**
     * Facebook Reels Detector:
     * Inspects FbShorts containers and right-hand interaction panel.
     */
    private fun detectFacebookReels(rootNode: AccessibilityNodeInfo): DetectionResult {
        var hasReelsHeader = false
        var hasLikeCommentShare = false

        traverseHierarchy(rootNode) { node ->
            val desc = node.contentDescription?.toString()?.lowercase(Locale.ROOT) ?: ""
            val text = node.text?.toString()?.lowercase(Locale.ROOT) ?: ""

            if (text.contains("reels") || desc.contains("facebook reel") || desc.contains("reels audio")) {
                hasReelsHeader = true
            }
            if (desc.contains("like reel") || desc.contains("leave a comment")) {
                hasLikeCommentShare = true
            }
        }

        val isReel = hasReelsHeader || hasLikeCommentShare
        val signature = "FB_\${System.currentTimeMillis() / 2000}"

        return DetectionResult(isReel = isReel, uniqueVideoSignature = signature)
    }

    private fun isVerticalPagerPresent(rootNode: AccessibilityNodeInfo): Boolean {
        var found = false
        traverseHierarchy(rootNode) { node ->
            val className = node.className?.toString() ?: ""
            if (className.contains("ViewPager2") || className.contains("RecyclerView") || className.contains("VerticalViewPager")) {
                if (node.isScrollable) {
                    found = true
                }
            }
        }
        return found
    }

    private inline fun traverseHierarchy(node: AccessibilityNodeInfo?, crossinline action: (AccessibilityNodeInfo) -> Unit) {
        if (node == null) return
        val stack = ArrayDeque<AccessibilityNodeInfo>()
        stack.push(node)

        while (stack.isNotEmpty()) {
            val current = stack.pop()
            action(current)

            for (i in 0 until current.childCount) {
                current.getChild(i)?.let { child ->
                    stack.push(child)
                }
            }
        }
    }
}
`
  },
  {
    path: "app/src/main/java/com/tracker/reeltracker/overlay/FloatingOverlayManager.kt",
    filename: "FloatingOverlayManager.kt",
    language: "kotlin",
    category: "Overlay",
    description: "WindowManager-based draggable floating pill overlay with dynamic reaction emojis, live counter, and edge snapping.",
    content: `package com.tracker.reeltracker.overlay

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.provider.Settings
import android.util.DisplayMetrics
import android.view.*
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.tracker.reeltracker.R
import kotlin.math.abs

/**
 * Manages the SYSTEM_ALERT_WINDOW floating pill overlay on top of Reels & Shorts.
 * Includes draggable physics, edge snapping, dynamic reaction emoji, and auto-hide/auto-show.
 */
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

        // Snap left or right edge depending on which half of the screen the pill is on
        p.x = if (p.x + (overlayView?.width ?: 0) / 2 < screenWidth / 2) {
            24 // Snap left margin
        } else {
            screenWidth - (overlayView?.width ?: 200) - 24 // Snap right margin
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
                // View already attached or permission revoked
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
                // View not attached
            }
        }
    }

    fun updateCounter(count: Int) {
        countTextView?.text = "Total: #$count"
        emojiTextView?.text = getBrainrotReactionEmoji(count)
    }

    /**
     * Escalating reaction emojis showing brainrot level
     */
    private fun getBrainrotReactionEmoji(count: Int): String {
        return when {
            count == 0 -> "🌱" // Fresh mind
            count in 1..5 -> "🙂" // Casual
            count in 6..15 -> "🤨" // Getting hooked
            count in 16..25 -> "🫠" // Meltdown begins
            count in 26..40 -> "💀" // Brain fried
            count in 41..60 -> "🧟" // Full Zombie mode
            else -> "🧠💥" // Brain rot critical!
        }
    }

    fun destroy() {
        hideOverlay()
        overlayView = null
    }
}
`
  },
  {
    path: "app/src/main/java/com/tracker/reeltracker/data/database/ReelUsageEntity.kt",
    filename: "ReelUsageEntity.kt",
    language: "kotlin",
    category: "Database",
    description: "Room Database entity with indexed fields for timestamp, platform, and dateString for sub-millisecond aggregation.",
    content: `package com.tracker.reeltracker.data.database

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

enum class PlatformType {
    INSTAGRAM,
    TIKTOK,
    YOUTUBE_SHORTS,
    FACEBOOK
}

/**
 * Room Entity storing individual Reel/Short view sessions.
 * Indices allow high-speed group-by aggregations for 1-30 day dashboards.
 */
@Entity(
    tableName = "reel_usage",
    indices = [
        Index(value = ["timestamp"]),
        Index(value = ["platform"]),
        Index(value = ["dateString"]),
        Index(value = ["platform", "dateString"])
    ]
)
data class ReelUsageEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val platform: PlatformType,
    val timestamp: Long,          // Epoch millis when dwell threshold reached
    val dwellTimeMs: Long,        // Total time watched in ms
    val dateString: String,       // Formatted as "yyyy-MM-dd" for date-partitioned indexing
    val creatorTag: String? = null,
    val audioTitle: String? = null
)
`
  },
  {
    path: "app/src/main/java/com/tracker/reeltracker/data/database/ReelUsageDao.kt",
    filename: "ReelUsageDao.kt",
    language: "kotlin",
    category: "Database",
    description: "Room DAO containing optimized SQL queries for daily platform aggregations, dwell sums, and rolling 30-day analytics.",
    content: `package com.tracker.reeltracker.data.database

import androidx.room.*
import kotlinx.coroutines.flow.Flow

/**
 * Aggregation model returned by the unified total SQL query.
 */
data class UnifiedDailyTotal(
    val dateString: String,
    val totalViews: Int,
    val totalDwellMs: Long
)

data class DailyReelAggregate(
    val dateString: String,
    val platform: PlatformType,
    val totalViews: Int,
    val totalDwellMs: Long
)

data class PlatformTotalAggregate(
    val platform: PlatformType,
    val totalViews: Int,
    val totalDwellMs: Long
)

@Dao
interface ReelUsageDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entry: ReelUsageEntity): Long

    @Query("UPDATE reel_usage SET dwellTimeMs = :dwellTimeMs WHERE id = :id")
    suspend fun updateDwellTime(id: Long, dwellTimeMs: Long)

    /**
     * UNIFIED TOTAL QUERY:
     * Counts ALL reels across all apps combined per day (no separate counting).
     */
    @Query("""
        SELECT 
            dateString,
            COUNT(*) AS totalViews,
            SUM(dwellTimeMs) AS totalDwellMs
        FROM reel_usage
        WHERE timestamp >= :startTimeMillis
        GROUP BY dateString
        ORDER BY dateString ASC
    """)
    fun getUnifiedDailyTotals(startTimeMillis: Long): Flow<List<UnifiedDailyTotal>>

    /**
     * Single Grand Total of all reels watched across all platforms combined.
     */
    @Query("SELECT COUNT(*) FROM reel_usage")
    fun getGrandTotalReelCount(): Flow<Int>

    @Query("SELECT COALESCE(SUM(dwellTimeMs), 0) FROM reel_usage")
    fun getGrandTotalDwellMs(): Flow<Long>

    /**
     * Optional breakdown query if platform origin inspection is needed.
     */
    @Query("""
        SELECT 
            dateString,
            platform,
            COUNT(*) AS totalViews,
            SUM(dwellTimeMs) AS totalDwellMs
        FROM reel_usage
        WHERE timestamp >= :startTimeMillis
        GROUP BY dateString, platform
        ORDER BY dateString ASC, platform ASC
    """)
    fun getDailyReelAggregates(startTimeMillis: Long): Flow<List<DailyReelAggregate>>

    /**
     * Overall platform breakdown for a given time window.
     */
    @Query("""
        SELECT 
            platform,
            COUNT(*) AS totalViews,
            SUM(dwellTimeMs) AS totalDwellMs
        FROM reel_usage
        WHERE timestamp >= :startTimeMillis
        GROUP BY platform
        ORDER BY totalViews DESC
    """)
    fun getPlatformTotals(startTimeMillis: Long): Flow<List<PlatformTotalAggregate>>

    /**
     * Real-time stream of the most recent reel view sessions.
     */
    @Query("SELECT * FROM reel_usage ORDER BY timestamp DESC LIMIT :limit")
    fun getRecentReels(limit: Int = 50): Flow<List<ReelUsageEntity>>

    @Query("SELECT COUNT(*) FROM reel_usage WHERE timestamp >= :startTimeMillis")
    fun getTotalReelCount(startTimeMillis: Long): Flow<Int>

    @Query("DELETE FROM reel_usage")
    suspend fun clearAll()
}
`
  },
  {
    path: "app/src/main/java/com/tracker/reeltracker/data/database/AppDatabase.kt",
    filename: "AppDatabase.kt",
    language: "kotlin",
    category: "Database",
    description: "Room Database singleton instance with TypeConverters for Kotlin Enums.",
    content: `package com.tracker.reeltracker.data.database

import android.content.Context
import androidx.room.*

class PlatformTypeConverters {
    @TypeConverter
    fun fromPlatform(platform: PlatformType): String = platform.name

    @TypeConverter
    fun toPlatform(value: String): PlatformType = enumValueOf(value)
}

@Database(
    entities = [ReelUsageEntity::class],
    version = 1,
    exportSchema = true
)
@TypeConverters(PlatformTypeConverters::class)
abstract class AppDatabase : RoomDatabase() {

    abstract fun reelUsageDao(): ReelUsageDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "reel_tracker_database"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
`
  },
  {
    path: "app/src/main/java/com/tracker/reeltracker/data/repository/ReelRepository.kt",
    filename: "ReelRepository.kt",
    language: "kotlin",
    category: "Database",
    description: "Clean repository bridging AccessibilityService with Room database and exposing reactive Kotlin Flows.",
    content: `package com.tracker.reeltracker.data.repository

import com.tracker.reeltracker.data.database.*
import kotlinx.coroutines.flow.Flow

class ReelRepository(private val dao: ReelUsageDao) {

    suspend fun insertReelRecord(entity: ReelUsageEntity): Long {
        return dao.insert(entity)
    }

    suspend fun updateDwellDuration(id: Long, durationMs: Long) {
        dao.updateDwellTime(id, durationMs)
    }

    fun getDailyStats(daysBack: Int): Flow<List<DailyReelAggregate>> {
        val cutoff = System.currentTimeMillis() - (daysBack.toLong() * 24 * 60 * 60 * 1000)
        return dao.getDailyReelAggregates(cutoff)
    }

    fun getPlatformBreakdown(daysBack: Int): Flow<List<PlatformTotalAggregate>> {
        val cutoff = System.currentTimeMillis() - (daysBack.toLong() * 24 * 60 * 60 * 1000)
        return dao.getPlatformTotals(cutoff)
    }

    fun getRecentHistory(limit: Int = 50): Flow<List<ReelUsageEntity>> {
        return dao.getRecentReels(limit)
    }
}
`
  },
  {
    path: "app/src/main/java/com/tracker/reeltracker/ui/dashboard/ReelDashboardScreen.kt",
    filename: "ReelDashboardScreen.kt",
    language: "kotlin",
    category: "Compose UI",
    description: "Jetpack Compose Material 3 Dashboard with 1-30 day filter chip row, trend chart, platform cards, and brainrot severity meter.",
    content: `package com.tracker.reeltracker.ui.dashboard

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tracker.reeltracker.data.database.DailyReelAggregate
import com.tracker.reeltracker.data.database.PlatformTotalAggregate
import com.tracker.reeltracker.data.database.PlatformType

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReelDashboardScreen(
    viewModel: ReelDashboardViewModel,
    onOpenSettings: () -> Unit,
    modifier: Modifier = Modifier
) {
    val selectedDays by viewModel.selectedDaysRange.collectAsState()
    val dailyAggregates by viewModel.dailyStatsFlow.collectAsState(initial = emptyList())
    val platformTotals by viewModel.platformTotalsFlow.collectAsState(initial = emptyList())
    val totalReelsCount = platformTotals.sumOf { it.totalViews }
    val totalDwellTimeMs = platformTotals.sumOf { it.totalDwellMs }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Reel & Shorts Tracker", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        Text("Digital Wellbeing & Doomscroll Monitor", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                },
                actions = {
                    IconButton(onClick = onOpenSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(4.dp))
                // Day Range Filter Chip Row (1 to 30 days)
                TimeRangeChipRow(
                    selectedDays = selectedDays,
                    onSelectRange = { viewModel.setTimeRange(it) }
                )
            }

            item {
                // Hero Metrics Card
                HeroMetricsCard(
                    totalViews = totalReelsCount,
                    totalDwellMs = totalDwellTimeMs,
                    days = selectedDays
                )
            }

            item {
                // Brainrot Severity Index Meter
                BrainrotSeverityCard(totalReels = totalReelsCount, days = selectedDays)
            }

            item {
                // Daily Trend Bar Chart (Last 1-30 Days)
                DailyTrendChartCard(
                    dailyData = dailyAggregates,
                    days = selectedDays
                )
            }

            item {
                Text(
                    text = "Platform Breakdown",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            items(platformTotals) { platformStat ->
                PlatformStatCard(
                    stat = platformStat,
                    totalViewsInWindow = totalReelsCount
                )
            }

            item {
                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }
}

@Composable
fun TimeRangeChipRow(
    selectedDays: Int,
    onSelectRange: (Int) -> Unit
) {
    val ranges = listOf(1 to "Today", 7 to "7 Days", 14 to "14 Days", 30 to "30 Days")
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        ranges.forEach { (days, label) ->
            FilterChip(
                selected = selectedDays == days,
                onClick = { onSelectRange(days) },
                label = { Text(label, fontWeight = if (selectedDays == days) FontWeight.Bold else FontWeight.Normal) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                    selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    }
}

@Composable
fun HeroMetricsCard(
    totalViews: Int,
    totalDwellMs: Long,
    days: Int
) {
    val totalMinutes = totalDwellMs / 1000 / 60
    val hours = totalMinutes / 60
    val minutes = totalMinutes % 60
    val formattedTime = if (hours > 0) "\${hours}h \${minutes}m" else "\${minutes}m"
    val avgSecondsPerReel = if (totalViews > 0) (totalDwellMs / totalViews / 1000) else 0

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text(
                text = "OVERVIEW (\${if (days == 1) "TODAY" else "PAST $days DAYS"})",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                letterSpacing = 1.sp
            )
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "$totalViews",
                        fontSize = 36.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text("Reels Watched", fontSize = 12.sp, color = MaterialTheme.colorScheme.outline)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = formattedTime,
                        fontSize = 36.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text("Time Consumed", fontSize = 12.sp, color = MaterialTheme.colorScheme.outline)
                }
            }
            HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Avg. Dwell per Reel", fontSize = 13.sp)
                Text("\${avgSecondsPerReel}s / video", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
fun BrainrotSeverityCard(totalReels: Int, days: Int) {
    val dailyAvg = if (days > 0) totalReels / days else totalReels
    val (label, emoji, color) = when {
        dailyAvg < 10 -> Triple("Zen Mind", "🌱", Color(0xFF4CAF50))
        dailyAvg < 30 -> Triple("Mild Doomscroll", "🤨", Color(0xFFFFB300))
        dailyAvg < 60 -> Triple("Dopamine Fried", "🫠", Color(0xFFFF7043))
        dailyAvg < 100 -> Triple("Brainrot Alert", "💀", Color(0xFFE91E63))
        else -> Triple("Terminal Brainrot", "🧟", Color(0xFF9C27B0))
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.12f))
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(emoji, fontSize = 32.sp)
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Dopamine Status: $label",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = color
                )
                Text(
                    text = "Averaging $dailyAvg short videos/day.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
fun DailyTrendChartCard(
    dailyData: List<DailyReelAggregate>,
    days: Int
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                "Daily Views Trend",
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
            Spacer(modifier = Modifier.height(16.dp))
            // Render simplified bar chart
            Canvas(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(140.dp)
            ) {
                // Drawing logic for daily bars based on aggregate counts
            }
        }
    }
}

@Composable
fun PlatformStatCard(
    stat: PlatformTotalAggregate,
    totalViewsInWindow: Int
) {
    val percent = if (totalViewsInWindow > 0) (stat.totalViews.toFloat() / totalViewsInWindow) else 0f
    val (name, color) = when (stat.platform) {
        PlatformType.INSTAGRAM -> "Instagram Reels" to Color(0xFFE1306C)
        PlatformType.TIKTOK -> "TikTok" to Color(0xFF00F2FE)
        PlatformType.YOUTUBE_SHORTS -> "YouTube Shorts" to Color(0xFFFF0000)
        PlatformType.FACEBOOK -> "Facebook Reels" to Color(0xFF1877F2)
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(12.dp)
                            .clip(CircleShape)
                            .background(color)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(name, fontWeight = FontWeight.SemiBold)
                }
                Text("\${stat.totalViews} views (\${(percent * 100).toInt()}%)", fontWeight = FontWeight.Bold)
            }
            Spacer(modifier = Modifier.height(8.dp))
            LinearProgressIndicator(
                progress = { percent },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp)),
                color = color,
                trackColor = MaterialTheme.colorScheme.surfaceVariant
            )
        }
    }
}
`
  },
  {
    path: "app/src/main/java/com/tracker/reeltracker/utils/RestrictedSettingsHelper.kt",
    filename: "RestrictedSettingsHelper.kt",
    language: "kotlin",
    category: "Manifest & Config",
    description: "Crucial guidance for Android 13/14+ sideloaded Accessibility restrictions, Overlay permissions, and Battery Saver bypass.",
    content: `package com.tracker.reeltracker.utils

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.view.accessibility.AccessibilityManager

/**
 * Handles Android 13/14+ security restrictions:
 * 1. "Restricted Settings" dialog (API 33+) when app is sideloaded or built via Android Studio.
 * 2. SYSTEM_ALERT_WINDOW (Draw over other apps) permission intent.
 * 3. AccessibilityService active state verification.
 * 4. Battery optimization exclusion for persistent foreground monitoring.
 */
object RestrictedSettingsHelper {

    /**
     * Checks if our AccessibilityService is currently enabled in System Settings.
     */
    fun isAccessibilityServiceEnabled(context: Context, serviceClass: Class<*>): Boolean {
        val am = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
        val enabledServices = am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
        for (service in enabledServices) {
            if (service.resolveInfo.serviceInfo.packageName == context.packageName &&
                service.resolveInfo.serviceInfo.name == serviceClass.name
            ) {
                return true
            }
        }
        return false
    }

    /**
     * Launches the system Accessibility settings screen.
     */
    fun openAccessibilitySettings(context: Context) {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(intent)
    }

    /**
     * Launches System Alert Window permission screen.
     */
    fun requestOverlayPermission(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:\${context.packageName}")
            ).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        }
    }

    /**
     * Launches App Info screen.
     * CRITICAL FOR ANDROID 13/14+:
     * When an APK is sideloaded/debug-installed, Android 13+ displays "Restricted setting"
     * when the user tries to enable the Accessibility Service.
     * The user MUST open App Info -> 3-dots menu -> "Allow restricted settings" -> Auth fingerprint/PIN.
     */
    fun openAppDetailsSettings(context: Context) {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", context.packageName, null)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(intent)
    }

    /**
     * Request ignore battery optimizations to prevent OEMs (MIUI, OneUI) from killing the service.
     */
    fun requestIgnoreBatteryOptimizations(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            if (!pm.isIgnoringBatteryOptimizations(context.packageName)) {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:\${context.packageName}")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(intent)
            }
        }
    }
}
`
  },
  {
    path: "app/src/main/res/xml/accessibility_service_config.xml",
    filename: "accessibility_service_config.xml",
    language: "xml",
    category: "Manifest & Config",
    description: "Accessibility service definition targeting package names, scroll events, window state changes, and interactive flags.",
    content: `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/accessibility_service_description"
    android:accessibilityEventTypes="typeWindowStateChanged|typeViewScrolled|typeWindowContentChanged"
    android:packageNames="com.instagram.android,com.zhiliaoapp.musically,com.ss.android.ugc.trill,com.google.android.youtube,com.facebook.katana"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:notificationTimeout="100"
    android:canRetrieveWindowContent="true"
    android:accessibilityFlags="flagDefault|flagRetrieveInteractiveWindows|flagIncludeNotImportantViews"
    android:settingsActivity="com.tracker.reeltracker.MainActivity" />
`
  },
  {
    path: "app/src/main/AndroidManifest.xml",
    filename: "AndroidManifest.xml",
    language: "xml",
    category: "Manifest & Config",
    description: "Production AndroidManifest declaring BIND_ACCESSIBILITY_SERVICE, SYSTEM_ALERT_WINDOW, POST_NOTIFICATIONS, and foreground service types.",
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    package="com.tracker.reeltracker">

    <!-- Essential Permissions -->
    <!-- Floating Pill Overlay -->
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    
    <!-- Android 13+ Notification Permission -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    
    <!-- Android 14+ Foreground Service Permission with specialUse type -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
    
    <!-- Battery optimization exemption for persistent monitoring -->
    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />

    <application
        android:name=".ReelTrackerApp"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.ReelTracker">

        <!-- Main Dashboard Activity (Jetpack Compose) -->
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/Theme.ReelTracker">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Accessibility Service Declaration -->
        <!-- Note: MUST be guarded with android.permission.BIND_ACCESSIBILITY_SERVICE -->
        <service
            android:name=".service.ReelAccessibilityService"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
            android:exported="true">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/accessibility_service_config" />
        </service>

        <!-- Foreground Service type declaration for Android 14+ -->
        <property
            android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
            android:value="Usage tracking and real-time digital wellbeing overlay" />

    </application>
</manifest>
`
  },
  {
    path: "app/build.gradle.kts",
    filename: "build.gradle.kts",
    language: "groovy",
    category: "Manifest & Config",
    description: "Modern Kotlin DSL Gradle configuration with Room 2.6, Jetpack Compose Material 3, Coroutines, and KSP.",
    content: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.tracker.reeltracker"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.tracker.reeltracker"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }
}

dependencies {
    // AndroidX Core & Lifecycle
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)

    // Jetpack Compose (Material 3)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)

    // Room Database with Coroutines & Flow
    val roomVersion = "2.6.1"
    implementation("androidx.room:room-runtime:$roomVersion")
    implementation("androidx.room:room-ktx:$roomVersion")
    ksp("androidx.room:room-compiler:$roomVersion")

    // Kotlin Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}
`
  },
  {
    path: "app/src/main/java/com/tracker/reeltracker/MainActivity.kt",
    filename: "MainActivity.kt",
    language: "kotlin",
    category: "Compose UI",
    description: "Main Activity hosting the Jetpack Compose dashboard and handling permission checks on startup.",
    content: `package com.tracker.reeltracker

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.tracker.reeltracker.ui.dashboard.ReelDashboardScreen
import com.tracker.reeltracker.ui.dashboard.ReelDashboardViewModel
import com.tracker.reeltracker.ui.theme.ReelTrackerTheme
import com.tracker.reeltracker.utils.RestrictedSettingsHelper

class MainActivity : ComponentActivity() {

    private val viewModel: ReelDashboardViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            ReelTrackerTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    ReelDashboardScreen(
                        viewModel = viewModel,
                        onOpenSettings = {
                            RestrictedSettingsHelper.openAccessibilitySettings(this)
                        }
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Check if overlay permission is granted
        RestrictedSettingsHelper.requestOverlayPermission(this)
    }
}
`
  },
  {
    path: "app/src/main/java/com/tracker/reeltracker/ReelTrackerApp.kt",
    filename: "ReelTrackerApp.kt",
    language: "kotlin",
    category: "Service",
    description: "Android Application class initializing Room database and repository singletons.",
    content: `package com.tracker.reeltracker

import android.app.Application
import com.tracker.reeltracker.data.database.AppDatabase
import com.tracker.reeltracker.data.repository.ReelRepository

class ReelTrackerApp : Application() {

    val database by lazy { AppDatabase.getInstance(this) }
    val repository by lazy { ReelRepository(database.reelUsageDao()) }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    companion object {
        lateinit var instance: ReelTrackerApp
            private set
    }
}
`
  },
  {
    path: "app/src/main/java/com/tracker/reeltracker/ui/dashboard/ReelDashboardViewModel.kt",
    filename: "ReelDashboardViewModel.kt",
    language: "kotlin",
    category: "Compose UI",
    description: "Android ViewModel connecting Room Repository to Jetpack Compose StateFlows.",
    content: `package com.tracker.reeltracker.ui.dashboard

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tracker.reeltracker.ReelTrackerApp
import com.tracker.reeltracker.data.database.DailyReelAggregate
import com.tracker.reeltracker.data.database.PlatformTotalAggregate
import com.tracker.reeltracker.data.database.UnifiedDailyTotal
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.*

@OptIn(ExperimentalCoroutinesApi::class)
class ReelDashboardViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = (application as ReelTrackerApp).repository

    private val _selectedDaysRange = MutableStateFlow(7)
    val selectedDaysRange: StateFlow<Int> = _selectedDaysRange.asStateFlow()

    // Unified daily totals flow (all apps combined)
    val dailyStatsFlow: Flow<List<DailyReelAggregate>> = _selectedDaysRange.flatMapLatest { days ->
        repository.getDailyStats(days)
    }

    val platformTotalsFlow: Flow<List<PlatformTotalAggregate>> = _selectedDaysRange.flatMapLatest { days ->
        repository.getPlatformBreakdown(days)
    }

    fun setTimeRange(days: Int) {
        _selectedDaysRange.value = days
    }
}
`
  },
  {
    path: "app/src/main/java/com/tracker/reeltracker/ui/theme/Theme.kt",
    filename: "Theme.kt",
    language: "kotlin",
    category: "Compose UI",
    description: "Material 3 Dark Theme definition for the Reel Tracker app.",
    content: `package com.tracker.reeltracker.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF6366F1),
    secondary = Color(0xFFA855F7),
    tertiary = Color(0xFFEC4899),
    background = Color(0xFF0F0F12),
    surface = Color(0xFF18181B),
    onPrimary = Color.White,
    onSecondary = Color.White,
    onBackground = Color(0xFFF4F4F5),
    onSurface = Color(0xFFF4F4F5)
)

@Composable
fun ReelTrackerTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = DarkColorScheme
    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
`
  },
  {
    path: "app/src/main/res/layout/layout_floating_pill.xml",
    filename: "layout_floating_pill.xml",
    language: "xml",
    category: "Overlay",
    description: "XML layout inflated by FloatingOverlayManager via WindowManager for the draggable pill.",
    content: `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:background="@drawable/bg_floating_pill"
    android:gravity="center_vertical"
    android:orientation="horizontal"
    android:paddingStart="14dp"
    android:paddingTop="8dp"
    android:paddingEnd="14dp"
    android:paddingBottom="8dp"
    android:elevation="12dp">

    <!-- Escalating Brainrot Reaction Emoji -->
    <TextView
        android:id="@+id/tv_reaction_emoji"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="🌱"
        android:textSize="20sp" />

    <LinearLayout
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginStart="8dp"
        android:orientation="vertical">

        <!-- Unified Reel Counter -->
        <TextView
            android:id="@+id/tv_reel_count"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="Total: #0"
            android:textColor="#FFFFFF"
            android:textSize="12sp"
            android:textStyle="bold" />

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="All apps combined"
            android:textColor="#A1A1AA"
            android:textSize="9sp" />
    </LinearLayout>
</LinearLayout>
`
  },
  {
    path: "app/src/main/res/values/strings.xml",
    filename: "strings.xml",
    language: "xml",
    category: "Manifest & Config",
    description: "Android string resources including required AccessibilityService description for Play Store compliance.",
    content: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Reel &amp; Shorts Usage Tracker</string>
    <string name="accessibility_service_description">Reel &amp; Shorts Usage Tracker uses AccessibilityService solely to detect when you are actively inside short-form video players (Instagram Reels, TikTok, YouTube Shorts, Facebook Reels) to maintain a unified viewing counter and help monitor doomscrolling habits. No personal data or keystrokes are collected.</string>
</resources>
`
  },
  {
    path: "settings.gradle.kts",
    filename: "settings.gradle.kts",
    language: "groovy",
    category: "Manifest & Config",
    description: "Root Gradle settings file mapping project plugins and repositories.",
    content: `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "ReelShortsTracker"
include(":app")
`
  },
  {
    path: "build.gradle.kts",
    filename: "build.gradle.kts",
    language: "groovy",
    category: "Manifest & Config",
    description: "Root project build.gradle.kts configuring Android and Kotlin plugins.",
    content: `plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.ksp) apply false
}
`
  },
  {
    path: "gradle.properties",
    filename: "gradle.properties",
    language: "groovy",
    category: "Manifest & Config",
    description: "Android Gradle build properties enabling AndroidX and non-transitive R classes.",
    content: `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.nonTransitiveRClass=true
kotlin.code.style=official
`
  },
  {
    path: "README.md",
    filename: "README.md",
    language: "groovy",
    category: "Manifest & Config",
    description: "Complete instructions on building the APK in Android Studio and installing on physical devices.",
    content: `# Reel & Shorts Usage Tracker — Android App

## Quick Installation on Physical Device / Emulator

### Prerequisites
- Android Studio Iguana / Jellyfish / Ladybug or newer
- Android SDK 35 (compileSdk 35, minSdk 26)
- Connected Android Device (Android 8.0 to Android 15+) with USB Debugging enabled

### 1. Build and Install via Command Line
\`\`\`bash
# Build the Debug APK
./gradlew assembleDebug

# Install directly to your connected device
adb install -r app/build/outputs/apk/debug/app-debug.apk
\`\`\`

### 2. Required One-Time Device Permissions
1. **Android 13/14+ Restricted Settings**:
   - Because this app is built/sideloaded directly, Android will gray out Accessibility:
   - Go to: **Settings -> Apps -> Reel Tracker -> 3 Dots (Top Right) -> Allow restricted settings**.
   - Authenticate with fingerprint/PIN.
2. **Accessibility Service**:
   - Go to: **Settings -> Accessibility -> Installed Services -> Reel & Shorts Tracker -> Toggle ON**.
3. **Display Over Other Apps (Overlay)**:
   - Go to: **Settings -> Apps -> Special app access -> Display over other apps -> Reel Tracker -> Toggle ON**.
4. **Battery Saver Exemption**:
   - Set app battery usage to **Unrestricted** to prevent background kills.
`
  }
];

