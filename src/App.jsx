import React, { useState } from 'react'
import { Calculator } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { InventoryProvider } from './context/InventoryContext'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import InventarioPage from './pages/InventarioPage'
import RankingPage from './pages/RankingPage'
import Navbar from './components/layout/Navbar'
import FloatingCalculator from './components/common/FloatingCalculator'

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
  const [isCalcOpen, setIsCalcOpen] = useState(false)

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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors relative">
        <Navbar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onOpenCalc={() => setIsCalcOpen(true)}
        />
        <main>
          {activeTab === 'home' && <HomePage setActiveTab={setActiveTab} />}
          {activeTab === 'inventario' && <InventarioPage />}
          {activeTab === 'ranking' && <RankingPage />}
        </main>

        {/* Botão Flutuante de Calculadora Rápida no Canto Inferior */}
        <button
          type="button"
          onClick={() => setIsCalcOpen(true)}
          className="fixed bottom-5 right-5 z-30 p-3.5 bg-gradient-to-tr from-[#002f6c] to-blue-600 hover:from-[#00204a] hover:to-blue-700 text-white rounded-2xl shadow-xl shadow-blue-900/30 border border-blue-400/30 flex items-center gap-2 cursor-pointer active:scale-95 transition-all group"
          title="Abrir Calculadora do Almoxarifado"
        >
          <Calculator className="w-5 h-5 text-amber-300 group-hover:rotate-12 transition-transform" />
          <span className="hidden sm:inline text-xs font-black tracking-wide">Calculadora</span>
        </button>

        {/* Modal de Calculadora Flutuante Geral */}
        <FloatingCalculator 
          isOpen={isCalcOpen} 
          onClose={() => setIsCalcOpen(false)} 
        />
      </div>
    </InventoryProvider>
  )
}
