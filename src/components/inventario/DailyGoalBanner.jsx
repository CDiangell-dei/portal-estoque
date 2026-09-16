import React, { useEffect } from 'react'
import { Target, CheckCircle, Sparkles, Filter } from 'lucide-react'
import confetti from 'canvas-confetti'
import { useInventory } from '../../context/InventoryContext'

export default function DailyGoalBanner() {
  const { dailyGoalStats, isDailyGoalFilterActive, setIsDailyGoalFilterActive } = useInventory()
  const { targetCount, doneCount, pct, pendentesCount } = dailyGoalStats

  // Efeito de confete ao completar a meta
  useEffect(() => {
    if (doneCount >= targetCount && targetCount > 0) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      })
    }
  }, [doneCount, targetCount])

  if (targetCount === 0) return null

  const isCompleted = doneCount >= targetCount

  return (
    <div className="bg-gradient-to-r from-blue-900 to-[#002f6c] text-white p-4 sm:p-5 rounded-3xl shadow-md space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-amber-300 shadow-inner flex-shrink-0">
            {isCompleted ? <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" /> : <Target className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black tracking-tight">
                Meta Diária: 15 Itens Prioritários
              </h3>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 font-mono">
                Hoje
              </span>
            </div>
            <p className="text-xs text-blue-200">
              {isCompleted
                ? '🎉 Parabéns! Todos os 15 itens prioritários do dia foram contados!'
                : `${targetCount} itens selecionados por divergência ou tempo sem contagem (${pendentesCount} pendente(s))`
              }
            </p>
          </div>
        </div>

        {/* Botão de Filtrar Somente os Itens da Meta */}
        <button
          type="button"
          onClick={() => setIsDailyGoalFilterActive(!isDailyGoalFilterActive)}
          className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            isDailyGoalFilterActive
              ? 'bg-amber-400 text-slate-900 shadow-lg ring-2 ring-white/60'
              : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>{isDailyGoalFilterActive ? 'Mostrando Somente Meta' : 'Ver Somente Meta Diária'}</span>
        </button>

      </div>

      {/* Barra de Progresso da Meta */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-bold text-blue-200">
          <span>{doneCount} de {targetCount} concluídos</span>
          <span className="font-mono font-black text-amber-300">{pct}%</span>
        </div>
        <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden p-0.5">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
