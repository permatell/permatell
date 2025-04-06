// This file provides a polyfill for the debug package to prevent it from trying to access process.stderr.fd
// which is not available in the browser environment

// Create a global process object if it doesn't exist
if (typeof window !== 'undefined' && !window.process) {
  window.process = {
    env: {},
    stderr: {
      fd: undefined
    }
  };
}

// Override the useColors function in the debug package
if (typeof window !== 'undefined') {
  // Check if the debug module is loaded
  if (typeof require === 'function') {
    try {
      const debugModule = require('debug');
      if (debugModule && debugModule.useColors) {
        // Override the useColors function to always return false in the browser
        debugModule.useColors = function() {
          return false;
        };
      }
    } catch (e) {
      console.warn('Failed to polyfill debug module:', e);
    }
  }
} 