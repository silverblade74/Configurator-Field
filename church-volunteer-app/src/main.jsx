import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { BrandingProvider } from './contexts/BrandingContext'
import { ToastProvider } from './components/ToastProvider'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <BrandingProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </BrandingProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
