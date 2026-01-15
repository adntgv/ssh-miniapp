import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Global styles
const globalStyles = document.createElement('style');
globalStyles.textContent = `
  * {
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
  }

  html, body, #root {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background-color: var(--tg-theme-bg-color, #ffffff);
    color: var(--tg-theme-text-color, #000000);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  input, button, textarea, select {
    font-family: inherit;
  }

  input:focus, textarea:focus, select:focus {
    outline: none;
    border-color: var(--tg-theme-button-color, #2481cc) !important;
  }

  button:active {
    opacity: 0.8;
  }

  /* Scrollbar styles */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: var(--tg-theme-hint-color, #cccccc);
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--tg-theme-text-color, #999999);
  }

  /* Mobile-specific adjustments */
  @media (max-width: 480px) {
    input, textarea, select {
      font-size: 16px !important; /* Prevent zoom on iOS */
    }
  }
`;
document.head.appendChild(globalStyles);

// Mount the app
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
