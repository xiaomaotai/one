package com.maotai.ai;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private WindowInsetsControllerCompat insetsController;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Let the system handle window insets (not edge-to-edge)
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        
        // Get insets controller for controlling system bar appearance
        Window window = getWindow();
        View decorView = window.getDecorView();
        insetsController = WindowCompat.getInsetsController(window, decorView);
        
        // Setup system bars - always use dark icons since Huawei/HarmonyOS 
        // always has white status bar background
        setupSystemBars(true);
    }
    
    private void setupSystemBars(boolean isDarkTheme) {
        Window window = getWindow();
        
        // Set navigation bar color based on theme
        if (isDarkTheme) {
            window.setNavigationBarColor(Color.parseColor("#111827"));
        } else {
            window.setNavigationBarColor(Color.parseColor("#f3f4f6"));
        }
        
        if (insetsController != null) {
            // Always use dark/black status bar icons since Huawei/HarmonyOS
            // always shows white status bar background regardless of app settings
            // false = dark/black icons (opposite of what the name suggests on some devices)
            insetsController.setAppearanceLightStatusBars(false);
            
            // Navigation bar icons based on theme
            insetsController.setAppearanceLightNavigationBars(isDarkTheme);
        }
        
        // Try to set status bar color (may be ignored by Huawei/HarmonyOS)
        if (isDarkTheme) {
            window.setStatusBarColor(Color.parseColor("#1f2937"));
        } else {
            window.setStatusBarColor(Color.parseColor("#ffffff"));
        }
    }
    
    // Method to be called from JavaScript to update system bars
    public void updateTheme(boolean isDarkTheme) {
        runOnUiThread(() -> setupSystemBars(isDarkTheme));
    }
    
    @Override
    public void onStart() {
        super.onStart();
        // Disable WebView zoom
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            settings.setSupportZoom(false);
            settings.setBuiltInZoomControls(false);
            settings.setDisplayZoomControls(false);
            
            // Add JavaScript interface for theme updates
            webView.addJavascriptInterface(new ThemeInterface(), "ThemeInterface");
        }
    }
    
    // JavaScript interface for updating theme from web
    private class ThemeInterface {
        @android.webkit.JavascriptInterface
        public void setDarkTheme(boolean isDark) {
            updateTheme(isDark);
        }
    }
}
