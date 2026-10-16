package com.tracker.reeltracker

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
