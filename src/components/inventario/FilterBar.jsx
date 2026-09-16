import React, { useState } from 'react'
import { 
  Search, 
  X, 
  Warehouse, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Navigation,
  ChevronDown,
  Layers
} from 'lucide-react'
import { useInventory } from '../../context/InventoryContext'

export default function FilterBar({ onOpenScanner }) {
  const {
    search,
    setSearch,
    availableArmazens,
    selectedArmazens,
    setSelectedArmazens,
    selectedStatuses,
    setSelectedStatuses,
    saldoFilterMode,
    setSaldoFilterMode,
    isRouteSortActive,
    setIsRouteSortActive
  } = useInventory()

  const [armDropdownOpen, setArmDropdownOpen] = useState(false)

  const toggleArmazem = (arm) => {
    if (selectedArmazens.includes(arm)) {
      setSelectedArmazens(selectedArmazens.filter(a => a !== arm))
    } else {
      setSelectedArmazens([...selectedArmazens, arm])
    }
  }

  const selectAllArmazens = () => {
    if (selectedArmazens.length === availableArmazens.length) {
      setSelectedArmazens([])
    } else {
      setSelectedArmazens([...availableArmazens])
    }
  }

  const toggleStatus = (status) => {
    if (selectedStatuses.includes(status)) {
      setSelectedStatuses(selectedStatuses.filter(s => s !== status))
    } else {
      setSelectedStatuses([...selectedStatuses, status])
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800/90 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-sm space-y-3.5">
      
      {/* Linha Superior: Busca Rápida + Saldo Mode + Rota Física */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-2.5">
        
        {/* Input de Busca Rápida */}
        <div className="relative w-full md:flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, descrição, endereço ou tag..."
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 pl-10 pr-9 text-xs font-bold text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002f6c]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Controles Rápidos */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          
          {/* Seletor de Saldo */}
          <select
            value={saldoFilterMode}
            onChange={(e) => setSaldoFilterMode(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#002f6c] cursor-pointer"
          >
            <option value="COM_SALDO">Com Saldo & Ganhos</option>
            <option value="SALDO_ZERO">Apenas Saldo Zerado</option>
            <option value="TODOS">Todos os Saldos</option>
          </select>

          {/* Ordenar por Rota Física (Galpão) */}
          <button
            type="button"
            onClick={() => setIsRouteSortActive(!isRouteSortActive)}
            className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              isRouteSortActive
                ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300'
                : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
            }`}
            title="Ordenar a lista pela sequência física de ruas e prateleiras do galpão"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rota Física</span>
          </button>

        </div>

      </div>

      {/* Linha Inferior: Dropdown de Armazéns + Filtros de Status */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-1 border-t border-slate-100 dark:border-slate-700/60">
        
        {/* Dropdown de Armazéns */}
        <div className="relative w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setArmDropdownOpen(!armDropdownOpen)}
            className="w-full sm:w-auto px-3.5 py-1.5 rounded-2xl text-xs font-black bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <Warehouse className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {selectedArmazens.length === availableArmazens.length
                  ? 'Todos os Armazéns'
                  : `${selectedArmazens.length} armazém(ns)`
                }
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {armDropdownOpen && (
            <div className="absolute left-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-20 p-2 space-y-1">
              <button
                type="button"
                onClick={selectAllArmazens}
                className="w-full text-left text-[11px] font-black text-blue-600 dark:text-blue-400 p-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl"
              >
                {selectedArmazens.length === availableArmazens.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {availableArmazens.map(arm => (
                  <label
                    key={arm}
                    className="flex items-center gap-2 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={selectedArmazens.includes(arm)}
                      onChange={() => toggleArmazem(arm)}
                      className="rounded border-slate-300 text-[#002f6c] focus:ring-[#002f6c]"
                    />
                    <span>Armazém {arm}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Filtros de Status */}
        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto justify-end">
          
          <button
            type="button"
            onClick={() => toggleStatus('ACURADO')}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer ${
              selectedStatuses.includes('ACURADO')
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-800 opacity-60'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Acurado</span>
          </button>

          <button
            type="button"
            onClick={() => toggleStatus('GANHO')}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer ${
              selectedStatuses.includes('GANHO')
                ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-800 opacity-60'
            }`}
          >
            <TrendingUp className="w-3 h-3 text-blue-600" />
            <span>Ganho</span>
          </button>

          <button
            type="button"
            onClick={() => toggleStatus('PERDA')}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer ${
              selectedStatuses.includes('PERDA')
                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-800 opacity-60'
            }`}
          >
            <TrendingDown className="w-3 h-3 text-rose-600" />
            <span>Perda</span>
          </button>

          <button
            type="button"
            onClick={() => toggleStatus('PENDENTE')}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer ${
              selectedStatuses.includes('PENDENTE')
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-800 opacity-60'
            }`}
          >
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Pendente</span>
          </button>

        </div>

      </div>

    </div>
  )
}
