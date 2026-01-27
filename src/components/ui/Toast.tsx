/**
 * Toast Component
 *
 * Reusable toast notification component for showing brief feedback messages.
 * Supports success and error types with smooth animations.
 * Auto-hides after specified duration.
 *
 * Features:
 * - Accessible with role="alert" and aria-live
 * - Smooth fade-in/fade-out animations
 * - Configurable duration
 * - Imperative API via useToast hook
 */
import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

export interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextValue {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Toast display component
export const Toast: React.FC<ToastState & { onHide?: () => void }> = ({
  message,
  show,
  type,
  onHide
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      // Trigger animation after mount
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    } else if (isVisible) {
      setIsAnimating(false);
      // Wait for fade-out animation
      const timer = setTimeout(() => {
        setIsVisible(false);
        onHide?.();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [show, isVisible, onHide]);

  if (!isVisible) return null;

  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500'
  }[type];

  return (
    <div
      className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-[100] pointer-events-none"
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={`px-4 py-2 rounded-full shadow-lg ${bgColor} text-white text-sm font-medium transition-all duration-200 ${
          isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        {message}
      </div>
    </div>
  );
};

// Toast Provider for global toast management
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'success' });
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Show new toast
    setToast({ show: true, message, type });

    // Auto-hide after 2 seconds
    timerRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toast {...toast} />
    </ToastContext.Provider>
  );
};

// Hook for using toast
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Return a no-op function if used outside provider
    return {
      showToast: (message: string, type?: 'success' | 'error' | 'info') => {
        console.warn('useToast: ToastProvider not found, toast will not be shown:', message, type);
      }
    };
  }
  return context;
};

// Standalone toast hook for components that manage their own toast state
export const useLocalToast = (duration: number = 2000) => {
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'success' });
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setToast({ show: true, message, type });

    timerRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, duration);
  }, [duration]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { toast, showToast, ToastComponent: Toast };
};

export default Toast;
