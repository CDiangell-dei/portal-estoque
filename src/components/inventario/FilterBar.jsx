import React, { useState, useRef, useEffect } from 'react'
import { 
  Search, 
  X, 
  Warehouse, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Navigation,
  ChevronDown,
  Tag as TagIcon,
  Truck,
  RotateCw,
  FileSpreadsheet,
  Zap,
  Filter,
  Upload
} from 'lucide-react'
import { useInventory } from '../../context/InventoryContext'
import { useAuth } from '../../context/AuthContext'
import { exportInventarioExcel } from '../../utils/exportExcel'

export default function FilterBar({ onOpenMassCount, onOpenImportSaldo }) {
  const { sector } = useAuth()
  const {
    search,
    setSearch,
    availableArmazens,
    selectedArmazens,
    setSelectedArmazens,
    selectedStatuses,
    setSelectedStatuses,
    availableTags,
    selectedTags,
    setSelectedTags,
    isExcludeTagMode,
    setIsExcludeTagMode,
    availableFornecedores,
    selectedFornecedores,
    setSelectedFornecedores,
    isExcludeFornMode,
    setIsExcludeFornMode,
    saldoFilterMode,
    setSaldoFilterMode,
    etiquetaFilterMode,
    setEtiquetaFilterMode,
    isRouteSortActive,
    setIsRouteSortActive,
    filteredItems,
    reload,
    loading
  } = useInventory()

  const [armDropdownOpen, setArmDropdownOpen] = useState(false)
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const [fornDropdownOpen, setFornDropdownOpen] = useState(false)

  const [tagSearch, setTagSearch] = useState('')
  const [fornSearch, setFornSearch] = useState('')

  const armRef = useRef(null)
  const tagRef = useRef(null)
  const fornRef = useRef(null)

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (armRef.current && !armRef.current.contains(e.target)) setArmDropdownOpen(false)
      if (tagRef.current && !tagRef.current.contains(e.target)) setTagDropdownOpen(false)
      if (fornRef.current && !fornRef.current.contains(e.target)) setFornDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Armazéns
  const toggleArmazem = (arm) => {
    if (selectedArmazens.includes(arm)) {
      setSelectedArmazens(selectedArmazens.filter(a => a !== arm))
    } else {
      setSelectedArmazens([...selectedArmazens, arm])
    }
  }

  const selectAllArmazens = (select) => {
    setSelectedArmazens(select ? [...availableArmazens] : [])
  }

  // Status
  const toggleStatus = (status) => {
    if (selectedStatuses.includes(status)) {
      setSelectedStatuses(selectedStatuses.filter(s => s !== status))
    } else {
      setSelectedStatuses([...selectedStatuses, status])
    }
  }

  // Tags
  const toggleTag = (key) => {
    if (selectedTags.includes(key)) {
      setSelectedTags(selectedTags.filter(t => t !== key))
    } else {
      setSelectedTags([...selectedTags, key])
    }
  }

  const selectAllTags = (select) => {
    if (select) {
      setSelectedTags(['__no_tag__', ...availableTags.map(t => t.key)])
    } else {
      setSelectedTags([])
    }
  }

  const filteredAvailableTags = availableTags.filter(t => 
    t.label.toLowerCase().includes(tagSearch.toLowerCase())
  )

  const getTagLabel = () => {
    if (selectedTags.length === 0) return 'Todas as Tags'
    if (selectedTags.length === 1 && selectedTags[0] === '__no_tag__') {
      return isExcludeTagMode ? 'Excluindo Sem Tag' : 'Apenas Sem Tag'
    }
    return isExcludeTagMode 
      ? `Excluindo ${selectedTags.length} tag(s)` 
      : `${selectedTags.length} tag(s)`
  }

  // Fornecedores
  const toggleFornecedor = (key) => {
    if (selectedFornecedores.includes(key)) {
      setSelectedFornecedores(selectedFornecedores.filter(f => f !== key))
    } else {
      setSelectedFornecedores([...selectedFornecedores, key])
    }
  }

  const selectAllFornecedores = (select) => {
    if (select) {
      setSelectedFornecedores(['__no_forn__', ...availableFornecedores.map(f => f.key)])
    } else {
      setSelectedFornecedores([])
    }
  }

  const filteredAvailableFornecedores = availableFornecedores.filter(f => 
    f.label.toLowerCase().includes(fornSearch.toLowerCase())
  )

  const getFornLabel = () => {
    if (selectedFornecedores.length === 0) return 'Todos os Fornecedores'
    if (selectedFornecedores.length === 1 && selectedFornecedores[0] === '__no_forn__') {
      return isExcludeFornMode ? 'Excluindo Sem Forn.' : 'Apenas Sem Forn.'
    }
    return isExcludeFornMode 
      ? `Excluindo ${selectedFornecedores.length} forn.` 
      : `${selectedFornecedores.length} forn.`
  }

  return (
    <div className="bg-white dark:bg-slate-800/90 p-3 sm:p-4 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-sm space-y-3.5 w-full max-w-full overflow-hidden">
      
      {/* 1. Linha Superior: Busca Rápida + Ações Operacionais */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-2.5">
        
        {/* Input de Busca Rápida */}
        <div className="relative w-full lg:flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, descrição, endereço, fornecedor ou tag..."
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 pl-10 pr-9 text-xs font-bold text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002f6c]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Botões Operacionais da Barra */}
        <div className="flex items-center gap-1.5 w-full lg:w-auto flex-wrap justify-between lg:justify-end">
          
          {/* Lançamento em Massa */}
          <button
            type="button"
            onClick={onOpenMassCount}
            className="px-3 py-2 rounded-2xl text-xs font-black bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            title="Lançar múltiplas contagens simultâneas em lote"
          >
            <Zap className="w-3.5 h-3.5 text-slate-950" />
            <span>⚡ Em Massa</span>
          </button>

          {/* Importar Saldo */}
          <button
            type="button"
            onClick={onOpenImportSaldo}
            className="px-3 py-2 rounded-2xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            title="Importar planilha de saldo do ERP (CSV ou Excel)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar Saldo</span>
          </button>

          {/* Exportar Excel */}
          <button
            type="button"
            onClick={() => exportInventarioExcel(filteredItems, sector)}
            className="px-3 py-2 rounded-2xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            title="Exportar itens filtrados para planilha Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exportar</span>
          </button>

          {/* Atualizar Banco */}
          <button
            type="button"
            onClick={() => reload(false)}
            disabled={loading}
            className="px-3 py-2 rounded-2xl text-xs font-bold bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
            title="Recarregar saldos e contagens do banco"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          {/* Rota Física (Galpão) */}
          <button
            type="button"
            onClick={() => setIsRouteSortActive(!isRouteSortActive)}
            className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              isRouteSortActive
                ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300'
                : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
            }`}
            title="Ordenar a lista pela sequência física de ruas e prateleiras do galpão"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rota Física</span>
          </button>

        </div>

      </div>

      {/* 2. Linha Intermediária: Dropdowns de Filtros (Armazéns, Tags, Fornecedores, Saldo, Etiquetas) */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
        
        {/* Dropdown de Armazéns */}
        <div ref={armRef} className="relative">
          <button
            type="button"
            onClick={() => setArmDropdownOpen(!armDropdownOpen)}
            className={`px-3 py-1.5 rounded-2xl text-xs font-black border flex items-center gap-1.5 cursor-pointer transition-all ${
              selectedArmazens.length < availableArmazens.length && selectedArmazens.length > 0
                ? 'bg-blue-50 border-blue-300 text-blue-900 dark:bg-blue-950/40 dark:border-blue-700 dark:text-blue-200'
                : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Warehouse className="w-3.5 h-3.5 text-blue-600" />
            <span>
              {selectedArmazens.length === availableArmazens.length
                ? 'Todos os Armazéns'
                : selectedArmazens.length === 0
                ? 'Nenhum Armazém'
                : `${selectedArmazens.length} armazém(ns)`
              }
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {armDropdownOpen && (
            <div className="absolute left-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-30 p-2.5 space-y-1">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400">
                <span>Armazéns</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => selectAllArmazens(true)} className="text-blue-600 hover:underline">Todos</button>
                  <button type="button" onClick={() => selectAllArmazens(false)} className="text-rose-600 hover:underline">Nenhum</button>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5 pt-1">
                {availableArmazens.map(arm => (
                  <label
                    key={arm}
                    className="flex items-center gap-2 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={selectedArmazens.includes(arm)}
                      onChange={() => toggleArmazem(arm)}
                      className="rounded border-slate-300 text-[#002f6c] focus:ring-[#002f6c]"
                    />
                    <span>Armazém {arm}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dropdown de Tags */}
        <div ref={tagRef} className="relative">
          <button
            type="button"
            onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
            className={`px-3 py-1.5 rounded-2xl text-xs font-black border flex items-center gap-1.5 cursor-pointer transition-all ${
              selectedTags.length > 0
                ? isExcludeTagMode
                  ? 'bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/40 dark:border-rose-700 dark:text-rose-200'
                  : 'bg-indigo-50 border-indigo-300 text-indigo-900 dark:bg-indigo-950/40 dark:border-indigo-700 dark:text-indigo-200'
                : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            <TagIcon className={`w-3.5 h-3.5 ${isExcludeTagMode ? 'text-rose-600' : 'text-indigo-600'}`} />
            <span>{getTagLabel()}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {tagDropdownOpen && (
            <div className="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-30 p-3 space-y-2">
              
              {/* Header com ações rápidas */}
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Filtrar por Tags</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => selectAllTags(true)} className="text-[10px] font-bold text-[#002f6c] dark:text-blue-400 hover:underline">Todos</button>
                  <button type="button" onClick={() => selectAllTags(false)} className="text-[10px] font-bold text-rose-600 hover:underline">Desmarcar</button>
                </div>
              </div>

              {/* Modo Inverso: Excluir Tags */}
              <label className="flex items-center gap-2 p-1.5 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 rounded-xl cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isExcludeTagMode}
                  onChange={(e) => setIsExcludeTagMode(e.target.checked)}
                  className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-[11px] font-black text-rose-700 dark:text-rose-300">
                  Modo Inverso: Excluir Tags
                </span>
              </label>

              {/* Opção Sem Tag */}
              <label className="flex items-center gap-2 p-1.5 hover:bg-amber-50/60 dark:hover:bg-amber-950/30 rounded-xl cursor-pointer border-b border-slate-100 dark:border-slate-800">
                <input
                  type="checkbox"
                  checked={selectedTags.includes('__no_tag__')}
                  onChange={() => toggleTag('__no_tag__')}
                  className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-xs font-black text-amber-800 dark:text-amber-300">
                  ⚪ Materiais Sem Tag
                </span>
              </label>

              {/* Campo de Busca de Tags */}
              {availableTags.length > 5 && (
                <input
                  type="text"
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder="Buscar tag..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-white"
                />
              )}

              {/* Lista de Tags */}
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {filteredAvailableTags.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic p-1">Nenhuma tag cadastrada.</p>
                ) : (
                  filteredAvailableTags.map(t => (
                    <label
                      key={t.key}
                      className="flex items-center gap-2 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(t.key)}
                        onChange={() => toggleTag(t.key)}
                        className="rounded border-slate-300 text-[#002f6c] focus:ring-[#002f6c]"
                      />
                      <span className="truncate">{t.label}</span>
                    </label>
                  ))
                )}
              </div>

            </div>
          )}
        </div>

        {/* Dropdown de Fornecedores */}
        <div ref={fornRef} className="relative">
          <button
            type="button"
            onClick={() => setFornDropdownOpen(!fornDropdownOpen)}
            className={`px-3 py-1.5 rounded-2xl text-xs font-black border flex items-center gap-1.5 cursor-pointer transition-all ${
              selectedFornecedores.length > 0
                ? isExcludeFornMode
                  ? 'bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/40 dark:border-rose-700 dark:text-rose-200'
                  : 'bg-teal-50 border-teal-300 text-teal-900 dark:bg-teal-950/40 dark:border-teal-700 dark:text-teal-200'
                : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Truck className={`w-3.5 h-3.5 ${isExcludeFornMode ? 'text-rose-600' : 'text-teal-600'}`} />
            <span>{getFornLabel()}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {fornDropdownOpen && (
            <div className="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-30 p-3 space-y-2">
              
              {/* Header com ações rápidas */}
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Filtrar por Fornecedor</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => selectAllFornecedores(true)} className="text-[10px] font-bold text-[#002f6c] dark:text-blue-400 hover:underline">Todos</button>
                  <button type="button" onClick={() => selectAllFornecedores(false)} className="text-[10px] font-bold text-rose-600 hover:underline">Desmarcar</button>
                </div>
              </div>

              {/* Modo Inverso: Excluir Fornecedores */}
              <label className="flex items-center gap-2 p-1.5 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 rounded-xl cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isExcludeFornMode}
                  onChange={(e) => setIsExcludeFornMode(e.target.checked)}
                  className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-[11px] font-black text-rose-700 dark:text-rose-300">
                  Modo Inverso: Excluir Fornecedores
                </span>
              </label>

              {/* Opção Sem Fornecedor */}
              <label className="flex items-center gap-2 p-1.5 hover:bg-amber-50/60 dark:hover:bg-amber-950/30 rounded-xl cursor-pointer border-b border-slate-100 dark:border-slate-800">
                <input
                  type="checkbox"
                  checked={selectedFornecedores.includes('__no_forn__')}
                  onChange={() => toggleFornecedor('__no_forn__')}
                  className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-xs font-black text-amber-800 dark:text-amber-300">
                  ⚪ Materiais Sem Fornecedor
                </span>
              </label>

              {/* Campo de Busca de Fornecedores */}
              {availableFornecedores.length > 5 && (
                <input
                  type="text"
                  value={fornSearch}
                  onChange={(e) => setFornSearch(e.target.value)}
                  placeholder="Buscar fornecedor..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-white"
                />
              )}

              {/* Lista de Fornecedores */}
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {filteredAvailableFornecedores.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic p-1">Nenhum fornecedor cadastrado.</p>
                ) : (
                  filteredAvailableFornecedores.map(f => (
                    <label
                      key={f.key}
                      className="flex items-center gap-2 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={selectedFornecedores.includes(f.key)}
                        onChange={() => toggleFornecedor(f.key)}
                        className="rounded border-slate-300 text-[#002f6c] focus:ring-[#002f6c]"
                      />
                      <span className="truncate">{f.label}</span>
                    </label>
                  ))
                )}
              </div>

            </div>
          )}
        </div>

        {/* Seletor de Saldo */}
        <select
          value={saldoFilterMode}
          onChange={(e) => setSaldoFilterMode(e.target.value)}
          className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#002f6c] cursor-pointer"
        >
          <option value="COM_SALDO">Apenas Com Saldo (&gt; 0)</option>
          <option value="SALDO_ZERO">Apenas Saldo Zerado (= 0)</option>
          <option value="TODOS">Todos os Saldos</option>
        </select>

        {/* Seletor de Etiquetas */}
        <select
          value={etiquetaFilterMode}
          onChange={(e) => setEtiquetaFilterMode(e.target.value)}
          className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#002f6c] cursor-pointer"
        >
          <option value="TODOS">📋 Etiquetas: Todas</option>
          <option value="FALTA_TROCAR">⏳ Falta Trocar</option>
          <option value="JA_TROCADO">✔ Já Trocadas</option>
        </select>

      </div>

      {/* 3. Linha Inferior: Filtros de Status (Acurado, Ganho, Perda, Pendente) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/60">
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
          Status de Contagem:
        </span>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => toggleStatus('ACURADO')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer ${
              selectedStatuses.includes('ACURADO')
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-800 opacity-60'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Acurado</span>
          </button>

          <button
            type="button"
            onClick={() => toggleStatus('GANHO')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer ${
              selectedStatuses.includes('GANHO')
                ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-800 opacity-60'
            }`}
          >
            <TrendingUp className="w-3 h-3 text-blue-600" />
            <span>Ganho</span>
          </button>

          <button
            type="button"
            onClick={() => toggleStatus('PERDA')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer ${
              selectedStatuses.includes('PERDA')
                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-800 opacity-60'
            }`}
          >
            <TrendingDown className="w-3 h-3 text-rose-600" />
            <span>Perda</span>
          </button>

          <button
            type="button"
            onClick={() => toggleStatus('PENDENTE')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer ${
              selectedStatuses.includes('PENDENTE')
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-800 opacity-60'
            }`}
          >
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Pendente</span>
          </button>
        </div>
      </div>

    </div>
  )
}