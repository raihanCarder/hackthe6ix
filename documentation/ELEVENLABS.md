# ElevenLabs presentation audio

ElevenLabs is an optional presentation adapter. It receives deterministic commentary text after
the recommendation engine and game simulation have completed. It cannot set a metric, score a
hotel, choose a match winner, or change the champion.

## Setup

1. Create a restricted ElevenLabs API key with text-to-speech access.
2. Choose a voice in ElevenLabs and copy its voice ID.
3. Copy the ElevenLabs fields from `.env.example` into `.env` and set:

   ```env
   ELEVENLABS_API_KEY="your-key"
   ELEVENLABS_VOICE_ID="your-voice-id"
   ```

4. Apply the audio-cache migration with `npx prisma migrate dev`.
5. Restart `npm run dev` after changing environment variables.

The default model is `eleven_flash_v2_5`, selected for interactive latency and lower per-character
cost. The server uses ElevenLabs' text-to-speech endpoint and checks the subscription allowance on
every cache miss. See the official [create speech API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert),
[model guide](https://elevenlabs.io/docs/overview/models), and
[subscription API](https://elevenlabs.io/docs/api-reference/user/subscription/get).

## Cost controls and caching

- Audio generation is opt-in in the tournament UI. Caption-only requests spend no ElevenLabs credits.
- `ELEVENLABS_MONTHLY_CHARACTER_LIMIT` sets an application-level UTC monthly ceiling.
- `ELEVENLABS_ACCOUNT_CREDIT_RESERVE` protects account-wide allowance when
  `ELEVENLABS_CHECK_ACCOUNT_QUOTA=true`. That optional check requires `user_read` permission.
- Keep the account check off for a least-privilege `text_to_speech`-only key, and set a credit quota
  on that key in ElevenLabs as the external hard limit.
- Generated MP3 data is stored once in `PresentationAudio`. Its SHA-256 key covers the template
  version, exact text, voice, model, and output format.
- `PresentationUsage` counts only successful new generations. Cache hits are free.
- Any missing configuration, exhausted limit, API failure, timeout, or browser autoplay rejection
  leaves deterministic captions available.

## Trusted data boundary

The browser sends only a tournament ID and a lightweight cue, such as two participant IDs. The
server reloads that user's stored tournament and resolves names, scores, winners, champion, and
engine advantages from trusted data. Fixed templates then turn the structured event into a caption.
ElevenLabs receives that caption only; no LLM is asked to invent commentary or hotel facts.

## Optional reusable music

Place licensed or ElevenLabs-generated reusable tracks in `public/audio/`, then configure paths such
as `/audio/intro.mp3` in the three `NEXT_PUBLIC_PRESENTATION_*_MUSIC_URL` variables. Tracks are reused
for intro, final, and victory states; the app never generates music during gameplay.
