"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Check if it's a chunk loading error
      if (this.state.error?.message?.includes('Loading chunk') || 
          this.state.error?.name === 'ChunkLoadError') {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
            <div className="text-center p-8">
              <h1 className="text-2xl font-bold mb-4">Page Loading Error</h1>
              <p className="text-gray-300 mb-6">
                There was an issue loading this page. This usually happens when the application has been updated.
              </p>
              <div className="space-y-4">
                <button
                  onClick={() => {
                    // Clear cache and reload
                    if (typeof window !== 'undefined') {
                      // Clear service worker cache if available
                      if ('serviceWorker' in navigator) {
                        navigator.serviceWorker.getRegistrations().then((registrations) => {
                          registrations.forEach((registration) => {
                            registration.unregister();
                          });
                        });
                      }
                      // Clear browser cache
                      window.location.reload();
                    }
                  }}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Reload Page
                </button>
                <div>
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.location.href = '/dashboard';
                      }
                    }}
                    className="px-6 py-2 text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Go to Dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      }

      // Default error fallback
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-gray-300 mb-6">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook to handle chunk loading errors
export function useChunkErrorHandler() {
  React.useEffect(() => {
    const handleChunkError = (event: ErrorEvent) => {
      if (event.error?.message?.includes('Loading chunk') || 
          event.error?.name === 'ChunkLoadError') {
        console.error('Chunk loading error detected:', event.error);
        
        // Show a user-friendly message
        const message = document.createElement('div');
        message.innerHTML = `
          <div style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            color: white;
            font-family: system-ui, sans-serif;
          ">
            <div style="text-align: center; padding: 2rem;">
              <h2 style="margin-bottom: 1rem;">Application Update Required</h2>
              <p style="margin-bottom: 1.5rem; color: #ccc;">
                The application has been updated. Please refresh the page to continue.
              </p>
              <button onclick="window.location.reload()" style="
                padding: 0.75rem 1.5rem;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 0.5rem;
                cursor: pointer;
                font-size: 1rem;
              ">
                Refresh Page
              </button>
            </div>
          </div>
        `;
        document.body.appendChild(message);
      }
    };

    window.addEventListener('error', handleChunkError);
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason?.message?.includes('Loading chunk')) {
        handleChunkError({ error: event.reason } as ErrorEvent);
      }
    });

    return () => {
      window.removeEventListener('error', handleChunkError);
    };
  }, []);
}
