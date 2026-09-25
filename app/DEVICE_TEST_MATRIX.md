# Android and mobile speech acceptance matrix

The automated `Android Device Matrix` workflow launches the bundled app on Android
8, 10, 12, 14, and 15. It verifies asset startup, the restricted WebView, native
bridge visibility, required permissions, and Activity recreation safety. Run it with
GitHub Actions **Run workflow** after Android or speech changes.

Physical-device checks remain mandatory because an emulator cannot validate speaker,
microphone, vendor TTS voices, Cốc Cốc integration, audio focus from real phone calls,
or aggressive low-memory process termination.

For each Android version available, record device/browser/version and pass/fail for:

1. APK offline launch shows the 3,000-word catalog and saves learning progress.
2. Word, sentence, example, Audio Pod, and feedback playback use the selected voice.
3. A second playback cancels the first without overlapping voices.
4. An alarm/call/music interruption stops speech; retry works after focus returns.
5. Microphone permission is requested only after tapping a speaking action; deny,
   allow, cancel, retry, and leaving the app all end recognition cleanly.
6. Chrome and Cốc Cốc web versions pass the same playback and microphone cases.
7. Offline, limited/weak network, reconnect, screen rotation, background/foreground,
   and low-memory relaunch preserve completed and pending work.

Do not mark P4-02 or P2-03 complete until the physical Chrome, Cốc Cốc, APK speaker,
and microphone rows have evidence. Never use emulator results as a substitute.
