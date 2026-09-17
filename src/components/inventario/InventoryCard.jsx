import React from 'react'
import { 
  Clipboard, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  Truck, 
  Tag as TagIcon,
  History,
  MessageSquare
} from 'lucide-react'
import EtiquetaButton from './EtiquetaButton'
import { formatNumber } from '../../utils/formatters'

export default function InventoryCard({ item, onOpenCount, onOpenAudit, onOpenTags, onOpenFornecedores }) {
  const getStatusBadge = () => {
    if (item.status === 'ACURADO') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Acurado
        </span>
      )
    }
    if (item.status === 'GANHO') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          Ganho (+{formatNumber(item.divergencia)})
        </span>
      )
    }
    if (item.status === 'PERDA') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 flex items-center gap-1">
          <TrendingDown className="w-3 h-3" />
          Perda ({formatNumber(item.divergencia)})
        </span>
      )
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700">
        Não Contado
      </span>
    )
  }

  const tagsList = item.tags ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : []

  return (
    <div className={`p-4 rounded-3xl border transition-all space-y-3 ${
      item.isDailyGoalItem
        ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/60 shadow-md ring-1 ring-amber-300/40'
        : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 shadow-sm hover:border-slate-300'
    }`}>
      
      {/* Top Header: Código, Unidade, Meta Badge e Status */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-2.5 py-0.5 rounded-xl text-xs font-black bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-mono">
            {item.codigo}
          </span>
          <span className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-900 text-slate-500">
            {item.unidade}
          </span>
          {item.isDailyGoalItem && (
            <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-amber-400 text-slate-900 shadow-xs">
              🎯 Meta do Dia
            </span>
          )}
        </div>
        <div>
          {getStatusBadge()}
        </div>
      </div>

      {/* Descrição & Tags */}
      <div>
        <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-snug">
          {item.descricao}
        </h4>

        {/* Badges de Metadados: Endereço, Fornecedor, Tags */}
        <div className="flex flex-wrap gap-1 mt-1.5">
          {item.endereco && (
            <span className="px-2 py-0.5 rounded-lg text-[9px] font-extrabold bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200/80 flex items-center gap-0.5">
              <MapPin className="w-2.5 h-2.5 text-amber-600" />
              {item.endereco}
            </span>
          )}

          {item.fornecedores && (
            <button
              type="button"
              onClick={() => onOpenFornecedores && onOpenFornecedores(item)}
              className="px-2 py-0.5 rounded-lg text-[9px] font-extrabold bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200/80 flex items-center gap-0.5 cursor-pointer"
              title="Gerenciar Fornecedores"
            >
              <Truck className="w-2.5 h-2.5 text-teal-600" />
              {item.fornecedores}
            </button>
          )}

          {tagsList.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => onOpenTags && onOpenTags(item)}
              className="px-2 py-0.5 rounded-lg text-[9px] font-extrabold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 cursor-pointer"
              title="Gerenciar Tags"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Observação de Contagem */}
        {item.observacao && (
          <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50/60 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-200/60 mt-2 flex items-start gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <span className="italic">{item.observacao}</span>
          </div>
        )}
      </div>

      {/* Grid de Saldos e Contagem */}
      <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800">
        <div>
          <span className="text-[10px] font-bold text-slate-400 block uppercase">Sistema</span>
          <span className="text-sm font-black text-slate-800 dark:text-slate-100 font-mono">
            {formatNumber(item.quantidade)}
          </span>
        </div>
        <div className="border-l border-slate-200 dark:border-slate-800 pl-2.5">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">Contada</span>
          <span className="text-sm font-black text-[#002f6c] dark:text-blue-400 font-mono">
            {item.hasCount ? formatNumber(item.qtd_contada) : '-'}
          </span>
        </div>
      </div>

      {/* Seção de Troca de Etiquetas por Armazém */}
      <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase">Etiquetas:</span>
        <div className="flex flex-wrap items-center gap-1">
          {item.armazensNoFiltro?.map(arm => (
            <EtiquetaButton key={arm} item={item} armazem={arm} compact={item.armazensNoFiltro.length > 1} />
          ))}
        </div>
      </div>

      {/* Ações: Contar, Tags, Fornecedores, Histórico */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onOpenCount(item)}
          className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-black text-xs py-2.5 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer touch-active"
        >
          <Clipboard className="w-4 h-4" />
          <span>Contar Material</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenTags && onOpenTags(item)}
          className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-2xl border border-indigo-200 dark:border-indigo-800 cursor-pointer"
          title="Gerenciar Tags"
        >
          <TagIcon className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => onOpenFornecedores && onOpenFornecedores(item)}
          className="p-2.5 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 rounded-2xl border border-teal-200 dark:border-teal-800 cursor-pointer"
          title="Gerenciar Fornecedores"
        >
          <Truck className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => onOpenAudit(item)}
          className="p-2.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 text-slate-600 dark:text-slate-200 rounded-2xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
          title="Ver histórico de auditoria"
        >
          <History className="w-4 h-4" />
        </button>
      </div>

    </div>
  )
}