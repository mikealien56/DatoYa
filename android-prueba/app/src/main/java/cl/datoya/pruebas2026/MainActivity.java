package cl.datoya.pruebas2026;

import android.app.Activity;
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
    webView = new WebView(this);
    webView.setBackgroundColor(0xFFFFFFFF);
    setContentView(webView);
    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(true);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
    webView.setWebViewClient(new WebViewClient() {
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
