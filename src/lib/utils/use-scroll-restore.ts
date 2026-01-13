/**
 * Custom hook for saving and restoring scroll position
 * when app is backgrounded/resumed on mobile devices.
 */
import { useRef, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export function useScrollRestore(containerRef: React.RefObject<HTMLElement | null>) {
  const savedScrollPositionRef = useRef<number | null>(null);

  // Save current scroll position
  const saveScrollPosition = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      savedScrollPositionRef.current = container.scrollTop;
    }
  }, [containerRef]);

  // Restore saved scroll position
  const restoreScrollPosition = useCallback(() => {
    const container = containerRef.current;
    if (container && savedScrollPositionRef.current !== null) {
      const savedPosition = savedScrollPositionRef.current;
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = savedPosition;
        }
        // Double-check after a short delay (for WebView quirks)
        setTimeout(() => {
          if (container) {
            container.scrollTop = savedPosition;
          }
        }, 50);
        // Triple-check for stubborn WebViews
        setTimeout(() => {
          if (container) {
            container.scrollTop = savedPosition;
          }
        }, 150);
      });
    }
  }, [containerRef]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let stateChangeListener: { remove: () => void } | null = null;

    const setupAppStateListener = async () => {
      try {
        stateChangeListener = await App.addListener('appStateChange', ({ isActive }) => {
          if (!isActive) {
            // App going to background - save scroll position
            saveScrollPosition();
          } else {
            // App coming to foreground - restore scroll position
            restoreScrollPosition();
          }
        });
      } catch (error) {
        console.error('App state listener setup failed:', error);
      }
    };

    setupAppStateListener();

    return () => {
      stateChangeListener?.remove();
    };
  }, [saveScrollPosition, restoreScrollPosition]);

  // Also handle visibility change for web and additional coverage
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveScrollPosition();
      } else {
        restoreScrollPosition();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [saveScrollPosition, restoreScrollPosition]);

  // Handle focus/blur events (additional coverage for input focus scenarios)
  useEffect(() => {
    const handleWindowBlur = () => {
      saveScrollPosition();
    };

    const handleWindowFocus = () => {
      restoreScrollPosition();
    };

    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [saveScrollPosition, restoreScrollPosition]);

  return { saveScrollPosition, restoreScrollPosition };
}