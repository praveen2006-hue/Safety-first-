# SAFETY FIRST - Native Android Emergency Voice

Package: `com.herguard.safety`

## Emergency Voice Flow

1. User taps SOS once.
2. App gets the best available GPS location.
3. App sends the primary SOS contact and location to the secure backend.
4. Backend asks Exotel to call the trusted contact.
5. When the contact answers, Exotel opens a bidirectional audio stream.
6. OpenAI Realtime acts as SAFETY FIRST Emergency Voice Assistant.
7. The assistant announces the SOS, explains that the user may be unable to speak, gives the available location, and listens for the contact's response.

## What must still be supplied by the app owner

- Exotel Account SID, API Key, API Token and ExoPhone.
- Exotel AgentStream / Connect Voice AI enablement.
- OpenAI API key.
- A public HTTPS/WSS server URL.

These are account credentials and cannot be generated inside the project. Keep them on the server, never in the APK.

See `voice-backend/README.md` for exact deployment steps.


## Final SOS behavior

The SOS button is one-tap. When a primary contact is configured, the Android app sends the contact number to the backend immediately. The backend places an outbound Exotel Connect Voice AI call; after answer, Exotel opens a bidirectional WebSocket to `/stream`, and the OpenAI Realtime agent speaks the emergency announcement and listens for the contact. The app does not wait up to several seconds for GPS before starting the emergency call; it uses a cached location when available and refreshes GPS in parallel.

If the backend is not configured, the Android app falls back to the native direct call to the primary contact.
