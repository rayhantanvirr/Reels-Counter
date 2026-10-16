package com.tracker.reeltracker.detection

import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo
import com.tracker.reeltracker.data.database.PlatformType
import java.util.*

data class DetectionResult(
    val isReel: Boolean,
    val uniqueVideoSignature: String = "",
    val creatorTag: String? = null,
    val audioTitle: String? = null
)

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

            if (desc.contains("reel by") || desc.contains("reels") || desc.contains("remix with")) {
                hasReelContentDesc = true
                if (desc.contains("reel by")) {
                    creator = desc.substringAfter("reel by").trim().take(30)
                }
            }

            if (desc.contains("audio") || desc.contains("original sound") || desc.contains("song")) {
                audio = text.ifBlank { desc.take(40) }
            }

            val nodeBounds = Rect()
            node.getBoundsInScreen(nodeBounds)
            if (nodeBounds.left >= rightEdgeThreshold && node.isClickable) {
                if (desc.contains("like") || desc.contains("comment") || desc.contains("share")) {
                    hasVerticalActionColumn = true
                }
            }
        }

        val isReel = hasReelContentDesc || (hasVerticalActionColumn && isVerticalPagerPresent(rootNode))
        val timeSec = System.currentTimeMillis() / 1000
        val signature = "IG_${creator.orEmpty()}_${audio.orEmpty()}_$timeSec"

        return DetectionResult(isReel = isReel, uniqueVideoSignature = signature, creatorTag = creator, audioTitle = audio)
    }

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
        val signature = "TT_${creator.orEmpty()}_${sound.orEmpty()}"

        return DetectionResult(isReel = isTikTokVideo, uniqueVideoSignature = signature, creatorTag = creator, audioTitle = sound)
    }

    private fun detectYouTubeShorts(rootNode: AccessibilityNodeInfo): DetectionResult {
        var isShortsContainer = false
        var hasShortsLike = false
        var creator: String? = null

        traverseHierarchy(rootNode) { node ->
            val desc = node.contentDescription?.toString()?.lowercase(Locale.ROOT) ?: ""

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
        val timeBucket = System.currentTimeMillis() / 2000
        val signature = "YT_${creator.orEmpty()}_$timeBucket"

        return DetectionResult(isReel = isShorts, uniqueVideoSignature = signature, creatorTag = creator)
    }

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
        val timeBucket = System.currentTimeMillis() / 2000
        val signature = "FB_$timeBucket"

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
