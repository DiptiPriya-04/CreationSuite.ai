import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/api.js'
import App from './App.jsx'
import { BrowserRouter } from "react-router-dom"

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  createRoot(document.getElementById('root')).render(
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full p-8 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl text-center space-y-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-2xl font-bold">
          !
        </div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          CreationSuite.ai
        </h1>
        <h2 className="text-lg font-semibold text-zinc-200">Clerk API Key Required</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">
          To run the application, create a <code className="bg-zinc-800 text-blue-300 px-1.5 py-0.5 rounded">.env</code> file in the <code className="bg-zinc-800 text-blue-300 px-1.5 py-0.5 rounded">client/</code> directory with your Clerk publishable key:
        </p>
        <div className="p-3 bg-zinc-950 rounded-lg text-left text-xs font-mono text-zinc-300 border border-zinc-800">
          VITE_CLERK_PUBLISHABLE_KEY=pk_test_...<br/>
          VITE_BASE_URL=http://localhost:3000
        </div>
        <p className="text-xs text-zinc-500">
          Get your free keys at <a href="https://clerk.com" target="_blank" rel="noreferrer" className="text-blue-400 underline">clerk.com</a>.
        </p>
      </div>
    </div>
  )
} else {
  createRoot(document.getElementById('root')).render(
    <BrowserRouter>
      <App publishableKey={PUBLISHABLE_KEY} />
    </BrowserRouter>
  )
}