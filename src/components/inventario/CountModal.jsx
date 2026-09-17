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
import { parseSmartMathExpression, isMathExpression } from '../../utils/mathParser'
import CalculatorKeypad from '../common/CalculatorKeypad'
import EtiquetaButton from './EtiquetaButton'

export default function CountModal({ item, onClose }) {
  const { saveCount, availableArmazens, warehouseSaldoMap, warehouseCountMap } = useInventory()

  const armOptions = (item?.armazensNoFiltro && item.armazensNoFiltro.length > 0)
    ? item.armazensNoFiltro
    : (availableArmazens?.length > 0 ? availableArmazens : ['01'])

  const [selectedArm, setSelectedArm] = useState(() => {
    return armOptions[0] || '01'
  })
  const [quantidade, setQuantidade] = useState('')
  const [observacao, setObservacao] = useState('')
  const [validade, setValidade] = useState('')
  const [lote, setLote] = useState('')
  const [saving, setSaving] = useState(false)
  const [showKeypad, setShowKeypad] = useState(false)

  // Preenche dados anteriores se existirem para o armazém selecionado
  useEffect(() => {
    if (item && selectedArm) {
      const armPad = String(selectedArm).padStart(2, '0')
      const wKey = `${armPad}_${item.codigo}`
      const existingArmCount = warehouseCountMap ? warehouseCountMap[wKey] : undefined
      if (existingArmCount !== undefined && existingArmCount !== null) {
        setQuantidade(String(existingArmCount))
      } else if (item.qtd_contada !== null && item.qtd_contada !== undefined && armOptions.length === 1) {
        setQuantidade(String(item.qtd_contada))
      } else {
        setQuantidade('')
      }
      setObservacao(item.observacao || '')
    }
  }, [item, selectedArm, warehouseCountMap])

  if (!item) return null

  const armPad = String(selectedArm || '01').padStart(2, '0')
  const wKey = `${armPad}_${item.codigo}`
  const sysQty = (warehouseSaldoMap && warehouseSaldoMap[wKey] !== undefined)
    ? warehouseSaldoMap[wKey]
    : (item.quantidade || 0)

  // Avaliação matemática inteligente em tempo real
  const evaluatedCount = parseSmartMathExpression(quantidade)
  const isFormula = isMathExpression(quantidade)
  const finalNumericCount = evaluatedCount !== null 
    ? evaluatedCount 
    : (quantidade.trim() !== '' && !isNaN(parseFloat(quantidade)) ? parseFloat(quantidade) : null)

  const diff = finalNumericCount !== null ? finalNumericCount - sysQty : null

  const handleKeypadPress = (char) => {
    if (char === 'C') {
      setQuantidade('')
    } else if (char === 'BACKSPACE') {
      setQuantidade(prev => prev.slice(0, -1))
    } else {
      setQuantidade(prev => prev + char)
    }
  }

  const handleKeypadCalculate = () => {
    if (evaluatedCount !== null) {
      setQuantidade(String(evaluatedCount))
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const resolvedQty = evaluatedCount !== null ? evaluatedCount : parseFloat(quantidade)
    if (resolvedQty === null || isNaN(resolvedQty) || resolvedQty < 0) {
      alert('Informe uma quantidade válida para a contagem.')
      return
    }

    setSaving(true)
    try {
      await saveCount({
        codigo: item.codigo,
        armazem: selectedArm,
        quantidade: resolvedQty,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden space-y-3 my-auto">
        
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

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Botão de Abrir / Fechar Calculadora */}
            <button
              type="button"
              onClick={() => setShowKeypad(!showKeypad)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border ${
                showKeypad
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
              title="Abrir ou fechar calculadora inteligente"
            >
              <Calculator className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden xs:inline">{showKeypad ? 'Fechar Calc' : 'Calculadora'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-3.5">
          
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
              {armOptions.map(arm => (
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase flex items-center gap-1.5">
                <span>Quantidade Contada ({item.unidade})</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold font-mono text-[11px]">
                  Saldo Sistema: {formatNumber(sysQty)}
                </span>
                <button
                  type="button"
                  onClick={() => setShowKeypad(!showKeypad)}
                  className="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Calculator className="w-3 h-3 text-amber-500" />
                  <span>{showKeypad ? 'Ocultar Teclado' : 'Teclado Virtual'}</span>
                </button>
              </div>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowKeypad(!showKeypad)}
                className="absolute left-3.5 top-3.5 text-slate-400 hover:text-amber-500 transition-colors cursor-pointer"
                title="Abrir teclado calculadora"
              >
                <Calculator className="w-5 h-5 text-amber-500" />
              </button>

              <input
                type="text"
                inputMode="decimal"
                required
                autoFocus
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (isFormula && evaluatedCount !== null) {
                      e.preventDefault()
                      setQuantidade(String(evaluatedCount))
                    }
                  }
                }}
                placeholder="Digite a quantidade ou fórmula (ex: 12*10+5)"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 pl-11 pr-4 text-base font-black text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#002f6c]"
              />
            </div>

            {/* Preview de Fórmula / Expressão Matemática */}
            {isFormula && (
              <div className="mt-2 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs">
                <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  <span>🧮 Cálculo em tempo real:</span>
                </span>
                <span className="font-mono font-black text-amber-900 dark:text-amber-200">
                  {evaluatedCount !== null ? `${evaluatedCount.toLocaleString('pt-BR')} ${item.unidade}` : 'Expressão incompleta...'}
                </span>
              </div>
            )}

            {/* Teclado Touch da Calculadora (se ativo) */}
            {showKeypad && (
              <div className="mt-3">
                <CalculatorKeypad
                  onKeyPress={handleKeypadPress}
                  onCalculate={handleKeypadCalculate}
                  onClose={() => setShowKeypad(false)}
                  currentValue={quantidade}
                  evaluatedValue={evaluatedCount}
                  targetLabel={`Armazém ${selectedArm}`}
                />
              </div>
            )}

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
