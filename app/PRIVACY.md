# LingoGoc privacy disclosure

Last updated: 2026-09-25

LingoGoc stores learning progress, settings, review schedules, diagnostic history,
and speaking-session history on the learner's device. The current production version
does not provide an account or cross-device cloud synchronization. Learners can export
and import a local JSON backup through the system file picker.

The app requests microphone permission only after the learner starts a speaking or
pronunciation exercise. Audio is handled by Android speech recognition or the browser
speech interface; the app does not intentionally store raw microphone recordings.
Text submitted to AI Speaking and vocabulary enrichment is sent to the LingoGoc
Cloudflare Worker and may be processed by configured AI providers. API credentials are
kept on the server and are never embedded in the app.

The app may request server-generated speech audio and vocabulary updates. Operational
logs use request metadata and error codes, not learning prompts or secrets. There is
currently no advertising SDK, payment SDK, analytics SDK, or third-party crash-reporting
SDK in the Android package.

Before a public Play release, the publisher must add a contact address and hosted
privacy-policy URL, complete the Play Data safety form, and update this disclosure if
authentication, synchronization, analytics, crash reporting, or payments are added.
