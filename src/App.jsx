import React, { useState } from 'react'
import { useAuth } from './context/AuthContext'
import { InventoryProvider } from './context/InventoryContext'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import InventarioPage from './pages/InventarioPage'
import RankingPage from './pages/RankingPage'
import Navbar from './components/layout/Navbar'

export default function App() {
  const { user, loading } = useAuth()
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      return params.get('tab') || 'home'
    } catch {
      return 'home'
    }
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold text-xs">
        Carregando sessão...
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <InventoryProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main>
          {activeTab === 'home' && <HomePage setActiveTab={setActiveTab} />}
          {activeTab === 'inventario' && <InventarioPage />}
          {activeTab === 'ranking' && <RankingPage />}
        </main>
      </div>
    </InventoryProvider>
  )
}
