"use client";

import { useEffect } from 'react';
import { useChunkErrorHandler } from './ErrorBoundary';

export function ChunkErrorHandler() {
  useChunkErrorHandler();
  
  useEffect(() => {
    // Additional chunk loading error handling
    const handleChunkLoadError = (event: Event) => {
      const target = event.target as HTMLScriptElement;
      if (target && target.src && target.src.includes('_next/static/chunks/')) {
        console.error('Chunk loading failed:', target.src);
        
        // Force a page reload after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    };

    // Listen for script load errors
    document.addEventListener('error', handleChunkLoadError, true);
    
    return () => {
      document.removeEventListener('error', handleChunkLoadError, true);
    };
  }, []);

  return null;
}
