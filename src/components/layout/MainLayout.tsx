/**
 * Main Layout Component
 * 
 * Root layout with drawer sidebar and main content area.
 * Mobile-optimized with hamburger menu on left, model selector on right.
 * Supports light/dark theme.
 * Handles safe area insets for notch devices and navigation bars.
 * 
 * Requirements: 8.1, 8.2
 */
import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Sidebar } from './Sidebar';
import { useConfigStore, getDefaultConfig } from '../../store/config-store';
import { useThemeStore } from '../../store/theme-store';

// Check if running on native platform
const isNative = Capacitor.isNativePlatform();

export const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const location = useLocation();
  
  const { configs, setDefault } = useConfigStore();
  const defaultConfig = useConfigStore(getDefaultConfig);
  const { theme, toggleTheme } = useThemeStore();
  
  const isSettingsPage = location.pathname === '/settings';
  const isDark = theme === 'dark';

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
  }, [isSettingsPage, location.state]);

  // Handle status bar style based on theme and sidebar state
  useEffect(() => {
    if (isNative) {
      const updateStatusBar = async () => {
        try {
          // Style.Light = 浅色文字/图标（用于深色背景）
          // Style.Dark = 深色文字/图标（用于浅色背景）
          // 深色模式：深色背景 -> 需要浅色文字 -> Style.Light
          // 浅色模式：浅色背景 -> 需要深色文字 -> Style.Dark
          await StatusBar.setStyle({
            style: isDark ? Style.Light : Style.Dark
          });
          
          // Set status bar background color
          await StatusBar.setBackgroundColor({
            color: isDark ? '#111827' : '#ffffff'
          });
        } catch (error) {
          console.log('StatusBar update failed:', error);
        }
      };
      
      updateStatusBar();
    }
    
    // Update meta theme-color for web
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isDark ? '#111827' : '#ffffff');
    }
  }, [isDark, sidebarOpen]);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  const handleSelectModel = async (configId: string) => {
    setDefault(configId);
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
          {/* Model selector - only show on chat page */}
          {!isSettingsPage && configs.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm ${isDark ? 'text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200'} rounded-lg transition-colors`}
              >
                <span className="max-w-[120px] truncate">
                  {defaultConfig?.name || '选择模型'}
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
                          config.isDefault 
                            ? isDark ? 'bg-gray-700' : 'bg-blue-50'
                            : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex-1 min-w-0 mr-2">
                          <div className={`truncate ${config.isDefault ? (isDark ? 'text-white' : 'text-blue-700') : ''}`}>{config.name}</div>
                          <div className={`text-xs truncate ${config.isDefault ? (isDark ? 'text-gray-400' : 'text-blue-500') : 'opacity-70'}`}>{config.modelName}</div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          config.isDefault 
                            ? 'border-blue-500 bg-blue-500' 
                            : isDark ? 'border-gray-500' : 'border-gray-300'
                        }`}>
                          {config.isDefault && (
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
