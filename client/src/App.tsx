import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import { pingHealth } from './lib/api-client';
import { queryClient } from './lib/query-client';
import { AppRoutes } from './routes';

export default function App() {
  // §9.4: above the auth check and outside every guard, so a sleeping free-tier instance starts
  // waking while the login form is still being read. Mounted any deeper it would fire after
  // /auth/me had already waited out the cold start, which is the request it exists to spare.
  useEffect(() => {
    pingHealth();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
