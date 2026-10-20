package cl.datoya.pruebas2026;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.view.Gravity;
import android.view.View;
import android.webkit.WebView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONObject;
import org.json.JSONTokener;

/** Toolbar only for the Android shell. Does not change the public website. */
public final class NativeToolbar {
  private final Activity activity;
  private final WebView webView;
  private TextView accountAction;
  private ImageView bell;
  private View unreadDot;
  private boolean loggedIn;

  public NativeToolbar(Activity activity, WebView webView) {
    this.activity = activity;
    this.webView = webView;
  }

  private int dp(float value) {
    return Math.round(value * activity.getResources().getDisplayMetrics().density);
  }

  private GradientDrawable rounded(int fill, int radius) {
    GradientDrawable shape = new GradientDrawable();
    shape.setColor(fill);
    shape.setCornerRadius(dp(radius));
    return shape;
  }

  private ImageView icon(int res, String label, Runnable click) {
    ImageView view = new ImageView(activity);
    view.setImageResource(res);
    view.setPadding(dp(10),dp(10),dp(10),dp(10));
    view.setContentDescription(label);
    view.setBackgroundResource(android.R.drawable.list_selector_background);
    view.setOnClickListener(v -> click.run());
    return view;
  }

  private void go(String route) {
    webView.evaluateJavascript("window.location.hash=" + JSONObject.quote("#/" + route) + ";", null);
    refreshAccount();
  }

  public LinearLayout build() {
    LinearLayout bar = new LinearLayout(activity);
    bar.setOrientation(LinearLayout.HORIZONTAL);
    bar.setGravity(Gravity.CENTER_VERTICAL);
    bar.setPadding(dp(12),0,dp(7),0);
    bar.setBackgroundColor(Color.WHITE);
    bar.setElevation(dp(3));

    ImageView brand = new ImageView(activity);
    brand.setImageResource(R.drawable.datoya_original);
    brand.setScaleType(ImageView.ScaleType.FIT_CENTER);
    brand.setContentDescription("DatoYa, ir al inicio");
    brand.setOnClickListener(v -> go(""));
    bar.addView(brand,new LinearLayout.LayoutParams(dp(38),dp(38)));

    TextView name = new TextView(activity);
    name.setText("DatoYa");
    name.setTextSize(19);
    name.setTextColor(Color.rgb(8,47,93));
    name.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
    name.setGravity(Gravity.CENTER_VERTICAL);
    name.setPadding(dp(7),0,0,0);
    name.setOnClickListener(v -> go(""));
    bar.addView(name,new LinearLayout.LayoutParams(0,-1,1));

    android.widget.FrameLayout notificationArea = new android.widget.FrameLayout(activity);
    bell = icon(R.drawable.dy_bell,"Ver notificaciones",() -> go(loggedIn ? "notificaciones" : "login"));
    notificationArea.addView(bell,new android.widget.FrameLayout.LayoutParams(dp(44),dp(44)));
    unreadDot = new View(activity);
    unreadDot.setBackground(rounded(Color.rgb(225,60,78),10));
    android.widget.FrameLayout.LayoutParams dot = new android.widget.FrameLayout.LayoutParams(dp(8),dp(8),Gravity.TOP|Gravity.RIGHT);
    dot.setMargins(0,dp(5),dp(5),0);
    notificationArea.addView(unreadDot,dot);
    unreadDot.setVisibility(View.GONE);
    bar.addView(notificationArea,new LinearLayout.LayoutParams(dp(44),dp(44)));

    ImageView profile = icon(R.drawable.dy_profile,"Mi perfil",() -> go(loggedIn ? "perfil" : "login"));
    bar.addView(profile,new LinearLayout.LayoutParams(dp(44),dp(44)));

    accountAction = new TextView(activity);
    accountAction.setText("Entrar");
    accountAction.setContentDescription("Ingresar a DatoYa");
    accountAction.setTextColor(Color.rgb(8,67,118));
    accountAction.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
    accountAction.setTextSize(12);
    accountAction.setGravity(Gravity.CENTER);
    accountAction.setBackground(rounded(Color.rgb(230,248,247),14));
    LinearLayout.LayoutParams actionParams = new LinearLayout.LayoutParams(dp(54),dp(34));
    actionParams.setMargins(dp(3),0,0,0);
    bar.addView(accountAction,actionParams);
    accountAction.setOnClickListener(v -> {
      if (loggedIn) confirmLogout();
      else go("login");
    });
    return bar;
  }

  public void applyWebAppLayout() {
    // Hide only the website's duplicated header inside the signed Android app.
    String js = "(function(){var id='datoya-android-shell-css';if(!document.getElementById(id))" +
        "{var s=document.createElement('style');s.id=id;s.textContent='#topbar{display:none!important;}';" +
        "document.head.appendChild(s);}})();";
    webView.evaluateJavascript(js,null);
  }

  public void refreshAccount() {
    String script = "(async function(){try{let r=await fetch('/api/auth/me',{credentials:'same-origin'});" +
        "if(!r.ok)return JSON.stringify({loggedIn:false,unread:0});let d=await r.json();" +
        "return JSON.stringify({loggedIn:!!d.user,unread:Number(d.user?.unread_notifications||0)});" +
        "}catch(e){return JSON.stringify({loggedIn:false,unread:0});}})();";
    webView.evaluateJavascript(script, value -> {
      try {
        Object result = new JSONTokener(value).nextValue();
        JSONObject state = new JSONObject(String.valueOf(result));
        loggedIn = state.optBoolean("loggedIn",false);
        int unread = state.optInt("unread",0);
        activity.runOnUiThread(() -> {
          accountAction.setText(loggedIn ? "Salir" : "Entrar");
          accountAction.setContentDescription(loggedIn ? "Cerrar sesión" : "Ingresar");
          unreadDot.setVisibility(loggedIn && unread > 0 ? View.VISIBLE : View.GONE);
        });
      } catch(Exception ignored) { /* Keep last confirmed state if loading */ }
    });
  }

  private void confirmLogout() {
    new AlertDialog.Builder(activity)
        .setTitle("Cerrar sesión")
        .setMessage("¿Quieres salir de tu cuenta de DatoYa?")
        .setNegativeButton("Cancelar",null)
        .setPositiveButton("Salir",(dialog,which) -> {
          String js = "(async function(){try{let r=await fetch('/api/auth/logout'," +
              "{method:'POST',credentials:'same-origin'});if(!r.ok)return 'error';" +
              "window.location.hash='#/login';window.location.reload();return 'ok';}" +
              "catch(e){return 'error';}})();";
          webView.evaluateJavascript(js,result -> {
            if (result != null && result.contains("error")) {
              Toast.makeText(activity,"No pudimos cerrar la sesión. Inténtalo nuevamente.",Toast.LENGTH_LONG).show();
            } else {
              loggedIn=false;
              activity.runOnUiThread(() -> {
                accountAction.setText("Entrar");
                unreadDot.setVisibility(View.GONE);
              });
            }
          });
        }).show();
  }
}
