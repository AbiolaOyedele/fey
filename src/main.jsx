import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { SettingsProvider } from './contexts/SettingsContext'
import { DemoProvider } from './contexts/DemoContext'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';
const Provider = IS_DEMO ? DemoProvider : SettingsProvider;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <Provider>
        <App />
      </Provider>
    </AuthProvider>
  </React.StrictMode>,
)
