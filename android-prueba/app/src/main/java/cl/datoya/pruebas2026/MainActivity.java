package cl.datoya.pruebas2026;

import android.app.Activity;
import android.graphics.Color;
import android.view.Window;
import android.view.WindowManager;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.view.Gravity;
import android.os.Handler;
import android.os.Looper;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.ValueCallback;

public class MainActivity extends Activity {
  private WebView webView;
  private ValueCallback<Uri[]> uploadCallback;
  private static final int FILE_CHOOSER = 42;
  private static final String HOME = "https://www.datoya.cl/";
  @Override public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Keep both system bars visible and reserve their safe area.
    getWindow().setStatusBarColor(Color.rgb(16,43,53));
    getWindow().setNavigationBarColor(Color.rgb(16,43,53));
    getWindow().getDecorView().setSystemUiVisibility(0);
    getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
    webView = new WebView(this);
    webView.setBackgroundColor(0xFFFFFFFF);
    FrameLayout root = new FrameLayout(this);
    root.setFitsSystemWindows(true);
    root.addView(webView, new FrameLayout.LayoutParams(-1,-1));
    setContentView(root);
    // Branded loading overlay, removed after the page finishes loading.
    final LinearLayout splash = new LinearLayout(this);
    splash.setOrientation(LinearLayout.VERTICAL);
    splash.setGravity(Gravity.CENTER);
    splash.setPadding(34,34,34,34);
    splash.setBackgroundColor(Color.rgb(16,43,53));
    TextView brand = new TextView(this);
    brand.setText("DatoYa");
    brand.setTextColor(Color.WHITE);
    brand.setTextSize(42);
    brand.setGravity(Gravity.CENTER);
    brand.setTypeface(null,1);
    splash.addView(brand);
    TextView title = new TextView(this);
    title.setText("¡Bienvenido a DatoYa!");
    title.setTextColor(Color.WHITE);
    title.setTextSize(22);
    title.setGravity(Gravity.CENTER);
    title.setPadding(0,30,0,12);
    splash.addView(title);
    TextView subtitle = new TextView(this);
    subtitle.setText("Encuentra, publica y conecta con negocios cerca de ti");
    subtitle.setTextColor(Color.rgb(205,234,232));
    subtitle.setTextSize(15);
    subtitle.setGravity(Gravity.CENTER);
    splash.addView(subtitle);
    root.addView(splash,new FrameLayout.LayoutParams(-1,-1));
    final Handler uiHandler = new Handler(Looper.getMainLooper());
    final long startTime = android.os.SystemClock.uptimeMillis();
    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(true);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
    webView.setWebViewClient(new WebViewClient() {
      @Override public void onPageFinished(WebView view, String url) {
        long elapsed = android.os.SystemClock.uptimeMillis() - startTime;
        uiHandler.postDelayed(() -> {
          splash.animate().alpha(0f).setDuration(280).withEndAction(() -> root.removeView(splash)).start();
        }, Math.max(0, 1200 - elapsed));
      }
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
        Uri u = req.getUrl();
        String host = u.getHost();
        if ("https".equalsIgnoreCase(u.getScheme()) && host != null && (host.equals("datoya.cl") || host.endsWith(".datoya.cl"))) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch(Exception ignored) { }
        return true;
      }
    });
    webView.setWebChromeClient(new WebChromeClient() {
      @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
        if (uploadCallback != null) uploadCallback.onReceiveValue(null);
        uploadCallback = callback;
        try { startActivityForResult(params.createIntent(), FILE_CHOOSER); }
        catch(Exception ex) { uploadCallback = null; callback.onReceiveValue(null); return false; }
        return true;
      }
    });
    if (savedInstanceState != null) webView.restoreState(savedInstanceState); else webView.loadUrl(HOME);
  }
  @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if(requestCode == FILE_CHOOSER && uploadCallback != null) {
      uploadCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
      uploadCallback = null;
    }
  }
  @Override public void onBackPressed() {
    if(webView.canGoBack()) webView.goBack(); else super.onBackPressed();
  }
  @Override protected void onDestroy() {
    if(webView != null) webView.destroy();
    super.onDestroy();
  }
}
