import React, { useState, useEffect } from 'react'
import { X, History, Clock, User, Tag, Clipboard } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../utils/formatters'

export default function AuditHistoryModal({ item, onClose }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!item?.codigo) return
    const fetchLogs = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('auditoria_estoque')
          .select('*')
          .eq('produto', item.codigo)
          .order('created_at', { ascending: false })
          .limit(50)

        if (!error && data) {
          setLogs(data)
        }
      } catch (e) {
        console.warn('Erro ao buscar auditoria:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchLogs()
  }, [item?.codigo])

  if (!item) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                Histórico de Auditoria
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                {item.codigo} • {item.descricao}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of audit logs */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-2.5">
          {loading ? (
            <div className="py-12 text-center text-xs font-bold text-slate-400">
              Carregando registros de auditoria...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700">
              Nenhuma ação registrada para este produto até o momento.
            </div>
          ) : (
            logs.map(log => (
              <div
                key={log.id || log.created_at}
                className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    {log.acao?.includes('ETIQUETA') ? (
                      <Tag className="w-3.5 h-3.5 text-amber-600" />
                    ) : (
                      <Clipboard className="w-3.5 h-3.5 text-teal-600" />
                    )}
                    <span>{log.acao}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(log.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                  {log.detalhes}
                </p>

                <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-0.5 border-t border-slate-200/40 dark:border-slate-700/40">
                  <User className="w-3 h-3" />
                  <span>{log.usuario_nome} ({log.usuario_matricula})</span>
                  <span>•</span>
                  <span>Armazém {log.armazem}</span>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  )
}
