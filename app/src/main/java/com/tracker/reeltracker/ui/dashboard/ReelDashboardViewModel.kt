package com.tracker.reeltracker.ui.dashboard

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import com.tracker.reeltracker.ReelTrackerApp
import com.tracker.reeltracker.data.database.DailyReelAggregate
import com.tracker.reeltracker.data.database.PlatformTotalAggregate
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.*

@OptIn(ExperimentalCoroutinesApi::class)
class ReelDashboardViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = (application as ReelTrackerApp).repository

    private val _selectedDaysRange = MutableStateFlow(7)
    val selectedDaysRange: StateFlow<Int> = _selectedDaysRange.asStateFlow()

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
