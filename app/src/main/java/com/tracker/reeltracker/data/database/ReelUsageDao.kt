package com.tracker.reeltracker.data.database

import androidx.room.*
import kotlinx.coroutines.flow.Flow

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

    @Query("SELECT COUNT(*) FROM reel_usage")
    fun getGrandTotalReelCount(): Flow<Int>

    @Query("SELECT COALESCE(SUM(dwellTimeMs), 0) FROM reel_usage")
    fun getGrandTotalDwellMs(): Flow<Long>

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

    @Query("SELECT * FROM reel_usage ORDER BY timestamp DESC LIMIT :limit")
    fun getRecentReels(limit: Int = 50): Flow<List<ReelUsageEntity>>

    @Query("DELETE FROM reel_usage")
    suspend fun clearAll()
}
