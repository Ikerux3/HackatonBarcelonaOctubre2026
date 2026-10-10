# ElevenLabs TTS

The game prefers server-side ElevenLabs speech and falls back to the browser's Web Speech voice. Subtitles remain the source of truth and gameplay must never depend on audio.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add `ELEVENLABS_API_KEY` and `ELEVENLABS_GUEST_VOICE_ID`.
3. Restart `npm run dev`.
4. In the game voice selector, choose **ElevenLabs voice** and select a line or play until The Guest speaks.

Do not prefix these variables with `VITE_`: that would expose them to the browser. Configure the same names as server secrets in the deployed environment.

## Voice roles

- `guest`: current lines from The Guest.
- `mom`: the genuine fictional mother voice planned for the introduction.
- `mom_impostor`: the same fictional base, with subtly less stable generation and slightly lower playback for MG04.

`ELEVENLABS_MOM_VOICE_ID` falls back to the Guest voice ID. `ELEVENLABS_MOM_IMPOSTOR_VOICE_ID` falls back to Mom. The MG04 trigger can call `useGuestVoice(line, active, delay, onFinished, "mom_impostor")` when that level lands; no AI contract change is required.

## Runtime safeguards

- Text is trimmed and limited to 220 characters on the server.
- Voice IDs come only from server configuration; the client cannot submit arbitrary IDs.
- The API key never leaves the server function.
- Generated MP3 responses are capped at 2.5 MB and cached in memory (48 lines) to reduce repeated credit use.
- Scene changes, page hiding and mute cancel active playback.
- Network, quota, configuration and playback failures fall back to Web Speech; if that is unavailable too, the subtitle remains and the scene advances.

The free ElevenLabs plan is suitable for evaluation, but it does not list a commercial license. Re-check licensing before a public/commercial release.
