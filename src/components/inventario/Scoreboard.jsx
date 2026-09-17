import React from 'react'
import { Tag, CheckCircle2, Clock, Filter } from 'lucide-react'
import { useInventory } from '../../context/InventoryContext'

export default function Scoreboard() {
  const { scoreboardStats, etiquetaFilterMode, setEtiquetaFilterMode } = useInventory()
  const { totalSlots, trocadas, pendentes, pct } = scoreboardStats

  return (
    <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 p-3.5 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-3.5 w-full max-w-full overflow-hidden">
      
      {/* Header do Placar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/50 flex items-center justify-center text-amber-800 dark:text-amber-400 shadow-sm flex-shrink-0">
            <Tag className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h3 className="text-xs sm:text-base font-black text-slate-900 dark:text-white leading-tight">
                Controle de Troca Física de Etiquetas
              </h3>
              <span className="text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 whitespace-nowrap">
                Por Armazém • Validade 60d
              </span>
            </div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1 sm:line-clamp-none">
              Acompanhamento de substituição física nos galpões (Materiais zerados são isentos)
            </p>
          </div>
        </div>

        {/* Botões Rápidos de Filtragem por Etiqueta */}
        <div className="grid grid-cols-3 sm:flex items-center gap-1 sm:gap-1.5 bg-slate-100 dark:bg-slate-950/40 p-1 sm:p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setEtiquetaFilterMode('FALTA_TROCAR')}
            className={`px-1.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer truncate ${
              etiquetaFilterMode === 'FALTA_TROCAR'
                ? 'bg-amber-500 text-white shadow-md ring-2 ring-amber-300'
                : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200'
            }`}
          >
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 hidden xs:inline" />
            <span className="truncate">Falta ({pendentes})</span>
          </button>

          <button
            type="button"
            onClick={() => setEtiquetaFilterMode('JA_TROCADO')}
            className={`px-1.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer truncate ${
              etiquetaFilterMode === 'JA_TROCADO'
                ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-300'
                : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border border-emerald-200'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 hidden xs:inline" />
            <span className="truncate">Trocadas ({trocadas})</span>
          </button>

          <button
            type="button"
            onClick={() => setEtiquetaFilterMode('TODOS')}
            className={`px-1.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer truncate ${
              etiquetaFilterMode === 'TODOS'
                ? 'bg-slate-800 text-white shadow-md ring-2 ring-slate-400'
                : 'bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
            }`}
          >
            <Filter className="w-3 h-3 sm:w-3.5 sm:h-3.5 hidden xs:inline" />
            <span className="truncate">Todas</span>
          </button>
        </div>
      </div>

      {/* Barra de Progresso e Métricas */}
      <div className="space-y-1.5 sm:space-y-2">
        <div className="flex flex-wrap items-center justify-between text-[11px] sm:text-xs font-black text-slate-700 dark:text-slate-300 gap-1.5">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="text-emerald-700 dark:text-emerald-400 font-black">{trocadas} trocadas</span>
            <span className="text-slate-300">•</span>
            <span className="text-amber-700 dark:text-amber-400 font-bold">{pendentes} pendentes</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-medium">de {totalSlots} exigidas</span>
          </div>
          <span className="font-mono text-xs sm:text-sm font-black text-[#002f6c] dark:text-blue-400">
            {pct}%
          </span>
        </div>

        <div className="w-full h-2.5 sm:h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden p-0.5 shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 shadow-sm"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

    </div>
  )
}
