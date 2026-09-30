# SAFETY FIRST Emergency Voice Backend

This backend implements the requested emergency flow:

SOS in Android app -> backend -> Exotel outbound call -> trusted contact answers -> Exotel bidirectional audio stream -> OpenAI Realtime voice agent speaks and listens -> current location is provided.

## Important

This is a trusted-contact emergency voice feature. It does not call police/112 automatically.

### Accounts required
1. Exotel account with an ExoPhone and AgentStream / Connect Voice AI enabled.
2. OpenAI API account with API access to a Realtime model.
3. A public HTTPS/WSS Node hosting service (Render is supported by the included `render.yaml`).

Do NOT put Exotel or OpenAI secrets in the Android APK.

## Deploy on Render

1. Put this `voice-backend` folder in a GitHub repository.
2. In Render, create a Web Service from the repository.
3. Root Directory: `voice-backend`.
4. Build command: `npm install`.
5. Start command: `npm start`.
6. Add the environment variables from `.env.example`.
7. Set `PUBLIC_BASE_URL` to the final HTTPS Render URL, e.g. `https://safety-first-emergency-voice.onrender.com`.
8. Confirm `GET /health` returns `{\"ok\":true,...}`.

The server exposes:
- `POST /sos` - requests an Exotel outbound AI voice call.
- `GET /health` - health check.
- `POST /exotel/status` - Exotel terminal status callback.
- `WS /stream` - Exotel bidirectional media stream.

The server converts Exotel 8 kHz PCM/μ-law media to the G.711 μ-law format accepted by OpenAI Realtime and converts assistant μ-law audio back to the Exotel stream format. The stream URL is generated as `wss://.../stream?sample-rate=8000...`, which is required for a secure public WebSocket endpoint.


## Exotel setup

Use Exotel's Connect Voice AI API with `StreamType=bidirectional`. The account must have the AgentStream/Voice AI feature enabled. The Exotel ExoPhone is the caller ID.

## Android setup

Set:

`app/src/main/assets/config.js`

```js
window.HERGUARD_BACKEND_URL = "https://YOUR-RENDER-SERVICE.onrender.com/sos";
```

The Android SOS button sends:
- primary SOS contact phone
- user name
- current latitude
- current longitude

The backend puts those values into the AI's emergency context.
