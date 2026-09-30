# SAFETY FIRST Full Setup

## Android
- Package: `com.herguard.safety`
- Version: `1.0.0`
- SOS: one tap -> backend requests Exotel outbound call to primary contact.
- If backend is not configured, SOS falls back to Android `ACTION_CALL`.
- GPS permissions: FINE + COARSE. WebView geolocation permission is also granted after Android runtime permission.

## AI voice call
1. Create an Exotel account and obtain Account SID, API Key, API Token and an ExoPhone. Ask Exotel to enable Connect Voice AI / AgentStream for the account.
2. Create an OpenAI API key with access to a Realtime model.
3. Deploy `voice-backend` to a Node host that supports public HTTPS and WSS (Render can host the HTTP/WebSocket service if the plan/service supports WebSockets).
4. Add environment variables from `voice-backend/.env.example`.
5. Set `PUBLIC_BASE_URL` to the HTTPS base URL of the backend, without `/sos`.
6. Put the final `/sos` URL in `app/src/main/assets/config.js`.
7. Test `GET /health` before testing SOS.

## Required environment
```
EXOTEL_ACCOUNT_SID=
EXOTEL_API_KEY=
EXOTEL_API_TOKEN=
EXOTEL_CALLER_ID=
OPENAI_API_KEY=
OPENAI_REALTIME_MODEL=gpt-realtime-2.1
PUBLIC_BASE_URL=https://your-service.example.com
PORT=8080
```

## Security
Never put Exotel or OpenAI secrets in the Android app. The APK contains only the backend URL.

## Emergency voice behavior
The AI announces that SAFETY FIRST SOS was activated, states only known facts, gives a map link when GPS is available, and can answer the trusted contact. It must not claim that police/ambulance has been dispatched unless an actual integration confirms that.

## Testing
Use only consenting test contacts. First test `/health`, then a test SOS to a phone you control. Confirm that the contact hears the announcement and can speak back.
