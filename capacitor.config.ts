import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maotai.ai',
  appName: '茅台 AI',
  webDir: 'dist',
  // Disable WebView zoom
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      launchFadeOutDuration: 0,
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false
    },
    Camera: {
      // Use Android Photo Picker for Android 13+
      androidPhotoPicker: true
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    }
  }
};

export default config;
