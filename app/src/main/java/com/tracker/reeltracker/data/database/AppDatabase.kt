package com.tracker.reeltracker.data.database

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
    exportSchema = false
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
