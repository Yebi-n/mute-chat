const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const themeModule = `package app.mute.chat

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class MuteThemePreferenceModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "MuteThemePreference"

  @ReactMethod
  fun setTheme(themeId: String) {
    reactApplicationContext.getSharedPreferences("mute_theme", Context.MODE_PRIVATE)
      .edit().putString("id", themeId).apply()
  }
}
`;

const themePackage = `package app.mute.chat

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class MuteThemePreferencePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(MuteThemePreferenceModule(reactContext))
  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
`;

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function replaceOrWriteStyle(file) {
  if (!fs.existsSync(file)) return;
  let contents = fs.readFileSync(file, "utf8");
  contents = contents.replace(
    /<style name="Theme\.App\.SplashScreen" parent="AppTheme">[\s\S]*?<\/style>/,
    `<style name="Theme.App.SplashScreen" parent="AppTheme">
    <item name="android:windowBackground">@android:color/transparent</item>
  </style>`,
  );
  fs.writeFileSync(file, contents);
}

module.exports = function withAndroidMuteTheme(config) {
  return withDangerousMod(config, ["android", async (mod) => {
    const root = mod.modRequest.platformProjectRoot;
    const javaRoot = path.join(root, "app", "src", "main", "java", "app", "mute", "chat");
    write(path.join(javaRoot, "MuteThemePreferenceModule.kt"), themeModule);
    write(path.join(javaRoot, "MuteThemePreferencePackage.kt"), themePackage);

    const applicationPath = path.join(javaRoot, "MainApplication.kt");
    let application = fs.readFileSync(applicationPath, "utf8");
    if (!application.includes("add(MuteThemePreferencePackage())")) {
      application = application.replace(
        "// add(MyReactNativePackage())",
        "add(MuteThemePreferencePackage())",
      );
      fs.writeFileSync(applicationPath, application);
    }

    const activityPath = path.join(javaRoot, "MainActivity.kt");
    let activity = fs.readFileSync(activityPath, "utf8");
    if (!activity.includes("import android.graphics.Color")) {
      activity = activity.replace(
        "import android.os.Bundle",
        "import android.os.Bundle\nimport android.graphics.Color\nimport android.graphics.drawable.GradientDrawable",
      );
    }
    if (!activity.includes("window.setDecorFitsSystemWindows(true)")) {
      activity = activity.replace(
        /setTheme\(R\.style\.AppTheme\);?/,
        `setTheme(R.style.AppTheme)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      window.setDecorFitsSystemWindows(true)
    }`,
      );
    }
    if (!activity.includes("window.setBackgroundDrawable(createStoredThemeBackground())")) {
      activity = activity.replace(
        /setTheme\(R\.style\.AppTheme\)[\s\S]*?if \(Build\.VERSION\.SDK_INT >= Build\.VERSION_CODES\.R\) \{\n      window\.setDecorFitsSystemWindows\(true\)\n    \}/,
        `setTheme(R.style.AppTheme)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      window.setDecorFitsSystemWindows(true)
    }
    window.setBackgroundDrawable(createStoredThemeBackground())`,
      );
    }
    if (!activity.includes("createStoredThemeBackground")) {
      activity = activity.replace("\n  /**\n   * Returns the name", `
  private fun createStoredThemeBackground(): GradientDrawable {
    val themeId = getSharedPreferences("mute_theme", MODE_PRIVATE).getString("id", "mint") ?: "mint"
    val colors = when (themeId) {
      "ocean" -> intArrayOf(Color.parseColor("#82B4D3"), Color.parseColor("#6898C9"))
      "lavender" -> intArrayOf(Color.parseColor("#B3A1D1"), Color.parseColor("#9C87C4"))
      "sunset" -> intArrayOf(Color.parseColor("#E4A095"), Color.parseColor("#DB8592"))
      "mono" -> intArrayOf(Color.parseColor("#747A7E"), Color.parseColor("#585D61"))
      "white" -> intArrayOf(Color.WHITE, Color.WHITE)
      "dark" -> intArrayOf(Color.parseColor("#222222"), Color.parseColor("#222222"))
      else -> intArrayOf(Color.parseColor("#82B9C1"), Color.parseColor("#5DBB8C"))
    }
    return GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, colors)
  }

  /**
   * Returns the name`);
    }
    fs.writeFileSync(activityPath, activity);

    write(path.join(root, "app", "src", "main", "res", "values-v31", "styles.xml"), `<resources>
  <style name="Theme.App.SplashScreen" parent="AppTheme">
    <item name="android:windowSplashScreenBackground">@android:color/transparent</item>
    <item name="android:windowSplashScreenAnimatedIcon">@drawable/splashscreen_logo</item>
    <item name="android:windowSplashScreenIconBackgroundColor">@android:color/transparent</item>
    <item name="android:windowSplashScreenAnimationDuration">0</item>
    <item name="android:windowBackground">@android:color/transparent</item>
  </style>
</resources>\n`);
    write(path.join(root, "app", "src", "main", "res", "drawable", "native_splash_blank_icon.xml"), `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="1dp"
    android:height="1dp"
    android:viewportWidth="1"
    android:viewportHeight="1">
  <path android:fillColor="#00FFFFFF" android:pathData="M0,0h1v1h-1z" />
</vector>\n`);
    replaceOrWriteStyle(path.join(root, "app", "src", "main", "res", "values", "styles.xml"));
    write(path.join(root, "app", "src", "main", "res", "drawable", "ic_launcher_background.xml"), `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:drawable="@color/iconBackground" />
</layer-list>\n`);

    return mod;
  }]);
};
