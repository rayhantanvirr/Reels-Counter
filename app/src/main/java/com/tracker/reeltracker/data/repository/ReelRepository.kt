package com.tracker.reeltracker.data.repository

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
