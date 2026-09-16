import React from 'react'
import { 
  Clipboard, 
  MapPin, 
  Truck, 
  History, 
  MessageSquare,
  CheckCircle2, 
  TrendingUp, 
  TrendingDown
} from 'lucide-react'
import EtiquetaButton from './EtiquetaButton'
import { formatNumber } from '../../utils/formatters'

export default function InventoryTable({ items, onOpenCount, onOpenAudit }) {
  const getStatusBadge = (item) => {
    if (item.status === 'ACURADO') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 flex items-center justify-center gap-1 mx-auto">
          <CheckCircle2 className="w-3 h-3" />
          Acurado
        </span>
      )
    }
    if (item.status === 'GANHO') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 flex items-center justify-center gap-1 mx-auto">
          <TrendingUp className="w-3 h-3" />
          Ganho (+{formatNumber(item.divergencia)})
        </span>
      )
    }
    if (item.status === 'PERDA') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 flex items-center justify-center gap-1 mx-auto">
          <TrendingDown className="w-3 h-3" />
          Perda ({formatNumber(item.divergencia)})
        </span>
      )
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto">
        Não Contado
      </span>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-[11px] font-black text-slate-400 uppercase tracking-wider">
              <th className="px-4 py-3.5">Código</th>
              <th className="px-4 py-3.5">Descrição & Localização</th>
              <th className="px-3 py-3.5 text-center">Un</th>
              <th className="px-4 py-3.5 text-right">Sistema</th>
              <th className="px-4 py-3.5 text-right">Contada</th>
              <th className="px-4 py-3.5 text-center">Status</th>
              <th className="px-4 py-3.5 text-center">Etiquetas</th>
              <th className="px-4 py-3.5 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-bold text-slate-700 dark:text-slate-200">
            {items.map(item => {
              const tagsList = item.tags ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : []
              return (
                <tr 
                  key={item.codigo}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors ${
                    item.isDailyGoalItem ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
                  }`}
                >
                  
                  {/* Código */}
                  <td className="px-4 py-3 font-mono font-black text-slate-800 dark:text-slate-100 whitespace-nowrap">
                    {item.codigo}
                    {item.isDailyGoalItem && (
                      <span className="block text-[9px] text-amber-600 font-extrabold">🎯 Meta Diária</span>
                    )}
                  </td>

                  {/* Descrição & Tags */}
                  <td className="px-4 py-3 max-w-xs sm:max-w-md">
                    <div className="font-black text-slate-900 dark:text-white leading-snug">
                      {item.descricao}
                    </div>

                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.endereco && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200/80 flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5 text-amber-600" />
                          {item.endereco}
                        </span>
                      )}

                      {item.fornecedores && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200/80 flex items-center gap-0.5">
                          <Truck className="w-2.5 h-2.5 text-teal-600" />
                          {item.fornecedores}
                        </span>
                      )}

                      {tagsList.map(tag => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {item.observacao && (
                      <div className="text-[10px] text-amber-800 dark:text-amber-300 italic mt-1 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 flex-shrink-0" />
                        <span>{item.observacao}</span>
                      </div>
                    )}
                  </td>

                  {/* Unidade */}
                  <td className="px-3 py-3 text-center text-[10px] text-slate-500 font-mono">
                    {item.unidade}
                  </td>

                  {/* Saldo Sistema */}
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                    {formatNumber(item.quantidade)}
                  </td>

                  {/* Qtd Contada */}
                  <td className="px-4 py-3 text-right font-mono font-black text-[#002f6c] dark:text-blue-400">
                    {item.hasCount ? formatNumber(item.qtd_contada) : '-'}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {getStatusBadge(item)}
                  </td>

                  {/* Etiquetas */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      {item.armazensNoFiltro?.map(arm => (
                        <EtiquetaButton key={arm} item={item} armazem={arm} compact={item.armazensNoFiltro.length > 1} />
                      ))}
                    </div>
                  </td>

                  {/* Ações */}
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenCount(item)}
                        className="bg-teal-50 hover:bg-teal-600 text-teal-700 hover:text-white dark:bg-teal-950/50 dark:text-teal-300 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                        title="Registrar Contagem Física"
                      >
                        <Clipboard className="w-3.5 h-3.5" />
                        <span>Contar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenAudit(item)}
                        className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                        title="Ver Histórico de Auditoria"
                      >
                        <History className="w-4 h-4" />
                      </button>
                    </div>
                  </td>

                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
