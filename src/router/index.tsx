// Router configuration
import { createBrowserRouter } from 'react-router-dom';
import { MainLayout } from '../components/layout';
import { ChatPage, SettingsPage } from '../pages';

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
        element: <SettingsPage />,
      },
    ],
  },
]);
