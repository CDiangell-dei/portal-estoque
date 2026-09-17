import React, { useState } from 'react'
import { 
  Building2, 
  Warehouse, 
  Moon, 
  Sun, 
  LogOut, 
  Layers, 
  RefreshCw,
  ClipboardList,
  Home,
  ShoppingCart,
  Boxes,
  Truck,
  History,
  CalendarClock,
  Shield,
  FileText,
  Settings,
  ChevronDown
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useInventory } from '../../context/InventoryContext'
import { FILIAIS_LIST } from '../../utils/formatters'
import logoAmazonAco from '../../assets/logo_amazon_aco.png'

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, sector, setSector, filial, setFilial, isGlobal, logout, theme, toggleTheme } = useAuth()
  const { loading, reload } = useInventory()

  const [showEstoqueDropdown, setShowEstoqueDropdown] = useState(false)
  const [showAlmoxDropdown, setShowAlmoxDropdown] = useState(false)

  const isAlmoxarife = user?.eh_almoxarife === true || user?.eh_admin === true
  const isAdmin = user?.eh_admin === true

  return (
    <div className="sticky top-0 z-40">
      {/* Faixa de Identidade Visual Amazon Aço (Azul e Carmim) */}
      <div className="h-1 w-full bg-gradient-to-r from-[#002f6c] via-[#B40D15] to-[#002f6c]" />

      <header className="bg-white/95 dark:bg-[#0B132B]/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 transition-colors shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-2">
            
            {/* Logo & Brand */}
            <button 
              type="button"
              onClick={() => setActiveTab('home')}
              className="flex items-center space-x-3 text-left cursor-pointer group"
            >
              <img 
                src={logoAmazonAco} 
                alt="Amazon Aço" 
                fetchPriority="high" 
                loading="eager" 
                className="h-9 sm:h-10 w-auto flex-shrink-0 object-contain drop-shadow-xs transition-transform group-hover:scale-102 dark:bg-white/95 dark:p-1.5 dark:rounded-xl" 
              />
              <div className="border-l border-slate-200 dark:border-slate-800 pl-3 hidden sm:block">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black tracking-tight text-[#002f6c] dark:text-white uppercase">
                    WMS Almoxarifado
                  </span>
                  <span className="bg-[#B40D15]/10 text-[#B40D15] dark:bg-rose-950/50 dark:text-rose-300 text-[9px] px-2 py-0.5 rounded-full font-extrabold border border-[#B40D15]/20 uppercase tracking-wider">
                    {sector}
                  </span>
                </div>
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-tight">
                  Portal de Controle de Estoques
                </p>
              </div>
            </button>

          {/* Navigation Tabs Desktop */}
          <nav className="hidden lg:flex items-center bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700">
            {/* INÍCIO */}
            <button
              onClick={() => { setActiveTab('home'); setShowEstoqueDropdown(false); setShowAlmoxDropdown(false); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'home'
                  ? 'bg-white dark:bg-slate-900 text-[#002f6c] dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Início</span>
            </button>

            {/* SOLICITAÇÃO DE ESTOQUE */}
            <a
              href="solicitacao_estoque.html"
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>Solicitação</span>
            </a>

            {/* DROPDOWN ESTOQUE */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setShowEstoqueDropdown(!showEstoqueDropdown); setShowAlmoxDropdown(false); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'inventario'
                    ? 'bg-white dark:bg-slate-900 text-[#002f6c] dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Boxes className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>Estoque</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showEstoqueDropdown && (
                <div className="absolute top-11 left-0 w-60 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in duration-100">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('inventario'); setShowEstoqueDropdown(false); }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/60 text-left transition-colors cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950 text-[#002f6c] dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                      <ClipboardList className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-800 dark:text-slate-100">Inventário Rotativo</div>
                      <div className="text-[10px] text-slate-400">Contagens físicas e conciliação</div>
                    </div>
                  </button>

                  <a
                    href="transferencia.html"
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/60 text-left transition-colors cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950 text-teal-600 flex items-center justify-center flex-shrink-0">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-800 dark:text-slate-100">Transferência</div>
                      <div className="text-[10px] text-slate-400">QR Code e separação física</div>
                    </div>
                  </a>

                  <a
                    href="kardex.html"
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/60 text-left transition-colors cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center flex-shrink-0">
                      <History className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-800 dark:text-slate-100">Kardex de Contagem</div>
                      <div className="text-[10px] text-slate-400">Histórico de lançamentos</div>
                    </div>
                  </a>

                  <a
                    href="validade.html"
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/60 text-left transition-colors cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-600 flex items-center justify-center flex-shrink-0">
                      <CalendarClock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-800 dark:text-slate-100">Controle de Validade</div>
                      <div className="text-[10px] text-slate-400">Lotes FEFO e Armazém 50</div>
                    </div>
                  </a>
                </div>
              )}
            </div>

            {/* DROPDOWN ALMOXARIFADO (SE ALMOXARIFE OU ADMIN) */}
            {isAlmoxarife && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setShowAlmoxDropdown(!showAlmoxDropdown); setShowEstoqueDropdown(false); }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Shield className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>Almoxarifado</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {showAlmoxDropdown && (
                  <div className="absolute top-11 left-0 w-60 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in duration-100">
                    <a
                      href="luvas.html"
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/60 text-left transition-colors cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-800 dark:text-slate-100">Consumo de EPIs</div>
                        <div className="text-[10px] text-slate-400">Entrega de luvas por matrícula</div>
                      </div>
                    </a>

                    <a
                      href="minutas.html"
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/60 text-left transition-colors cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-800 dark:text-slate-100">Minutas & Recebimento</div>
                        <div className="text-[10px] text-slate-400">Entrada de NFs e canhotos</div>
                      </div>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* BOTÃO ADMIN (SE ADMIN) */}
            {isAdmin && (
              <a
                href="admin.html"
                className="px-3 py-1.5 rounded-xl text-xs font-black bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                <span>Admin</span>
              </a>
            )}

            {/* BOTÃO PRODUTIVIDADE */}
            <button
              onClick={() => { setActiveTab('ranking'); setShowEstoqueDropdown(false); setShowAlmoxDropdown(false); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'ranking'
                  ? 'bg-white dark:bg-slate-900 text-[#002f6c] dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Produtividade</span>
            </button>
          </nav>

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
  </div>
  )
}
