import React from 'react'
import { Check, CheckCircle2, X, XCircle, Tag, MinusCircle } from 'lucide-react'
import { useInventory } from '../../context/InventoryContext'
import { getEtiquetaInfo } from '../../utils/etiquetas'

export default function EtiquetaButton({ item, armazem, compact = false }) {
  const { toggleEtiqueta } = useInventory()

  const isOk = item.etiquetasTrocadas?.includes(armazem)
  const isZerado = item.armazensZerados?.includes(armazem)
  const info = getEtiquetaInfo(item.filial || '01', armazem, item.codigo)

  const dateStr = info?.trocado_em ? new Date(info.trocado_em).toLocaleDateString('pt-BR') : ''
  const whoStr = info?.usuario_nome || 'Usuário'

  const handleClick = (e) => {
    e.stopPropagation()
    toggleEtiqueta(item.filial, armazem, item.codigo)
  }

  // 1. Material Zerado e Acurado (Isento de troca física de etiqueta)
  if (isZerado) {
    if (compact) {
      return (
        <span
          className="px-2 py-1 rounded-lg text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1 whitespace-nowrap"
          title={`Armazém ${armazem}: Zerado e acurado (0 un). Não requer etiqueta física.`}
        >
          <MinusCircle className="w-2.5 h-2.5 text-slate-400" />
          <span>[{armazem}] Zerado</span>
        </span>
      )
    }

    return (
      <span
        className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1 mx-auto whitespace-nowrap"
        title={`Armazém ${armazem}: Material zerado e acurado (0 un). Não requer troca de etiqueta física.`}
      >
        <MinusCircle className="w-3.5 h-3.5 text-slate-400" />
        <span>Zerado (Sem Etiqueta)</span>
      </span>
    )
  }

  // 2. Etiqueta Já Trocada (OK)
  if (isOk) {
    if (compact) {
      return (
        <button
          type="button"
          onClick={handleClick}
          className="px-2 py-1 rounded-lg text-[9px] font-black bg-emerald-100 dark:bg-emerald-950/60 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-emerald-800 dark:text-emerald-300 hover:text-rose-800 dark:hover:text-rose-300 border border-emerald-300 dark:border-emerald-700 hover:border-rose-300 transition-all flex items-center gap-1 cursor-pointer shadow-xs group whitespace-nowrap"
          title={`Armazém ${armazem}: Etiqueta OK (${dateStr} por ${whoStr}). Clique para desmarcar.`}
        >
          <Check className="w-2.5 h-2.5 text-emerald-700 dark:text-emerald-400 group-hover:hidden" />
          <X className="w-2.5 h-2.5 text-rose-700 dark:text-rose-400 hidden group-hover:inline" />
          <span className="group-hover:hidden">[{armazem}] ✔ OK</span>
          <span className="hidden group-hover:inline">[{armazem}] Desm.</span>
        </button>
      )
    }

    return (
      <button
        type="button"
        onClick={handleClick}
        className="px-2.5 py-1.5 rounded-xl text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/60 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-emerald-800 dark:text-emerald-300 hover:text-rose-800 dark:hover:text-rose-300 border border-emerald-300 dark:border-emerald-700 hover:border-rose-300 transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs group whitespace-nowrap mx-auto"
        title={`Armazém ${armazem}: Etiqueta OK em ${dateStr} por ${whoStr}. Clique para desmarcar.`}
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 group-hover:hidden" />
        <XCircle className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400 hidden group-hover:inline" />
        <span className="group-hover:hidden">✔ Etiqueta OK</span>
        <span className="hidden group-hover:inline">Desmarcar</span>
      </button>
    )
  }

  // 3. Etiqueta Pendente (Falta Trocar)
  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="px-2 py-1 rounded-lg text-[9px] font-black bg-amber-50 dark:bg-amber-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 text-amber-900 dark:text-amber-300 hover:text-emerald-900 border border-amber-300 dark:border-amber-700/60 hover:border-emerald-300 transition-all flex items-center gap-1 cursor-pointer shadow-xs whitespace-nowrap"
        title={`Armazém ${armazem}: Etiqueta pendente. Clique para marcar como OK.`}
      >
        <Tag className="w-2.5 h-2.5 text-amber-700 dark:text-amber-400" />
        <span>[{armazem}] 🏷️ Trocar</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="px-2.5 py-1.5 rounded-xl text-[10px] font-black bg-amber-100 dark:bg-amber-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 text-amber-900 dark:text-amber-300 hover:text-emerald-900 border border-amber-300 dark:border-amber-700 hover:border-emerald-300 transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs whitespace-nowrap mx-auto"
      title={`Armazém ${armazem}: Etiqueta pendente. Clique para marcar como OK.`}
    >
      <Tag className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
      <span>🏷️ Trocar</span>
    </button>
  )
}
