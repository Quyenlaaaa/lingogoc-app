# Speaking avatar production contract

Status: RT-10 foundation. The current lazy renderer uses repository-owned procedural
geometry, with an honest CSS/2D fallback. It does not download or imply ownership of a
third-party human likeness. A future GLB asset must pass this contract before use.

## Product and state contract

- The character is always labeled as a fictional AI tutor and must not imitate a real
  person.
- The renderer consumes only the authoritative Speaking state: `idle`, `listening`,
  `transcribing`, `thinking`, `streaming`, `speaking`, `interrupted`, `reconnecting`, or
  `error`. It must never create a second conversation-state machine.
- Mouth motion runs only while actual TTS playback state is `speaking`. Barge-in must
  stop audio and mouth motion in the same state transition.
- Captions, transcript, microphone, text input, retry, corrections, and scores remain
  fully usable when the avatar is disabled or cannot render.

## Accessibility and fallback order

1. User setting “avatar off”: render the existing compact status orb.
2. Reduced motion or a device with at most 4 GB reported memory: render the static CSS
   tutor with state colors and text.
3. Missing WebGL, context loss, sustained low frame rate, load timeout, or asset error:
   switch permanently to the CSS tutor for that view.
4. Supported device: lazy-load the procedural WebGL renderer only after the Speaking
   view opens. A future GLB renderer follows the same gate.

The avatar has an accessible label, but decorative facial geometry is hidden from the
accessibility tree. State remains available as text outside the visual.

## Asset and licensing gate

- Accept only an original commissioned asset, a repository-owned asset, or an asset with
  a license that explicitly permits modification and commercial redistribution.
- Store the source URL, author, license text, acquisition date, and modification record
  beside the asset. Do not accept “free download” as licensing evidence.
- Do not use a scan, likeness, or voice of a real person without explicit documented
  consent covering this product.
- Validate the GLB in CI: no external texture URLs, no executable extensions, no hidden
  cameras/lights required for correctness, and no unexpected metadata containing user
  or author secrets.

## Performance budgets

- Compressed GLB plus textures: at most 4 MB.
- No avatar chunk or asset on initial application load; load only on the Speaking route.
- Avatar loading must not delay microphone readiness or first AI text/audio.
- Target 60 fps desktop and 30 fps supported mobile. Fall back after sustained frames
  below 20 fps, a WebGL context loss, or a 5-second load timeout.
- Pause rendering when the document is hidden and dispose GPU resources when the view
  unmounts.

## Animation contract

- `listening`/`transcribing`: attentive gaze and a restrained listening pulse.
- `thinking`/`streaming`/`reconnecting`: small head/gaze movement; mouth closed.
- `speaking`: subtle gestures and mouth motion driven by output-audio amplitude first.
- `interrupted`: return to neutral immediately.
- `error`: calm neutral pose; never continue speaking animation.

Timed visemes may replace amplitude motion only when a selected TTS provider supplies
trustworthy timing. Generated text timing is not a valid substitute for audio timing.
