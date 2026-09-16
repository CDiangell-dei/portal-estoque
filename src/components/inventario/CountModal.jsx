import React, { useState, useEffect } from 'react'
import { 
  X, 
  Check, 
  Warehouse, 
  Calculator, 
  MessageSquare, 
  Calendar, 
  Layers, 
  Save, 
  Tag as TagIcon
} from 'lucide-react'
import { useInventory } from '../../context/InventoryContext'
import { formatNumber } from '../../utils/formatters'
import EtiquetaButton from './EtiquetaButton'

export default function CountModal({ item, onClose }) {
  const { saveCount } = useInventory()

  const [selectedArm, setSelectedArm] = useState(() => {
    return item?.armazensNoFiltro?.[0] || '01'
  })
  const [quantidade, setQuantidade] = useState('')
  const [observacao, setObservacao] = useState('')
  const [validade, setValidade] = useState('')
  const [lote, setLote] = useState('')
  const [saving, setSaving] = useState(false)

  // Preenche dados anteriores se existirem
  useEffect(() => {
    if (item) {
      setQuantidade(item.qtd_contada !== null && item.qtd_contada !== undefined ? String(item.qtd_contada) : '')
      setObservacao(item.observacao || '')
    }
  }, [item])

  if (!item) return null

  const sysQty = item.quantidade || 0
  const parsedCount = quantidade !== '' ? parseFloat(quantidade) : null
  const diff = parsedCount !== null ? parsedCount - sysQty : null

  const handleSave = async (e) => {
    e.preventDefault()
    if (parsedCount === null || isNaN(parsedCount) || parsedCount < 0) {
      alert('Informe uma quantidade válida para a contagem.')
      return
    }

    setSaving(true)
    try {
      await saveCount({
        codigo: item.codigo,
        armazem: selectedArm,
        quantidade: parsedCount,
        observacao,
        validade,
        lote
      })
      onClose()
    } catch (err) {
      alert('Erro ao registrar contagem: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden space-y-4">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-xl text-xs font-black bg-[#002f6c] text-white font-mono">
                {item.codigo}
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                {item.unidade}
              </span>
            </div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white mt-1 leading-snug">
              {item.descricao}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4">
          
          {/* Seletor de Armazém da Contagem */}
          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Warehouse className="w-3.5 h-3.5 text-blue-600" />
                <span>Armazém Físico da Contagem</span>
              </span>
              {item.armazensNoFiltro?.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400">Etiqueta:</span>
                  <EtiquetaButton item={item} armazem={selectedArm} compact={true} />
                </div>
              )}
            </label>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {item.armazensNoFiltro?.map(arm => (
                <button
                  type="button"
                  key={arm}
                  onClick={() => setSelectedArm(arm)}
                  className={`p-2 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    selectedArm === arm
                      ? 'bg-[#002f6c] text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <span className="text-[10px] opacity-75">Armazém</span>
                  <span className="text-sm">{arm}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Campo Quantidade Contada */}
          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-1 flex items-center justify-between">
              <span>Quantidade Contada ({item.unidade})</span>
              <span className="text-slate-400 font-bold font-mono">
                Saldo Sistema: {formatNumber(sysQty)}
              </span>
            </label>

            <div className="relative">
              <Calculator className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="number"
                step="any"
                required
                autoFocus
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 pl-11 pr-4 text-base font-black text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#002f6c]"
              />
            </div>

            {/* Preview de Divergência em Tempo Real */}
            {diff !== null && (
              <div className={`mt-2 p-2.5 rounded-xl text-xs font-black flex items-center justify-between ${
                Math.abs(diff) < 0.0001
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200'
                  : diff > 0
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200'
              }`}>
                <span>Resultado:</span>
                <span>
                  {Math.abs(diff) < 0.0001
                    ? '✔ Estoque 100% Acurado'
                    : diff > 0
                    ? `Sobra de +${formatNumber(diff)} ${item.unidade} (Ganho)`
                    : `Falta de ${formatNumber(diff)} ${item.unidade} (Perda)`
                  }
                </span>
              </div>
            )}
          </div>

          {/* Observação */}
          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-1 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>Observação (Opcional)</span>
            </label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Material avariado, conferido no mezanino..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#002f6c]"
            />
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer touch-active disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Salvando...' : 'Salvar Contagem'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  )
}
