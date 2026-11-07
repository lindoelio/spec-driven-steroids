# Mobile Checks

iOS, Android, React Native, Flutter, and cross-platform mobile applications.

## Mobile Domain Signals

- `android/` or `app/src/` directories
- `ios/` directory
- `Flutter` or `RN` or `ReactNative` in project name
- `package.json` with react-native, expo, flutter
- Podfile, Gradle, pubspec.yaml

## Mobile-Specific Check Categories

### 1. Build Verification

```
- Project compiles without errors
- All native dependencies resolved
- Platform SDK versions correct
- Code signing configured for release
- App icon and assets present
- Build variant correct (debug/release)
```

### 2. Platform Conventions

**iOS:**
```
- Info.plist keys present for required permissions
- AppDelegate properly configured
- LaunchScreen.storyboard present
- Minimum iOS version supported
- Device families specified (iPhone/iPad)
```

**Android:**
```
- AndroidManifest.xml permissions declared
- minSdkVersion and targetSdkVersion correct
- ProGuard rules for release
- Keystore configured for release
- App icons in mipmap directories
```

### 3. Navigation & Deep Linking

```
- Navigation state managed correctly
- Back button handled
- Deep links registered and handled
- Universal links / app links configured
- Deep link fallback to store/home screen
```

### 4. Offline & Data

```
- Offline state handled gracefully
- Local storage size limits respected
- Data synced when connection restored
- No sensitive data in plain localStorage
- Cache invalidation works correctly
```

### 5. Permissions

```
- Permissions requested at appropriate time
- Graceful degradation when denied
- Permission rationale shown
- Settings deep link when permanently denied
- Permissions match actual usage
```

### 6. Performance

```
- Cold start time <2s
- Memory usage <150MB typical
- No ANR (Application Not Responding)
- Smooth 60fps scrolling
- Battery efficient (no wake locks)
```

## Quick Mobile Checks

Run these first (fast, high signal):

```bash
# iOS
cd ios && pod install && xcodebuild -workspace App.xcworkspace -scheme App -build 2>&1 | tail -20

# Android
./gradlew assembleDebug 2>&1 | tail -30

# React Native
npx react-native bundle --platform ios --dev false --entry-file index.js 2>&1

# Flutter
flutter analyze
flutter build apk --debug 2>&1 | tail -20
```

## Mobile Check Examples

### Example: React Native Permission Check

```typescript
import { PermissionsAndroid, Platform } from 'react-native';

async function requestCameraPermission() {
  // Check: Permission requested with rationale
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera Permission',
        message: 'App needs camera access to take photos',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );
    // Check: Graceful handling of denial
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      // Show explanation and link to settings
      return false;
    }
  }
  return true;
}
```

**Check清单:**
- [ ] Permission requested with rationale dialog
- [ ] Graceful degradation when denied
- [ ] Settings link when permanently denied
- [ ] Platform check for iOS permissions too

### Example: Flutter Platform Channel Check

```dart
class MyPlugin {
  static const platform = MethodChannel('com.example/myplugin');

  Future<String?> getBatteryLevel() async {
    // Check: Error handling for platform exceptions
    try {
      final int batteryLevel = await platform.invokeMethod('getBatteryLevel');
      return batteryLevel.toString();
    } on PlatformException catch (e) {
      // Check: Errors logged, not silently swallowed
      print('Failed to get battery level: ${e.message}');
      return null;
    } on MissingPluginException {
      print('Plugin not implemented on this platform');
      return null;
    }
  }
}
```

**Check清单:**
- [ ] Platform exceptions caught
- [ ] MissingPluginException handled (testing scenario)
- [ ] Errors logged, not silently ignored
- [ ] Null safety for nullable returns

## Common Mobile Bugs

| Bug | Symptom | Check |
|-----|---------|-------|
| Permission crash | App crashes on first launch | Permissions requested correctly |
| ANR | App freezes | No blocking on main thread |
| Memory leak | App killed by OS | Component cleanup |
| Wrong SDK | Crashes on older devices | minSdkVersion correct |
| Hardcoded paths | Works on dev, fails prod | Use platform APIs |
| No offline mode | App unusable offline | Graceful degradation |
