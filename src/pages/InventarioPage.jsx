import React, { useState } from 'react'
import { 
  Package, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  ChevronLeft, 
  ChevronRight,
  Layers
} from 'lucide-react'
import { useInventory } from '../context/InventoryContext'
import Scoreboard from '../components/inventario/Scoreboard'
import DailyGoalBanner from '../components/inventario/DailyGoalBanner'
import FilterBar from '../components/inventario/FilterBar'
import InventoryCard from '../components/inventario/InventoryCard'
import InventoryTable from '../components/inventario/InventoryTable'
import CountModal from '../components/inventario/CountModal'
import AuditHistoryModal from '../components/inventario/AuditHistoryModal'
import { formatNumber } from '../utils/formatters'

const ITEMS_PER_PAGE = 50

export default function InventarioPage() {
  const { filteredItems, kpis, loading } = useInventory()

  const [currentPage, setCurrentPage] = useState(1)
  const [activeCountItem, setActiveCountItem] = useState(null)
  const [activeAuditItem, setActiveAuditItem] = useState(null)

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE) || 1
  const validPage = Math.min(Math.max(1, currentPage), totalPages)

  const startIndex = (validPage - 1) * ITEMS_PER_PAGE
  const pageItems = filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  return (
    <div className="space-y-4 pb-16 max-w-7xl mx-auto px-3 sm:px-6 pt-4">
      
      {/* 1. KPIs Rápidos do Inventário */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
        
        {/* Com Saldo */}
        <div className="bg-white dark:bg-slate-800/90 p-3.5 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Com Saldo</span>
            <Package className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">
              {formatNumber(kpis.itensComSaldoCount)}
            </span>
            <span className="text-[10px] text-slate-400 block">
              de {formatNumber(kpis.totalCadastrados)} cadastrados
            </span>
          </div>
        </div>

        {/* Acurados */}
        <div className="bg-white dark:bg-slate-800/90 p-3.5 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Acurados</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
              {formatNumber(kpis.acuradosCount)}
            </span>
            <span className="text-[10px] font-bold text-emerald-600 block">
              {kpis.pctAcurados}% acurácia
            </span>
          </div>
        </div>

        {/* Ganhos / Sobras */}
        <div className="bg-white dark:bg-slate-800/90 p-3.5 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Ganhos</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-black text-blue-700 dark:text-blue-400 font-mono">
              {formatNumber(kpis.ganhosCount)}
            </span>
            <span className="text-[10px] font-bold text-blue-600 block">
              {kpis.pctGanhos}% dos contados
            </span>
          </div>
        </div>

        {/* Perdas / Faltas */}
        <div className="bg-white dark:bg-slate-800/90 p-3.5 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-rose-600 tracking-wider">Perdas</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-black text-rose-700 dark:text-rose-400 font-mono">
              {formatNumber(kpis.perdasCount)}
            </span>
            <span className="text-[10px] font-bold text-rose-600 block">
              {kpis.pctPerdas}% dos contados
            </span>
          </div>
        </div>

        {/* Volume Total */}
        <div className="hidden lg:flex bg-white dark:bg-slate-800/90 p-3.5 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-sm flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Volume Físico</span>
            <BarChart3 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">
              {formatNumber(kpis.volumeTotal)}
            </span>
            <span className="text-[10px] text-slate-400 block">
              itens em estoque
            </span>
          </div>
        </div>

      </div>

      {/* 2. Placar de Troca de Etiquetas */}
      <Scoreboard />

      {/* 3. Meta Diária de 15 Itens */}
      <DailyGoalBanner />

      {/* 4. Barra de Filtros e Busca Rápida */}
      <FilterBar />

      {/* 5. Listagem de Produtos (Tabela Desktop / Cards Mobile) */}
      {loading ? (
        <div className="py-20 text-center text-xs font-bold text-slate-400 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
          Carregando catálogo e inventário...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-16 text-center text-xs font-bold text-slate-400 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
          Nenhum produto encontrado para os filtros selecionados.
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <InventoryTable
              items={pageItems}
              onOpenCount={(item) => setActiveCountItem(item)}
              onOpenAudit={(item) => setActiveAuditItem(item)}
            />
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {pageItems.map(item => (
              <InventoryCard
                key={item.codigo}
                item={item}
                onOpenCount={(i) => setActiveCountItem(i)}
                onOpenAudit={(i) => setActiveAuditItem(i)}
              />
            ))}
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <span className="text-xs font-bold text-slate-500">
              Mostrando {startIndex + 1} a {Math.min(startIndex + ITEMS_PER_PAGE, filteredItems.length)} de {filteredItems.length} itens
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={validPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-mono font-black text-slate-800 dark:text-slate-200 px-2">
                {validPage} / {totalPages}
              </span>

              <button
                type="button"
                disabled={validPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modais */}
      {activeCountItem && (
        <CountModal
          item={activeCountItem}
          onClose={() => setActiveCountItem(null)}
        />
      )}

      {activeAuditItem && (
        <AuditHistoryModal
          item={activeAuditItem}
          onClose={() => setActiveAuditItem(null)}
        />
      )}

    </div>
  )
}
