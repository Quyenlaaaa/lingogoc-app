# Android release checklist

1. Update `RELEASE_NOTES.md` and choose unique semantic `version_name` and increasing
   integer `version_code` values.
2. Configure the protected GitHub `production` environment with
   `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and
   `ANDROID_KEY_PASSWORD`. Never paste these values into source files or logs.
3. Run the `Android Device Matrix` workflow and complete `DEVICE_TEST_MATRIX.md` on
   physical devices, Chrome, and Cốc Cốc.
4. Run `Android Signed Release`; retain the AAB/APK checksums and download the
   short-lived artifact.
5. Verify the hosted privacy-policy URL and Play Data safety answers against
   `PRIVACY.md`.
6. Upload the AAB to Play internal testing manually, verify Play App Signing and the
   generated device catalog, then test installation/update/rollback with test users.
7. Select and privacy-review a crash-reporting provider before adding its SDK and
   secrets. Current builds intentionally contain no third-party crash reporter.

Play upload and crash-provider enrollment are external account changes and require
explicit authorization; the repository does not simulate either action.
