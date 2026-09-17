import React, { useState } from 'react'
import { X, Zap, Plus, Trash2, Check, Calculator } from 'lucide-react'
import { useInventory } from '../../context/InventoryContext'

export default function MassCountModal({ onClose }) {
  const { availableArmazens, rawSb1, saveCount } = useInventory()

  const [rows, setRows] = useState([
    { id: '1', armazem: availableArmazens[0] || '01', codigo: '', qtd: '', modo: 'peso', validade: '' },
    { id: '2', armazem: availableArmazens[0] || '01', codigo: '', qtd: '', modo: 'peso', validade: '' },
    { id: '3', armazem: availableArmazens[0] || '01', codigo: '', qtd: '', modo: 'peso', validade: '' },
  ])
  const [saving, setSaving] = useState(false)

  const addRow = () => {
    setRows(prev => [
      ...prev,
      { id: String(Date.now() + Math.random()), armazem: availableArmazens[0] || '01', codigo: '', qtd: '', modo: 'peso', validade: '' }
    ])
  }

  const removeRow = (id) => {
    if (rows.length <= 1) return
    setRows(prev => prev.filter(r => r.id !== id))
  }

  const updateRow = (id, field, value) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const handleSaveAll = async () => {
    const validRows = rows.filter(r => r.codigo.trim() !== '' && !isNaN(parseFloat(r.qtd)) && parseFloat(r.qtd) >= 0)
    if (validRows.length === 0) {
      alert('Preencha ao menos uma linha com Código e Quantidade válidos.')
      return
    }

    setSaving(true)
    try {
      for (const r of validRows) {
        const prod = rawSb1.find(p => p.codigo.toUpperCase() === r.codigo.trim().toUpperCase())
        const factor = prod?.fatorConv || 1
        const rawQtd = parseFloat(r.qtd) || 0
        const total = r.modo === 'peca' ? rawQtd * factor : rawQtd

        await saveCount({
          codigo: r.codigo.trim().toUpperCase(),
          armazem: r.armazem,
          quantidade: total,
          observacao: 'Lançamento em Lote',
          validade: r.validade || ''
        })
      }
      alert(`${validRows.length} contagem(ns) salva(s) com sucesso em lote!`)
      onClose()
    } catch (err) {
      alert('Erro ao salvar lote: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Zap className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                Lançamento de Contagens em Massa
              </h3>
              <p className="text-xs text-slate-400 font-bold">
                Insira vários materiais para contagem física simultânea
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Table */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="p-2 w-32">Armazém</th>
                  <th className="p-2">Código / Produto</th>
                  <th className="p-2 w-28">Validade</th>
                  <th className="p-2 w-28">Modo</th>
                  <th className="p-2 w-28 text-right">Qtd Lançada</th>
                  <th className="p-2 w-24 text-right">Total</th>
                  <th className="p-2 w-12 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-bold">
                {rows.map(row => {
                  const prod = rawSb1.find(p => p.codigo.toUpperCase() === row.codigo.trim().toUpperCase())
                  const factor = prod?.fatorConv || 1
                  const valNum = parseFloat(row.qtd) || 0
                  const total = row.modo === 'peca' ? valNum * factor : valNum

                  return (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      {/* Armazém */}
                      <td className="p-2">
                        <select
                          value={row.armazem}
                          onChange={(e) => updateRow(row.id, 'armazem', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 text-xs font-bold text-slate-800 dark:text-white"
                        >
                          {availableArmazens.map(a => (
                            <option key={a} value={a}>Armazém {a}</option>
                          ))}
                        </select>
                      </td>

                      {/* Código / Descrição */}
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.codigo}
                          onChange={(e) => updateRow(row.id, 'codigo', e.target.value.toUpperCase())}
                          placeholder="Ex: 07000151..."
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 text-xs font-mono font-black text-slate-900 dark:text-white uppercase"
                        />
                        <span className="block text-[10px] text-slate-400 truncate mt-0.5 max-w-xs">
                          {prod ? `${prod.descricao} (Fator: ${factor})` : row.codigo ? 'Código não localizado' : 'Digite o código'}
                        </span>
                      </td>

                      {/* Validade */}
                      <td className="p-2">
                        <input
                          type="month"
                          value={row.validade}
                          onChange={(e) => updateRow(row.id, 'validade', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 text-xs font-bold text-slate-800 dark:text-white"
                        />
                      </td>

                      {/* Modo */}
                      <td className="p-2">
                        <select
                          value={row.modo}
                          onChange={(e) => updateRow(row.id, 'modo', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 text-xs font-bold text-slate-800 dark:text-white"
                        >
                          <option value="peso">⚖️ Peso</option>
                          <option value="peca">📦 Peça</option>
                        </select>
                      </td>

                      {/* Qtd Lançada */}
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={row.qtd}
                          onChange={(e) => updateRow(row.id, 'qtd', e.target.value)}
                          placeholder="0"
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 text-xs font-black text-slate-900 dark:text-white text-right"
                        />
                      </td>

                      {/* Total */}
                      <td className="p-2 text-right font-black text-emerald-600 dark:text-emerald-400">
                        {total > 0 ? total.toLocaleString('pt-BR') : '-'}
                      </td>

                      {/* Remover */}
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          disabled={rows.length <= 1}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-30 cursor-pointer"
                          title="Remover Linha"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={addRow}
            className="w-full py-2 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-amber-400 text-xs font-black text-slate-600 dark:text-slate-300 hover:text-amber-600 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Mais Uma Linha</span>
          </button>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60">
          <span className="text-xs font-bold text-slate-500">
            {rows.filter(r => r.codigo && r.qtd).length} linha(s) pronta(s) para salvar
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4 text-slate-950" />
              <span>{saving ? 'Gravando...' : 'Salvar Contagens em Lote'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}