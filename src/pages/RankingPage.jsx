import React, { useMemo } from 'react'
import { Trophy, Award, Medal, User, Calendar, CheckCircle } from 'lucide-react'
import { useInventory } from '../context/InventoryContext'
import { formatNumber } from '../utils/formatters'

export default function RankingPage() {
  const { rawConf } = useInventory()

  const ranking = useMemo(() => {
    const map = {}
    rawConf.forEach(c => {
      const user = c.conferente_nome || 'SISTEMA'
      if (!map[user]) {
        map[user] = {
          nome: user,
          contagens: 0,
          filial: c.filial || '01',
          ultimaContagem: c.created_at
        }
      }
      map[user].contagens += 1
      if (new Date(c.created_at) > new Date(map[user].ultimaContagem)) {
        map[user].ultimaContagem = c.created_at
      }
    })

    return Object.values(map).sort((a, b) => b.contagens - a.contagens)
  }, [rawConf])

  return (
    <div className="space-y-4 pb-16 max-w-7xl mx-auto px-3 sm:px-6 pt-4">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white p-5 rounded-3xl shadow-md flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner flex-shrink-0">
          <Trophy className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-black tracking-tight">
            Ranking de Produtividade em Contagens
          </h2>
          <p className="text-xs text-amber-100">
            Total acumulado de conferências físicas realizadas por conferente
          </p>
        </div>
      </div>

      {/* Lista / Tabela */}
      <div className="bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-[11px] font-black text-slate-400 uppercase tracking-wider">
              <th className="px-4 py-3.5 text-center w-12">#</th>
              <th className="px-4 py-3.5">Conferente</th>
              <th className="px-4 py-3.5 text-center">Filial</th>
              <th className="px-4 py-3.5 text-right">Contagens Registradas</th>
              <th className="px-4 py-3.5 text-right">Última Atividade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-bold text-slate-700 dark:text-slate-200">
            {ranking.map((row, idx) => (
              <tr key={row.nome} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                <td className="px-4 py-3.5 text-center font-black">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                </td>
                <td className="px-4 py-3.5 font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>{row.nome}</span>
                </td>
                <td className="px-4 py-3.5 text-center font-mono text-[11px] text-slate-500">
                  Filial {row.filial}
                </td>
                <td className="px-4 py-3.5 text-right font-mono font-black text-[#002f6c] dark:text-blue-400 text-sm">
                  {formatNumber(row.contagens)}
                </td>
                <td className="px-4 py-3.5 text-right text-[11px] text-slate-400 font-mono">
                  {row.ultimaContagem ? new Date(row.ultimaContagem).toLocaleDateString('pt-BR') : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
