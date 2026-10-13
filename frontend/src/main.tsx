import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { installSpeechPriming } from './lib/speech';
import './styles/global.css';

// O primeiro toque em qualquer tela destrava a sintese de fala, que em
// tablet so roda a partir de um gesto do usuario.
installSpeechPriming();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);