SAFETY FIRST

GPS / LOCATION SETUP
- Open Map and tap ENABLE GPS & LOCATION.
- Allow Precise Location when Android asks.
- If location is off, tap OPEN LOCATION SETTINGS and enable Location/GPS.
- A native Android wrapper should implement requestLocationPermission() and openLocationSettings().
- For background journey tracking, the native APK must declare and request appropriate Android location permissions and foreground-service support.

SOS
- SOS calls the saved primary contact. A true silent direct call requires native CALL_PHONE permission and an Android.callPhone(phone) bridge.
