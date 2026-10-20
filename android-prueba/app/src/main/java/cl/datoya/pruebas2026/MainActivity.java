package cl.datoya.pruebas2026;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

public class MainActivity extends Activity {
  private static final String HOME = "https://www.datoya.cl/";
  private static final int FILE_CHOOSER = 42;
  private static final int LOCATION_REQUEST = 43;
  private WebView webView;
  private ValueCallback<Uri[]> uploadCallback;
  private GeolocationPermissions.Callback pendingGeoCallback;
  private String pendingGeoOrigin;

  private boolean isTrustedOrigin(String origin) {
    Uri u = Uri.parse(origin);
    String host = u.getHost();
    return "https".equalsIgnoreCase(u.getScheme()) && host != null
        && (host.equalsIgnoreCase("datoya.cl") || host.equalsIgnoreCase("www.datoya.cl"));
  }

  private boolean hasLocationPermission() {
    return checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
  }

  private TextView splashText(String value, int size, int color) {
    TextView t = new TextView(this);
    t.setText(value);
    t.setTextSize(size);
    t.setTextColor(color);
    t.setGravity(Gravity.CENTER);
    return t;
  }

  @Override public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getWindow().setStatusBarColor(Color.rgb(16,43,53));
    getWindow().setNavigationBarColor(Color.rgb(16,43,53));
    getWindow().getDecorView().setSystemUiVisibility(0);
    getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

    final FrameLayout root = new FrameLayout(this);
    root.setBackgroundColor(Color.rgb(16,43,53));
    // Account for status bar, front camera cutout and navigation area (Android 15+ edge-to-edge).
    root.setOnApplyWindowInsetsListener((v, insets) -> {
      int left, top, right, bottom;
      if (android.os.Build.VERSION.SDK_INT >= 30) {
        android.graphics.Insets safe = insets.getInsets(
            WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
        left = safe.left; top = safe.top; right = safe.right; bottom = safe.bottom;
      } else {
        left = insets.getSystemWindowInsetLeft();
        top = insets.getSystemWindowInsetTop();
        right = insets.getSystemWindowInsetRight();
        bottom = insets.getSystemWindowInsetBottom();
      }
      root.setPadding(left, top, right, bottom);
      return insets;
    });

    webView = new WebView(this);
    webView.setBackgroundColor(Color.WHITE);
    root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
    setContentView(root);
    root.requestApplyInsets();

    final LinearLayout splash = new LinearLayout(this);
    splash.setOrientation(LinearLayout.VERTICAL);
    splash.setGravity(Gravity.CENTER);
    splash.setPadding(36, 36, 36, 36);
    splash.setBackgroundColor(Color.rgb(16,43,53));
    ImageView logo = new ImageView(this);
    logo.setImageResource(R.drawable.datoya_original);
    logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
    LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(
        (int)(152 * getResources().getDisplayMetrics().density),
        (int)(152 * getResources().getDisplayMetrics().density));
    splash.addView(logo, logoParams);
    TextView brand = splashText("DatoYa", 37, Color.WHITE);
    brand.setTypeface(null, 1);
    brand.setPadding(0, 18, 0, 22);
    splash.addView(brand);
    TextView welcome = splashText("¡Bienvenido a DatoYa!", 21, Color.WHITE);
    splash.addView(welcome);
    TextView subtitle = splashText("Encuentra, publica y conecta con negocios cerca de ti", 15, Color.rgb(205,234,232));
    subtitle.setPadding(0, 12, 0, 0);
    splash.addView(subtitle);
    root.addView(splash, new FrameLayout.LayoutParams(-1, -1));

    final long openedAt = SystemClock.uptimeMillis();
    final Handler handler = new Handler(Looper.getMainLooper());
    final boolean[] splashClosed = {false};
    Runnable closeSplash = () -> {
      if (splashClosed[0]) return;
      splashClosed[0] = true;
      splash.animate().alpha(0f).setDuration(300)
          .withEndAction(() -> root.removeView(splash)).start();
    };

    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setGeolocationEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(true);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

    webView.setWebViewClient(new WebViewClient() {
      @Override public void onPageFinished(WebView view, String url) {
        long elapsed = SystemClock.uptimeMillis() - openedAt;
        handler.postDelayed(closeSplash, Math.max(0, 1200 - elapsed));
      }
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
        Uri u = req.getUrl();
        String host = u.getHost();
        if ("https".equalsIgnoreCase(u.getScheme()) && host != null
            && (host.equalsIgnoreCase("datoya.cl") || host.toLowerCase(java.util.Locale.ROOT).endsWith(".datoya.cl"))) {
          return false;
        }
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
        return true;
      }
    });
    webView.setWebChromeClient(new WebChromeClient() {
      @Override public void onGeolocationPermissionsShowPrompt(
          String origin, GeolocationPermissions.Callback callback) {
        if (!isTrustedOrigin(origin)) {
          callback.invoke(origin, false, false);
          return;
        }
        if (hasLocationPermission()) {
          callback.invoke(origin, true, false);
        } else {
          pendingGeoOrigin = origin;
          pendingGeoCallback = callback;
          requestPermissions(new String[]{
              Manifest.permission.ACCESS_COARSE_LOCATION,
              Manifest.permission.ACCESS_FINE_LOCATION
          }, LOCATION_REQUEST);
        }
      }
      @Override public boolean onShowFileChooser(WebView view,
          ValueCallback<Uri[]> callback, FileChooserParams params) {
        if (uploadCallback != null) uploadCallback.onReceiveValue(null);
        uploadCallback = callback;
        try { startActivityForResult(params.createIntent(), FILE_CHOOSER); }
        catch (Exception ex) {
          uploadCallback = null; callback.onReceiveValue(null); return false;
        }
        return true;
      }
    });
    if (savedInstanceState != null) webView.restoreState(savedInstanceState);
    else webView.loadUrl(HOME);
  }

  @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grants) {
    super.onRequestPermissionsResult(requestCode, permissions, grants);
    if (requestCode == LOCATION_REQUEST && pendingGeoCallback != null) {
      pendingGeoCallback.invoke(pendingGeoOrigin, hasLocationPermission(), false);
      pendingGeoCallback = null;
      pendingGeoOrigin = null;
    }
  }

  @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode == FILE_CHOOSER && uploadCallback != null) {
      uploadCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
      uploadCallback = null;
    }
  }
  @Override public void onBackPressed() {
    if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
  }
  @Override protected void onDestroy() {
    if (pendingGeoCallback != null) {
      pendingGeoCallback.invoke(pendingGeoOrigin, false, false);
      pendingGeoCallback = null;
    }
    if (webView != null) webView.destroy();
    super.onDestroy();
  }
}
