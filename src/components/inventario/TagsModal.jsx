import React, { useState, useEffect } from 'react'
import { X, Tag, Plus, Check } from 'lucide-react'
import { useInventory } from '../../context/InventoryContext'

export default function TagsModal({ item, onClose }) {
  const { availableTags, updateProductTags } = useInventory()
  const [tags, setTags] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (item) {
      const initial = item.tags 
        ? item.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
        : []
      setTags(initial)
    }
  }, [item])

  if (!item) return null

  const handleAddFromInput = (e) => {
    e?.preventDefault()
    const trimmed = inputValue.trim().toLowerCase()
    if (!trimmed) return
    const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean)
    const newTags = [...tags]
    parts.forEach(p => {
      if (!newTags.includes(p)) newTags.push(p)
    })
    setTags(newTags)
    setInputValue('')
  }

  const handleToggleTag = (tagKey) => {
    if (tags.includes(tagKey)) {
      setTags(tags.filter(t => t !== tagKey))
    } else {
      setTags([...tags, tagKey])
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProductTags(item.codigo, tags)
      onClose()
    } catch (err) {
      alert('Erro ao salvar tags: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const unusedTags = availableTags.filter(t => !tags.includes(t.key))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Gerenciar Tags
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
          {/* Tags Atuais */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Tags Vinculadas
            </label>
            <div className="flex flex-wrap gap-1.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 min-h-[44px] items-center">
              {tags.length === 0 ? (
                <span className="text-xs text-slate-400 font-semibold italic">
                  Nenhuma tag associada a este material.
                </span>
              ) : (
                tags.map(t => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                  >
                    <span>{t}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleTag(t)}
                      className="hover:text-rose-600 transition-colors ml-0.5"
                      title="Remover Tag"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Adicionar Nova Tag */}
          <form onSubmit={handleAddFromInput} className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Digite nova tag (ex: curvas, conexões)..."
              className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#002f6c]"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          </form>

          {/* Sugestões de Tags Existentes */}
          {unusedTags.length > 0 && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Tags Cadastradas no Sistema (Clique para vincular)
              </label>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700">
                {unusedTags.map(t => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => handleToggleTag(t.key)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-indigo-600" />
                    <span>{t.label}</span>
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
              <span>{saving ? 'Salvando...' : 'Salvar Tags'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}