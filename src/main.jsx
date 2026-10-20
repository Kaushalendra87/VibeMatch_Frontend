import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AppRoutes } from './routes/AppRoutes'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { RealtimeProvider } from './context/RealtimeContext'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { ApiError } from './services/client'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // One retry, not three. The default of three turns a fast failure
      // into a visible four-second stall before the error state appears,
      // and a 4xx will never succeed on retry.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false
        }
        return failureCount < 1
      },
      staleTime: 30 * 1000,
      // The app has its own live socket for the things that change
      // without user action, so refetching everything on every window
      // focus is wasted traffic.
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/*
      Outermost, so a crash in any provider below — a bad theme value, a
      malformed session payload — is caught rather than blanking the page.
      There is no second boundary above it, so a failure here is the one
      case that still leaves nothing on screen; keeping it outermost is
      what makes that case as small as possible.
    */}
    <ErrorBoundary name="Root">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider>
            {/*
              AuthProvider is outside RealtimeProvider because the sockets
              need to know whether there is a session before opening.
            */}
            <AuthProvider>
              <RealtimeProvider>
                <AppRoutes />
              </RealtimeProvider>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
