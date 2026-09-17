import React, { useState, useEffect } from 'react'
import { X, Truck, Plus, Check } from 'lucide-react'
import { useInventory } from '../../context/InventoryContext'

export default function FornecedoresModal({ item, onClose }) {
  const { availableFornecedores, updateProductFornecedores } = useInventory()
  const [fornecedores, setFornecedores] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (item) {
      const initial = item.fornecedores 
        ? item.fornecedores.split(/,|;/).map(f => f.trim()).filter(Boolean)
        : []
      setFornecedores(initial)
    }
  }, [item])

  if (!item) return null

  const handleAddFromInput = (e) => {
    e?.preventDefault()
    const trimmed = inputValue.trim()
    if (!trimmed) return
    const parts = trimmed.split(/,|;/).map(p => p.trim()).filter(Boolean)
    const newForns = [...fornecedores]
    parts.forEach(p => {
      const lower = p.toLowerCase()
      if (!newForns.some(f => f.toLowerCase() === lower)) {
        newForns.push(p)
      }
    })
    setFornecedores(newForns)
    setInputValue('')
  }

  const handleToggleFornecedor = (fornLabel) => {
    const lower = fornLabel.toLowerCase()
    if (fornecedores.some(f => f.toLowerCase() === lower)) {
      setFornecedores(fornecedores.filter(f => f.toLowerCase() !== lower))
    } else {
      setFornecedores([...fornecedores, fornLabel])
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProductFornecedores(item.codigo, fornecedores)
      onClose()
    } catch (err) {
      alert('Erro ao salvar fornecedores: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const selectedLowers = fornecedores.map(f => f.toLowerCase())
  const unusedFornecedores = availableFornecedores.filter(f => !selectedLowers.includes(f.key))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Gerenciar Fornecedores
              </h3>
              <p className="text-[11px] font-mono text-slate-500 font-bold">
                {item.codigo} - {item.descricao}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Fornecedores Atuais */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Fornecedores Vinculados
            </label>
            <div className="flex flex-wrap gap-1.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 min-h-[44px] items-center">
              {fornecedores.length === 0 ? (
                <span className="text-xs text-slate-400 font-semibold italic">
                  Nenhum fornecedor associado a este material.
                </span>
              ) : (
                fornecedores.map(f => (
                  <span
                    key={f}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
                  >
                    <span>{f}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleFornecedor(f)}
                      className="hover:text-rose-600 transition-colors ml-0.5"
                      title="Remover Fornecedor"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Adicionar Novo Fornecedor */}
          <form onSubmit={handleAddFromInput} className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Digite novo fornecedor (ex: Gerdau, ArcelorMittal)..."
              className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#002f6c]"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black shadow-xs flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          </form>

          {/* Sugestões de Fornecedores Existentes */}
          {unusedFornecedores.length > 0 && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Fornecedores Cadastrados no Sistema (Clique para vincular)
              </label>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700">
                {unusedFornecedores.map(f => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => handleToggleFornecedor(f.label)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-teal-600" />
                    <span>{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#002f6c] hover:bg-[#00204a] text-white text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'Salvando...' : 'Salvar Fornecedores'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}