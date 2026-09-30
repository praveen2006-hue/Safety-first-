package com.herguard.safety;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.GeolocationPermissions;
import android.widget.Toast;
import java.util.Locale;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final int REQ_CALL = 201;
    private static final int REQ_LOCATION = 202;
    private WebView webView;
    private String pendingPhone;
    private TextToSpeech tts;

    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(android.graphics.Color.rgb(6,43,87));
        getWindow().setNavigationBarColor(android.graphics.Color.rgb(6,43,87));
        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setGeolocationEnabled(true);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (android.os.Build.VERSION.SDK_INT < 23 ||
                    (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                     checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED)) {
                    callback.invoke(origin, true, false);
                } else {
                    callback.invoke(origin, false, false);
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
                }
            }
        });
        webView.addJavascriptInterface(new Bridge(), "Android");
        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
        tts = new TextToSpeech(this, status -> { if (status == TextToSpeech.SUCCESS) tts.setLanguage(Locale.US); });
    }

    public class Bridge {
        @JavascriptInterface public void callPhone(String phone) {
            if (phone == null || phone.trim().length() < 7) return;
            pendingPhone = phone.replaceAll("[^+0-9]", "");
            if (android.os.Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.CALL_PHONE}, REQ_CALL);
            } else placeDirectCall(pendingPhone);
        }
        @JavascriptInterface public void requestLocationPermission() {
            if (android.os.Build.VERSION.SDK_INT >= 23) requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
        }
        @JavascriptInterface public void openLocationSettings() {
            try { startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)); } catch (Exception ignored) {}
        }
        @JavascriptInterface public void speakEmergency(String message) {
            // Local safety announcement only. Android does not allow ordinary apps to inject TTS into a cellular call uplink.
            try { if (tts != null) { tts.stop(); tts.speak(message, TextToSpeech.QUEUE_FLUSH, null, "SAFETY FIRST_SOS"); } } catch (Exception ignored) {}
        }
        @JavascriptInterface public void triggerCloudSOS(String backendUrl, String payload) {
            if (backendUrl == null || backendUrl.contains("YOUR-DOMAIN")) {
                Toast.makeText(MainActivity.this, "Configure the SAFETY FIRST emergency backend URL", Toast.LENGTH_LONG).show();
                return;
            }
            new Thread(() -> {
                HttpURLConnection c = null;
                try {
                    URL u = new URL(backendUrl);
                    c = (HttpURLConnection) u.openConnection();
                    c.setRequestMethod("POST"); c.setConnectTimeout(8000); c.setReadTimeout(12000);
                    c.setDoOutput(true); c.setRequestProperty("Content-Type", "application/json");
                    try(OutputStream os=c.getOutputStream()){ os.write(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8)); }
                    int code=c.getResponseCode();
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, code>=200 && code<300 ? "Emergency voice call requested" : "Emergency voice service unavailable", Toast.LENGTH_LONG).show());
                } catch(Exception e) {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "Emergency voice service unavailable", Toast.LENGTH_LONG).show());
                } finally { if(c!=null)c.disconnect(); }
            }).start();
        }

        @JavascriptInterface public void shareLocation(String text) {
            Intent i = new Intent(Intent.ACTION_SEND); i.setType("text/plain"); i.putExtra(Intent.EXTRA_TEXT, text); startActivity(Intent.createChooser(i, "Share emergency location"));
        }
    }

    private void placeDirectCall(String phone) {
        try { startActivity(new Intent(Intent.ACTION_CALL, Uri.parse("tel:" + phone))); }
        catch (Exception e) { Toast.makeText(this, "Unable to start call", Toast.LENGTH_SHORT).show(); }
    }
    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == REQ_CALL && results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED && pendingPhone != null) placeDirectCall(pendingPhone);
        if (requestCode == REQ_LOCATION && webView != null) webView.evaluateJavascript("if(window.onNativeLocationPermission)window.onNativeLocationPermission();", null);
    }
    @Override protected void onDestroy() { if (tts != null) { tts.stop(); tts.shutdown(); } if (webView != null) webView.destroy(); super.onDestroy(); }
}
