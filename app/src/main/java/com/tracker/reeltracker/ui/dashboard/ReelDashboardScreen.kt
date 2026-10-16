package com.tracker.reeltracker.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
                TimeRangeChipRow(
                    selectedDays = selectedDays,
                    onSelectRange = { viewModel.setTimeRange(it) }
                )
            }

            item {
                HeroMetricsCard(
                    totalViews = totalReelsCount,
                    totalDwellMs = totalDwellTimeMs,
                    days = selectedDays
                )
            }

            item {
                BrainrotSeverityCard(totalReels = totalReelsCount, days = selectedDays)
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
    val formattedTime = if (hours > 0) "${hours}h ${minutes}m" else "${minutes}m"
    val avgSecondsPerReel = if (totalViews > 0) (totalDwellMs / totalViews / 1000) else 0

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            val titleText = if (days == 1) "OVERVIEW (TODAY)" else "OVERVIEW (PAST $days DAYS)"
            Text(
                text = titleText,
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
                Text("${avgSecondsPerReel}s / video", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
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
                val percentInt = (percent * 100).toInt()
                Text("${stat.totalViews} views ($percentInt%)", fontWeight = FontWeight.Bold)
            }
            Spacer(modifier = Modifier.height(8.dp))
            LinearProgressIndicator(
                progress = percent.coerceIn(0f, 1f),
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
