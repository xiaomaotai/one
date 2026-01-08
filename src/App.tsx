import { RouterProvider } from 'react-router-dom';
import { useEffect } from 'react';
import { router } from './router';
import { useThemeStore } from './store/theme-store';

function App() {
  const theme = useThemeStore((state) => state.theme);

  // Apply theme class to document
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  return <RouterProvider router={router} />;
}

export default App;
