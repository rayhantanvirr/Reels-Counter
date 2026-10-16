package com.tracker.reeltracker

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
        RestrictedSettingsHelper.requestOverlayPermission(this)
    }
}
