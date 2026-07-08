import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerBuiltinBackends } from './lib/agent/backends';
import './styles/index.css';

registerBuiltinBackends();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
