/**
 * Main Layout Component
 * 
 * Root layout with drawer sidebar and main content area.
 * Mobile-optimized with hamburger menu on left, model selector on right.
 * Supports light/dark theme.
 * Handles safe area insets for notch devices and navigation bars.
 * Each session remembers its own model configuration.
 * 
 * Requirements: 8.1, 8.2
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Sidebar } from './Sidebar';
import { useConfigStore } from '../../store/config-store';
import { useChatStore, getCurrentSession } from '../../store/chat-store';
import { useThemeStore } from '../../store/theme-store';
import { useSidebarStore } from '../../store/sidebar-store';
import { chatManager } from '../../lib/chat';

// Check if running on native platform
const isNative = Capacitor.isNativePlatform();

// Declare the ThemeInterface for TypeScript
declare global {
  interface Window {
    ThemeInterface?: {
      setDarkTheme: (isDark: boolean) => void;
    };
  }
}

export const MainLayout: React.FC = () => {
  const { isOpen: sidebarOpen, setOpen: setSidebarOpen, close: closeSidebar, toggle: toggleSidebar } = useSidebarStore();
  const [modelDropdownOpen, setModelDropdownOpen] = React.useState(false);
  const location = useLocation();
  
  const { configs } = useConfigStore();
  const { updateSession } = useChatStore();
  const currentSession = useChatStore(getCurrentSession);
  const { theme, toggleTheme } = useThemeStore();
  
  const isSettingsPage = location.pathname === '/settings';
  const isDark = theme === 'dark';

  // Get the config for current session
  const sessionConfig = useMemo(() => {
    if (!currentSession) return undefined;
    return configs.find(c => c.id === currentSession.configId);
  }, [currentSession, configs]);

  // 记录是否从抽屉进入设置页（通过 location.state 判断）
  const enteredFromDrawer = useRef(false);
  
  useEffect(() => {
    if (isSettingsPage) {
      // 检查是否从抽屉进入（location.state.fromDrawer 为 true）
      enteredFromDrawer.current = location.state?.fromDrawer === true;
    } else if (enteredFromDrawer.current) {
      // 只有从抽屉进入设置页时，返回才打开抽屉
      setSidebarOpen(true);
      enteredFromDrawer.current = false;
    }
  }, [isSettingsPage, location.state, setSidebarOpen]);

  // Handle status bar style based on theme and sidebar state
  useEffect(() => {
    if (isNative) {
      const updateStatusBar = async () => {
        try {
          // For Huawei/HarmonyOS devices, the status bar background is always white
          // So we always use Style.Light which gives dark/black icons on these devices
          // This ensures icons are visible on the white background
          await StatusBar.setStyle({
            style: Style.Light
          });
          
          // Try to set status bar background color (may be ignored by Huawei/HarmonyOS)
          await StatusBar.setBackgroundColor({
            color: isDark ? '#111827' : '#ffffff'
          });
        } catch (error) {
          console.log('StatusBar update failed:', error);
        }
      };
      
      // Also update native Android system bars via JavaScript interface
      if (Capacitor.getPlatform() === 'android' && window.ThemeInterface) {
        try {
          window.ThemeInterface.setDarkTheme(isDark);
        } catch (error) {
          console.error('ThemeInterface update failed:', error);
        }
      }
      
      updateStatusBar();
    }
    
    // Update meta theme-color for web
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isDark ? '#111827' : '#ffffff');
    }
  }, [isDark, sidebarOpen]);

  const handleSelectModel = async (configId: string) => {
    // Update current session's configId
    if (currentSession) {
      try {
        await chatManager.switchSessionConfig(currentSession.id, configId);
        // Update local state
        updateSession(currentSession.id, { configId });
      } catch (error) {
        console.error('切换模型失败:', error);
      }
    }
    setModelDropdownOpen(false);
  };

  return (
    <div className={`h-screen flex flex-col ${isDark ? 'bg-gray-900' : 'bg-white'}`} style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Header with menu button on left, model selector on right */}
      <header className={`h-14 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border-b flex items-center justify-between px-4 shrink-0`}>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className={`p-2 ${isDark ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'} rounded-lg transition-colors`}
            aria-label="打开菜单"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Maotai AI</h1>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Model selector - only show on chat page when there's a session */}
          {!isSettingsPage && configs.length > 0 && currentSession && (
            <div className="relative">
              <button
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm ${isDark ? 'text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200'} rounded-lg transition-colors`}
              >
                <span className="max-w-[120px] truncate">
                  {sessionConfig?.name || '选择模型'}
                </span>
                <svg className={`w-4 h-4 transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Dropdown */}
              {modelDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setModelDropdownOpen(false)}
                  />
                  <div className={`absolute right-0 top-full mt-1 w-56 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg shadow-lg z-50 py-1 max-h-64 overflow-y-auto`}>
                    {configs.map((config) => (
                      <button
                        key={config.id}
                        onClick={() => handleSelectModel(config.id)}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-3 ${
                          config.id === currentSession?.configId 
                            ? isDark ? 'bg-gray-700' : 'bg-blue-50'
                            : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex-1 min-w-0 mr-2">
                          <div className={`truncate ${config.id === currentSession?.configId ? (isDark ? 'text-white' : 'text-blue-700') : ''}`}>{config.name}</div>
                          <div className={`text-xs truncate ${config.id === currentSession?.configId ? (isDark ? 'text-gray-400' : 'text-blue-500') : 'opacity-70'}`}>{config.modelName}</div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          config.id === currentSession?.configId 
                            ? 'border-blue-500 bg-blue-500' 
                            : isDark ? 'border-gray-500' : 'border-gray-300'
                        }`}>
                          {config.id === currentSession?.configId && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* Theme toggle button */}
          <button
            onClick={toggleTheme}
            className={`p-2 ${isDark ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'} rounded-lg transition-colors`}
            aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
          >
            {isDark ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className={`flex-1 overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <Outlet />
      </main>

      {/* Overlay backdrop */}
      {sidebarOpen && (
        <div
          className={`fixed inset-0 z-40 ${isDark ? 'bg-black bg-opacity-50' : 'bg-gray-500 bg-opacity-30'}`}
          onClick={closeSidebar}
        />
      )}

      {/* Drawer sidebar - slides from left */}
      <div
        className={`fixed top-0 left-0 h-full w-72 ${isDark ? 'bg-gray-900' : 'bg-white'} z-50 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <Sidebar onClose={closeSidebar} />
      </div>
    </div>
  );
};
