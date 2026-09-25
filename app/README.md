# LingoGoc Android (Kotlin)

The Android app packages the built web frontend in the APK and serves it through
`WebViewAssetLoader`. Bundled UI, local progress, and catalog data can open offline.
AI, server synchronization, and server audio require a network connection.

Each APK contains a complete fallback catalog and a generated
`catalog-manifest.json` with its SHA-256 version. On startup the app uses the newest
valid cached 3,000-word catalog, checks the small server manifest, and downloads the
full catalog only when its content hash changes. Invalid or incomplete downloads are
ignored, so first launch and learning never depend on the network. Android reports
validated, limited, and offline connectivity to the web UI; learning events remain in
the local offline queue until authenticated synchronization is available.

## Requirements

- Android Studio and JDK 17.
- Android SDK 35.
- Node.js and npm; Gradle runs the frontend production build before packaging.

## Run from Android Studio

1. Open the `app` directory.
2. Wait for Gradle sync.
3. Select a physical device or emulator running API 26 or later.
4. Run the `app` configuration.

## Debug APK

From `app`:

```powershell
.\gradlew.bat assembleDebug
```

Output: `app/app/build/outputs/apk/debug/app-debug.apk`.

The `Android Kotlin APK` GitHub Actions workflow also publishes a debug APK artifact
after changes reach `main`.

## Release build

The manually dispatched `Android Signed Release` workflow accepts a semantic version
name and increasing version code, reads signing material only from the protected
GitHub `production` environment, and produces signed AAB/APK artifacts plus SHA-256
checksums. Required secret names and the external Play steps are documented in
`RELEASE_CHECKLIST.md`. Never commit keystores or passwords.

## Native integration

- Kotlin manages WebView lifecycle and back navigation.
- Web assets use the secure internal HTTPS origin from `WebViewAssetLoader`.
- Microphone permission is requested only when speaking features need it.
- Kotlin Text-to-Speech provides Android voice presets.
- Kotlin `SpeechRecognizer` covers devices where WebView lacks Web Speech support.
- JSON backup import uses Android's file picker; export uses the system save dialog.
