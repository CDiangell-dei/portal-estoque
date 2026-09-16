import React from 'react'
import { 
  Building2, 
  Warehouse, 
  Moon, 
  Sun, 
  LogOut, 
  User, 
  Layers, 
  RefreshCw,
  Tag,
  ClipboardList
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useInventory } from '../../context/InventoryContext'
import { FILIAIS_LIST } from '../../utils/formatters'

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, sector, setSector, filial, setFilial, isGlobal, logout, theme, toggleTheme } = useAuth()
  const { loading, reload } = useInventory()

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-2">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#002f6c] to-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-900/20 flex-shrink-0">
              <Warehouse className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-black tracking-tight text-[#002f6c] dark:text-blue-400 leading-none">
                  AMAZON AÇO
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/50">
                  {sector}
                </span>
              </div>
              <p className="text-[11px] font-bold text-slate-400 leading-tight hidden sm:block">
                Portal de Controle & Inventário
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('inventario')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeTab === 'inventario'
                  ? 'bg-white dark:bg-slate-900 text-[#002f6c] dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Inventário Rotativo</span>
            </button>

            <button
              onClick={() => setActiveTab('ranking')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeTab === 'ranking'
                  ? 'bg-white dark:bg-slate-900 text-[#002f6c] dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Produtividade</span>
            </button>
          </div>

          {/* Controls: Sector, Filial, Theme, User */}
          <div className="flex items-center gap-2">
            
            {/* Seletor de Setor: COMÉRCIO vs INDÚSTRIA */}
            <button
              type="button"
              onClick={() => setSector(sector === 'COMERCIO' ? 'INDUSTRIA' : 'COMERCIO')}
              className="px-2.5 py-1.5 rounded-xl text-xs font-black bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Alternar entre Comércio e Indústria"
            >
              <Building2 className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden lg:inline">{sector === 'COMERCIO' ? 'Comércio' : 'Indústria'}</span>
            </button>

            {/* Seletor de Filial */}
            <select
              value={filial}
              onChange={(e) => setFilial(e.target.value)}
              disabled={!isGlobal}
              className={`bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-800 dark:text-slate-100 rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-[#002f6c] ${
                !isGlobal ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {isGlobal && <option value="ALL">00 - Todas as Filiais</option>}
              {FILIAIS_LIST.filter(f => f.num_filial !== '00').map(f => (
                <option key={f.num_filial} value={f.num_filial}>
                  {f.nome_filial}
                </option>
              ))}
            </select>

            {/* Botão de Atualizar / Sincronizar */}
            <button
              type="button"
              onClick={() => reload()}
              disabled={loading}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
              title="Atualizar dados do inventário"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            {/* Alternar Tema */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
              title="Alternar Tema Claro / Escuro"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* Perfil & Logout */}
            <div className="flex items-center gap-1.5 pl-1 sm:pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-black text-slate-800 dark:text-slate-100 leading-tight">
                  {user?.nome || 'Usuário'}
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-400 leading-tight">
                  Mat: {user?.matricula || '---'}
                </span>
              </div>

              <button
                type="button"
                onClick={logout}
                className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 transition-all cursor-pointer"
                title="Sair do Sistema"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
      </div>
    </header>
  )
}
