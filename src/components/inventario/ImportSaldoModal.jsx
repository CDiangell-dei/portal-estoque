import React, { useState, useRef } from 'react'
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  RefreshCw,
  Info
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { useInventory } from '../../context/InventoryContext'
import { useAuth } from '../../context/AuthContext'
import { formatNumber } from '../../utils/formatters'

export default function ImportSaldoModal({ onClose }) {
  const { sector } = useAuth()
  const { reload } = useInventory()

  const isIndustria = sector === 'INDUSTRIA'
  const tableName = isIndustria ? 'saldo_industria' : 'saldo_comercio'
  const sectorLabel = isIndustria ? 'Indústria' : 'Comércio'

  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [parsedData, setParsedData] = useState([])
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState(null)
  const [stats, setStats] = useState(null)

  // Status de execução: 'idle' | 'importing' | 'completed' | 'error'
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [statusMsg, setStatusMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Parser inteligente de arquivos CSV e Excel
  const parseFile = async (selectedFile) => {
    setParsing(true)
    setParseError(null)
    setParsedData([])
    setStats(null)

    try {
      const buffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        throw new Error('Nenhuma planilha encontrada no arquivo.')
      }

      const worksheet = workbook.Sheets[firstSheetName]
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })

      if (!rawRows || rawRows.length < 2) {
        throw new Error('Arquivo vazio ou sem linhas de dados suficientes.')
      }

      // Procurar linha de cabeçalhos
      let headerRowIdx = 0
      let headers = rawRows[0].map(h => String(h).trim().toUpperCase())

      const matchHeaders = (hdrs) => {
        let f = -1, p = -1, a = -1, q = -1, c = -1, e = -1
        hdrs.forEach((h, idx) => {
          const clean = h.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()
          if (clean.includes('FILIAL') || clean === 'B2_FILIAL') f = idx
          else if (clean.includes('PROD') || clean.includes('COD') || clean === 'B2_COD' || clean.includes('MATER')) p = idx
          else if (clean.includes('ARM') || clean.includes('LOC') || clean === 'B2_LOCAL' || clean.includes('DEP')) a = idx
          else if (clean.includes('QTD') || clean.includes('QUANT') || clean.includes('SALDO') || clean === 'B2_QATU') q = idx
          else if (clean.includes('CUSTO') || clean.includes('PRECO') || clean.includes('VALOR') || clean.includes('CM1') || clean.includes('UNIT') || clean === 'B2_CM1') c = idx
          else if (clean.includes('ENDER') || clean.includes('RUA') || clean.includes('LOCALIZ') || clean === 'B2_LOCALIZ') e = idx
        })
        return { f, p, a, q, c, e }
      }

      let matched = matchHeaders(headers)
      if (matched.p === -1 && matched.q === -1 && rawRows.length > 1) {
        // Tentar linha 1 caso haja título na primeira linha
        const nextHeaders = rawRows[1].map(h => String(h).trim().toUpperCase())
        const nextMatched = matchHeaders(nextHeaders)
        if (nextMatched.p !== -1 || nextMatched.q !== -1) {
          headerRowIdx = 1
          headers = nextHeaders
          matched = nextMatched
        }
      }

      const idxFilial = matched.f
      const idxProduto = matched.p
      const idxArmazem = matched.a
      const idxQtd = matched.q
      const idxCusto = matched.c
      const idxEndereco = matched.e

      const hasHeader = idxProduto !== -1 || idxArmazem !== -1 || idxQtd !== -1
      const startLine = hasHeader ? headerRowIdx + 1 : 0

      const payload = []
      const distinctArmazens = new Set()
      let totalQtd = 0

      for (let i = startLine; i < rawRows.length; i++) {
        const parts = rawRows[i]
        if (!parts || parts.length < 2) continue

        let filial = '01'
        let armazem = '01'
        let produto = ''
        let quantidade = 0
        let custo_unitario = null
        let endereco = ''

        if (hasHeader) {
          if (idxFilial !== -1 && parts[idxFilial] !== undefined) {
            filial = String(parts[idxFilial]).trim().padStart(2, '0')
          }
          if (idxProduto !== -1 && parts[idxProduto] !== undefined) {
            produto = String(parts[idxProduto]).trim()
          }
          if (idxArmazem !== -1 && parts[idxArmazem] !== undefined) {
            armazem = String(parts[idxArmazem]).trim().padStart(2, '0')
          }
          if (idxQtd !== -1 && parts[idxQtd] !== undefined) {
            const rawQtd = String(parts[idxQtd]).trim().replace(/\./g, '').replace(',', '.')
            quantidade = parseFloat(rawQtd) || 0
          }
          if (idxCusto !== -1 && parts[idxCusto] !== undefined) {
            const rawCusto = String(parts[idxCusto]).trim().replace('R$', '').trim().replace(/\./g, '').replace(',', '.')
            const parsedCusto = parseFloat(rawCusto)
            if (!isNaN(parsedCusto) && parsedCusto >= 0) custo_unitario = parsedCusto
          }
          if (idxEndereco !== -1 && parts[idxEndereco] !== undefined) {
            endereco = String(parts[idxEndereco]).trim()
          }
        } else {
          // Heurística posicional se não houver cabeçalhos
          if (parts.length >= 4) {
            filial = String(parts[0]).trim().padStart(2, '0')
            const col1 = String(parts[1]).trim()
            const col2 = String(parts[2]).trim()
            const rawQtd = String(parts[3]).trim().replace(/\./g, '').replace(',', '.')
            quantidade = parseFloat(rawQtd) || 0

            if (col1.length > col2.length) {
              produto = col1
              armazem = col2.padStart(2, '0')
            } else {
              armazem = col1.padStart(2, '0')
              produto = col2
            }

            if (parts.length >= 5) {
              const rawCusto = String(parts[4]).trim().replace('R$', '').trim().replace(/\./g, '').replace(',', '.')
              const parsedCusto = parseFloat(rawCusto)
              if (!isNaN(parsedCusto) && parsedCusto >= 0) custo_unitario = parsedCusto
            }
          } else if (parts.length === 3) {
            const col0 = String(parts[0]).trim()
            const col1 = String(parts[1]).trim()
            const rawQtd = String(parts[2]).trim().replace(/\./g, '').replace(',', '.')
            quantidade = parseFloat(rawQtd) || 0

            if (col0.length > col1.length) {
              produto = col0
              armazem = col1.padStart(2, '0')
            } else {
              armazem = col0.padStart(2, '0')
              produto = col1
            }
          }
        }

        // Proteção extra: se armazem tiver mais caracteres que o produto, inverter
        if (armazem.length > 4 && produto.length <= 4) {
          const tmp = armazem
          armazem = produto.padStart(2, '0')
          produto = tmp
        }

        // Se produto for puramente numérico e menor que 8 dígitos, formata com zeros à esquerda
        if (/^\d+$/.test(produto) && produto.length < 8) {
          produto = produto.padStart(8, '0')
        }

        produto = produto.toUpperCase()
        if (!produto) continue

        // Ignora saldo zerado para manter a base leve e veloz
        if (Math.abs(quantidade) < 0.0001) continue

        payload.push({
          filial,
          produto,
          armazem,
          quantidade,
          custo_unitario,
          endereco
        })

        distinctArmazens.add(armazem)
        totalQtd += quantidade
      }

      if (payload.length === 0) {
        throw new Error('Nenhum registro com saldo ativo (> 0) foi identificado no arquivo.')
      }

      setParsedData(payload)
      setStats({
        totalLinhas: payload.length,
        armazens: Array.from(distinctArmazens).sort(),
        volumeTotal: totalQtd,
        amostra: payload.slice(0, 5)
      })

    } catch (err) {
      console.error('Erro no parser do arquivo:', err)
      setParseError(err.message || 'Falha ao processar a planilha.')
      setParsedData([])
      setStats(null)
    } finally {
      setParsing(false)
    }
  }

  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (selected) {
      setFile(selected)
      parseFile(selected)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    if (status === 'importing') return
    const dropped = e.dataTransfer.files[0]
    if (dropped) {
      setFile(dropped)
      parseFile(dropped)
    }
  }

  // Executar a importação no Supabase
  const handleExecuteImport = async () => {
    if (!parsedData || parsedData.length === 0) return

    setStatus('importing')
    setProgress(5)
    setStatusMsg(`Limpando base anterior de ${tableName}...`)
    setErrorMsg('')

    try {
      // 1. Limpeza da tabela via RPC clear_saldo_table
      const { error: truncateError } = await supabase.rpc('clear_saldo_table', {
        p_table: tableName
      })

      if (truncateError) {
        throw new Error(`Falha ao limpar base anterior: ${truncateError.message}`)
      }

      // 2. Inserção em lotes de 500 via RPC import_saldo_lote
      const batchSize = 500
      const totalItems = parsedData.length
      let inserted = 0

      for (let i = 0; i < totalItems; i += batchSize) {
        const chunk = parsedData.slice(i, i + batchSize)
        
        const { error: insertError } = await supabase.rpc('import_saldo_lote', {
          p_table: tableName,
          p_rows: chunk
        })

        if (insertError) {
          throw new Error(`Falha ao inserir lote (${inserted + 1} - ${inserted + chunk.length}): ${insertError.message}`)
        }

        inserted += chunk.length
        const currentPct = Math.min(Math.round((inserted / totalItems) * 90) + 5, 95)
        setProgress(currentPct)
        setStatusMsg(`Importados ${inserted.toLocaleString('pt-BR')} de ${totalItems.toLocaleString('pt-BR')} itens...`)
      }

      // 3. Sucesso e recarregamento dos dados
      setProgress(100)
      setStatusMsg('Atualizando estoque no painel...')
      await reload(false)

      setStatus('completed')
    } catch (err) {
      console.error('Erro na execução do import:', err)
      setStatus('error')
      setErrorMsg(err.message || 'Erro inesperado durante a importação.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                Importar Saldo do ERP
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                  {sectorLabel}
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-bold">
                Carregue a planilha Protheus SB2 para sincronizar os saldos contábeis
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={status === 'importing'}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">

          {/* Aviso Informativo */}
          <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl p-3.5 space-y-1.5 text-indigo-950 dark:text-indigo-200">
            <div className="flex items-center gap-1.5 font-black text-[11px] text-indigo-700 dark:text-indigo-300">
              <Info className="w-4 h-4" />
              <span>Diretrizes da Importação ERP ({sectorLabel})</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
              Tabela de destino: <code className="font-mono font-black text-indigo-600 dark:text-indigo-400">{tableName}</code>. 
              Ao concluir a importação, o saldo contábil anterior será substituído pelos dados desta nova planilha.
            </p>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 pt-0.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>As contagens físicas e histórico de auditoria são preservados com segurança.</span>
            </div>
          </div>

          {/* Upload Dropzone (visível quando não concluído com sucesso) */}
          {status !== 'completed' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileChange}
                disabled={status === 'importing'}
                className="hidden"
              />

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => {
                  if (status !== 'importing' && fileInputRef.current) {
                    fileInputRef.current.click()
                  }
                }}
                className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all ${
                  status === 'importing' 
                    ? 'border-slate-200 bg-slate-50 dark:bg-slate-800/30 opacity-60 cursor-not-allowed'
                    : file
                    ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-800/40'
                }`}
              >
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400">
                    <FileSpreadsheet className="w-8 h-8" />
                  </div>
                  {file ? (
                    <div>
                      <p className="font-black text-slate-800 dark:text-white text-xs sm:text-sm">
                        {file.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {(file.size / 1024).toFixed(1)} KB • Clique ou arraste para trocar
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-black text-slate-700 dark:text-slate-200 text-xs sm:text-sm">
                        Clique para selecionar ou arraste o arquivo aqui
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Formatos suportados: CSV (.csv) e Excel (.xlsx, .xls)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Estado de Parsing */}
          {parsing && (
            <div className="flex items-center justify-center gap-2 p-4 text-indigo-600 dark:text-indigo-400 font-bold">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Analisando e validando linhas da planilha...</span>
            </div>
          )}

          {/* Erro de Parse */}
          {parseError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
              <div>
                <p className="font-black text-xs">Erro ao processar planilha</p>
                <p className="text-[11px] mt-0.5">{parseError}</p>
              </div>
            </div>
          )}

          {/* Resumo do Arquivo Validado */}
          {stats && status !== 'completed' && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Itens Válidos</span>
                  <span className="text-base font-black text-slate-800 dark:text-white font-mono">
                    {formatNumber(stats.totalLinhas)}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Volume Total</span>
                  <span className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono">
                    {formatNumber(stats.volumeTotal)}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Armazéns</span>
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                    {stats.armazens.join(', ')}
                  </span>
                </div>
              </div>

              {/* Tabela de Amostra */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 overflow-hidden">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Pré-visualização (Primeiros 5 registros)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead>
                      <tr className="bg-slate-100/50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-700 text-[10px]">
                        <th className="p-1.5 pl-3">Filial</th>
                        <th className="p-1.5">Produto</th>
                        <th className="p-1.5">Armazém</th>
                        <th className="p-1.5 text-right">Quantidade</th>
                        <th className="p-1.5 pr-3">Endereço</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {stats.amostra.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-1.5 pl-3">{row.filial}</td>
                          <td className="p-1.5 font-bold">{row.produto}</td>
                          <td className="p-1.5">{row.armazem}</td>
                          <td className="p-1.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {formatNumber(row.quantidade)}
                          </td>
                          <td className="p-1.5 pr-3 text-slate-400">{row.endereco || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Barra de Progresso Durante a Importação */}
          {status === 'importing' && (
            <div className="space-y-2 p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  {statusMsg}
                </span>
                <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                  {progress}%
                </span>
              </div>
              <div className="w-full bg-indigo-100 dark:bg-indigo-900/50 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Sucesso na Conclusão */}
          {status === 'completed' && (
            <div className="p-6 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-base font-black text-emerald-900 dark:text-emerald-200">
                  Importação Concluída com Sucesso!
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                  Foram importados {parsedData.length.toLocaleString('pt-BR')} itens de saldo na tabela {tableName}. O estoque já foi sincronizado.
                </p>
              </div>
            </div>
          )}

          {/* Erro de Execução */}
          {status === 'error' && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-black text-xs">Falha na importação dos saldos</p>
                <p className="text-[11px] mt-0.5 leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60 flex items-center justify-end gap-2">
          {status === 'completed' ? (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-95 transition-all cursor-pointer"
            >
              Fechar
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={status === 'importing'}
                className="px-4 py-2.5 rounded-2xl font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-40 cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={!parsedData.length || status === 'importing' || parsing}
                className="px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-md flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
              >
                {status === 'importing' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Importando...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5" />
                    <span>Iniciar Importação ({parsedData.length || 0})</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
