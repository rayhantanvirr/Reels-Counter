import React from 'react';
import { 
  ShieldAlert, 
  Lock, 
  BatteryCharging, 
  CheckCircle2, 
  ExternalLink, 
  AlertTriangle,
  Smartphone,
  Info,
  Terminal,
  FileCheck
} from 'lucide-react';

export const AndroidRestrictionsGuide: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            Android 13 / 14 / 15+ OS Restrictions & Production Compliance Guide
          </h2>
          <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
            Short-form usage tracking apps (such as <em>Brainrot</em>) operate at the intersection of <code className="text-neutral-300">AccessibilityService</code>, <code className="text-neutral-300">SYSTEM_ALERT_WINDOW</code>, and persistent background processes. Modern Android versions enforce strict security gates to prevent abuse.
          </p>
        </div>
      </div>

      {/* Grid of OS Restrictions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Section 1: Android 13 Restricted Settings */}
        <div className="bg-neutral-900/90 border border-neutral-800 p-5 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-rose-400">
            <Lock className="w-4 h-4" />
            <h3 className="text-sm font-bold">1. Android 13+ "Restricted Settings" Bypass</h3>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            When installing an APK outside Google Play (sideloading or Android Studio debug build), Android 13/14 marks the app as untrusted and <strong className="text-neutral-200">grays out the AccessibilityService toggle</strong> with the error:
            <span className="block mt-1.5 p-2 rounded-lg bg-neutral-950 border border-rose-900/40 text-[11px] font-mono text-rose-300">
              "Restricted setting: For your security, this setting is currently unavailable."
            </span>
          </p>
          <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 text-xs text-neutral-300 space-y-1.5">
            <p className="font-semibold text-white">How to guide users in your onboarding UI:</p>
            <ol className="list-decimal list-inside text-[11px] text-neutral-400 space-y-1">
              <li>Launch <code className="text-neutral-300">Settings.ACTION_APPLICATION_DETAILS_SETTINGS</code> for your app package.</li>
              <li>Instruct user to tap the <strong className="text-neutral-200">3 dots (top right menu)</strong>.</li>
              <li>Select <strong className="text-neutral-200">"Allow restricted settings"</strong>.</li>
              <li>Verify phone fingerprint/PIN.</li>
              <li>Reopen Accessibility settings; the toggle will now be clickable!</li>
            </ol>
          </div>
        </div>

        {/* Section 2: Android 14 Foreground Service Types */}
        <div className="bg-neutral-900/90 border border-neutral-800 p-5 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-indigo-400">
            <Terminal className="w-4 h-4" />
            <h3 className="text-sm font-bold">2. Android 14+ Foreground Service Types</h3>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Android 14 (API 34) mandates that every Foreground Service explicitly declare a <code className="text-neutral-300">foregroundServiceType</code>. Omitting this throws an instant <code className="text-rose-400">SecurityException</code>.
          </p>
          <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 text-xs font-mono text-neutral-300 space-y-2">
            <p className="text-[10px] text-neutral-500">// In AndroidManifest.xml:</p>
            <p className="text-[11px] text-indigo-300">
              &lt;uses-permission android:name="android.permission.FOREGROUND_SERVICE" /&gt;<br />
              &lt;uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" /&gt;
            </p>
            <p className="text-[10px] text-neutral-500">// Service declaration:</p>
            <p className="text-[11px] text-emerald-300">
              &lt;property<br />
              &nbsp;&nbsp;android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"<br />
              &nbsp;&nbsp;android:value="Usage tracking &amp; digital wellbeing overlay" /&gt;
            </p>
          </div>
        </div>

        {/* Section 3: Floating Overlay (SYSTEM_ALERT_WINDOW) */}
        <div className="bg-neutral-900/90 border border-neutral-800 p-5 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-amber-400">
            <Smartphone className="w-4 h-4" />
            <h3 className="text-sm font-bold">3. SYSTEM_ALERT_WINDOW Permission</h3>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            The floating pill requires "Display over other apps". It cannot be requested via standard runtime dialog; it requires directing the user to system settings:
          </p>
          <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 font-mono text-[11px] text-neutral-300 space-y-1">
            <p className="text-neutral-500">// Check before inflating overlay:</p>
            <p className="text-amber-300">if (!Settings.canDrawOverlays(context)) &#123;</p>
            <p className="text-neutral-400 pl-4">val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,</p>
            <p className="text-neutral-400 pl-8">Uri.parse("package:$&#123;context.packageName&#125;"))</p>
            <p className="text-neutral-400 pl-4">context.startActivity(intent)</p>
            <p className="text-amber-300">&#125;</p>
          </div>
        </div>

        {/* Section 4: OEM Battery Optimization Killers */}
        <div className="bg-neutral-900/90 border border-neutral-800 p-5 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-emerald-400">
            <BatteryCharging className="w-4 h-4" />
            <h3 className="text-sm font-bold">4. Aggressive OEM Battery Optimization Killers</h3>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Manufacturers like Xiaomi (MIUI/HyperOS), Samsung (OneUI), and OnePlus (ColorOS) kill background accessibility connections after a few hours of sleep:
          </p>
          <ul className="space-y-1.5 text-xs text-neutral-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>Prompt for <code className="text-neutral-200">ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS</code>.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>Enable <strong>"Auto-start"</strong> permission in OEM settings (MIUI Security app).</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>Instruct user to "Lock app in Recents" by dragging down on the app card in the task switcher.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Google Play Store Policy Declaration Guide */}
      <div className="bg-neutral-900/80 border border-neutral-800 p-5 rounded-2xl space-y-3">
        <div className="flex items-center gap-2 text-white">
          <FileCheck className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold">Why Standard UsageStatsManager is Not Enough (Accessibility Justification)</h3>
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed">
          Google Play's Accessibility Policy is strict. To pass Play Store review, your app's Prominent In-App Disclosure must clearly explain:
        </p>
        <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800/80 text-xs text-neutral-300 leading-relaxed space-y-2">
          <p className="font-semibold text-white">Required Prominent Disclosure Copy Template:</p>
          <p className="italic text-neutral-400">
            "Reel Tracker uses the Android AccessibilityService API solely to detect when you are actively inside the Reels or Shorts video containers of Instagram, TikTok, YouTube, and Facebook. Android's standard UsageStatsManager only reveals that the application is open, but cannot distinguish between a user editing photos/reading messages and watching short-form doomscroll video feeds. No personal data, passwords, or keystrokes are recorded or transmitted off your device."
          </p>
        </div>
      </div>
    </div>
  );
};
