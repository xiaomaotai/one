// Router configuration with code splitting
import React, { Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { MainLayout } from '../components/layout';
import { ChatPage } from '../pages';

// Lazy load non-critical pages for better initial load performance
const SettingsPage = React.lazy(() =>
  import('../pages/SettingsPage').then(module => ({ default: module.SettingsPage }))
);

// Loading fallback component
const PageLoader: React.FC = () => (
  <div className="flex-1 flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <svg
        className="animate-spin h-8 w-8 text-blue-500"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="text-sm text-gray-500">加载中...</span>
    </div>
  </div>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <ChatPage />,
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<PageLoader />}>
            <SettingsPage />
          </Suspense>
        ),
      },
    ],
  },
]);
