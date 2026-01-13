import { RouterProvider } from 'react-router-dom';
import { useEffect, useRef, useCallback } from 'react';
import { router } from './router';
import { useThemeStore } from './store/theme-store';
import { useSidebarStore } from './store/sidebar-store';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapacitorApp } from '@capacitor/app';

// Declare the ThemeInterface for TypeScript
declare global {
  interface Window {
    ThemeInterface?: {
      setDarkTheme: (isDark: boolean) => void;
    };
  }
}

function App() {
  const theme = useThemeStore((state) => state.theme);
  const { isOpen: sidebarOpen, close: closeSidebar } = useSidebarStore();
  const lastBackPressRef = useRef<number>(0);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Use ref to track sidebar state in callback to avoid stale closure
  const sidebarOpenRef = useRef(sidebarOpen);
  useEffect(() => {
    sidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen]);

  // Apply theme class to document
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  // Setup status bar and navigation bar for native platforms
  useEffect(() => {
    const setupBars = async () => {
      if (Capacitor.isNativePlatform()) {
        const isDark = theme === 'dark';
        
        // Update native Android system bars via JavaScript interface
        if (Capacitor.getPlatform() === 'android' && window.ThemeInterface) {
          try {
            window.ThemeInterface.setDarkTheme(isDark);
          } catch (error) {
            console.error('ThemeInterface setup failed:', error);
          }
        }
        
        try {
          // Always use Style.Light (which gives dark/black icons on Huawei/HarmonyOS)
          // since Huawei always shows white status bar background
          await StatusBar.setStyle({
            style: Style.Light
          });
          
          // Try to set status bar background color (may be ignored by Huawei/HarmonyOS)
          await StatusBar.setBackgroundColor({
            color: isDark ? '#1f2937' : '#ffffff'
          });
          
          // Make sure status bar is NOT overlaying the WebView
          await StatusBar.setOverlaysWebView({ overlay: false });
        } catch (error) {
          console.error('StatusBar setup failed:', error);
        }
        
        // Also update meta theme-color
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (!metaThemeColor) {
          metaThemeColor = document.createElement('meta');
          metaThemeColor.setAttribute('name', 'theme-color');
          document.head.appendChild(metaThemeColor);
        }
        metaThemeColor.setAttribute('content', isDark ? '#111827' : '#f3f4f6');
      }
    };

    setupBars();
  }, [theme]);

  // Show toast message
  const showToast = useCallback((message: string) => {
    // Remove existing toast if any
    const existingToast = document.getElementById('back-toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    // Clear existing timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    
    // Create toast element with stable positioning
    const toast = document.createElement('div');
    toast.id = 'back-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 0;
      right: 0;
      display: flex;
      justify-content: center;
      pointer-events: none;
      z-index: 9999;
    `;
    
    // Create inner toast content
    const toastContent = document.createElement('div');
    toastContent.style.cssText = `
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      opacity: 0;
      transition: opacity 0.2s ease;
    `;
    toastContent.textContent = message;
    toast.appendChild(toastContent);
    
    document.body.appendChild(toast);
    
    // Trigger fade in after a small delay to ensure the element is rendered
    requestAnimationFrame(() => {
      toastContent.style.opacity = '1';
    });
    
    // Remove toast after 2 seconds
    toastTimeoutRef.current = setTimeout(() => {
      toastContent.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, 2000);
  }, []);

  // Handle back button for native platforms
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let backButtonListener: { remove: () => void } | null = null;

    const setupBackButton = async () => {
      try {
        backButtonListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
          // First check if sidebar is open - close it instead of going back
          if (sidebarOpenRef.current) {
            closeSidebar();
            return;
          }
          
          // Get current path
          const currentPath = window.location.pathname;
          const isHomePage = currentPath === '/' || currentPath === '';
          
          // If we can go back in browser history, do that
          if (canGoBack && !isHomePage) {
            window.history.back();
            return;
          }
          
          // If on home page, implement double-tap to exit
          const now = Date.now();
          const timeSinceLastBack = now - lastBackPressRef.current;
          
          if (timeSinceLastBack < 2000) {
            // Second press within 2 seconds - exit app
            CapacitorApp.exitApp();
          } else {
            // First press - show toast
            lastBackPressRef.current = now;
            showToast('再按一次退出应用');
          }
        });
      } catch (error) {
        console.error('Back button listener setup failed:', error);
      }
    };

    setupBackButton();

    return () => {
      backButtonListener?.remove();
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [showToast, closeSidebar]);

  return <RouterProvider router={router} />;
}

export default App;
