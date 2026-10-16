package com.tracker.reeltracker.data.database

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

enum class PlatformType {
    INSTAGRAM,
    TIKTOK,
    YOUTUBE_SHORTS,
    FACEBOOK
}

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
    val timestamp: Long,
    val dwellTimeMs: Long,
    val dateString: String,
    val creatorTag: String? = null,
    val audioTitle: String? = null
)
