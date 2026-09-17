import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { 
  getEtiquetasStorageMap, 
  isEtiquetaTrocada, 
  getEtiquetaInfo, 
  saveEtiquetaToggle,
  makeEtiquetaKey,
  mergeEtiquetasFromDb 
} from '../utils/etiquetas'
import { logAuditAction } from '../lib/audit'
import { normalizeProductCode } from '../utils/formatters'

const InventoryContext = createContext(null)

export function InventoryProvider({ children }) {
  const { user, sector, filial, isGlobal } = useAuth()

  const [rawSb1, setRawSb1] = useState([])
  const [rawSaldo, setRawSaldo] = useState([])
  const [rawConf, setRawConf] = useState([])
  const [rawValidades, setRawValidades] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastSyncedAt, setLastSyncedAt] = useState(() => new Date())
  const [isSyncing, setIsSyncing] = useState(false)

  const rawSb1Ref = useRef([])
  const lastSectorRef = useRef(sector)

  useEffect(() => {
    rawSb1Ref.current = rawSb1
  }, [rawSb1])

  useEffect(() => {
    if (lastSectorRef.current !== sector) {
      lastSectorRef.current = sector
      rawSb1Ref.current = []
    }
  }, [sector])

  // Local Counts (offline/local cache)
  const [localCounts, setLocalCounts] = useState(() => {
    try {
      const raw = localStorage.getItem('amazon_local_counts')
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })

  // Etiquetas map in state for reactive updates
  const [etiquetasMap, setEtiquetasMap] = useState(() => getEtiquetasStorageMap())

  // Filtros
  const [search, setSearch] = useState(() => localStorage.getItem('amazon_inv_search') || '')
  const [selectedArmazens, setSelectedArmazens] = useState(() => {
    try {
      const saved = localStorage.getItem('amazon_selected_armazens')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [selectedStatuses, setSelectedStatuses] = useState(() => {
    try {
      const saved = localStorage.getItem('amazon_selected_statuses')
      return saved ? JSON.parse(saved) : ['ACURADO', 'GANHO', 'PERDA', 'PENDENTE']
    } catch {
      return ['ACURADO', 'GANHO', 'PERDA', 'PENDENTE']
    }
  })
  const [selectedTags, setSelectedTags] = useState(() => {
    try {
      const saved = localStorage.getItem('amazon_selected_tags')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [isExcludeTagMode, setIsExcludeTagMode] = useState(() => {
    return localStorage.getItem('amazon_tag_exclude_mode') === 'true'
  })
  const [selectedFornecedores, setSelectedFornecedores] = useState(() => {
    try {
      const saved = localStorage.getItem('amazon_selected_fornecedores')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [isExcludeFornMode, setIsExcludeFornMode] = useState(() => {
    return localStorage.getItem('amazon_fornecedor_exclude_mode') === 'true'
  })
  const [saldoFilterMode, setSaldoFilterMode] = useState(() => {
    return localStorage.getItem('amazon_saldo_filter_mode') || 'COM_SALDO'
  })
  const [etiquetaFilterMode, setEtiquetaFilterMode] = useState(() => {
    return localStorage.getItem('amazon_etiqueta_filter_mode') || 'TODOS'
  })
  const [isDailyGoalFilterActive, setIsDailyGoalFilterActive] = useState(false)
  const [isRouteSortActive, setIsRouteSortActive] = useState(false)

  // Salvar preferências de filtros no localStorage
  useEffect(() => {
    localStorage.setItem('amazon_inv_search', search)
  }, [search])

  useEffect(() => {
    localStorage.setItem('amazon_selected_armazens', JSON.stringify(selectedArmazens))
  }, [selectedArmazens])

  useEffect(() => {
    localStorage.setItem('amazon_selected_statuses', JSON.stringify(selectedStatuses))
  }, [selectedStatuses])

  useEffect(() => {
    localStorage.setItem('amazon_selected_tags', JSON.stringify(selectedTags))
  }, [selectedTags])

  useEffect(() => {
    localStorage.setItem('amazon_tag_exclude_mode', String(isExcludeTagMode))
  }, [isExcludeTagMode])

  useEffect(() => {
    localStorage.setItem('amazon_selected_fornecedores', JSON.stringify(selectedFornecedores))
  }, [selectedFornecedores])

  useEffect(() => {
    localStorage.setItem('amazon_fornecedor_exclude_mode', String(isExcludeFornMode))
  }, [isExcludeFornMode])

  useEffect(() => {
    localStorage.setItem('amazon_saldo_filter_mode', saldoFilterMode)
  }, [saldoFilterMode])

  useEffect(() => {
    localStorage.setItem('amazon_etiqueta_filter_mode', etiquetaFilterMode)
  }, [etiquetaFilterMode])

  // Carregamento de dados do Supabase
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setIsSyncing(true)
    setError(null)

    const sb1Table = sector === 'INDUSTRIA' ? 'sb1_industria' : 'sb1_comercio'
    const saldoTable = sector === 'INDUSTRIA' ? 'saldo_industria' : 'saldo_comercio'
    const contagemTable = sector === 'INDUSTRIA' ? 'contagem_industria' : 'contagem_comercio'
    const valTable = sector === 'INDUSTRIA' ? 'validade_industria' : 'validade_comercio'

    const userFilial = (!isGlobal && filial !== 'ALL' && filial !== '00') ? filial : null

    try {
      // 1. Saldo
      let saldoAll = []
      let fromS = 0, stepS = 1000, fetchMoreS = true
      while (fetchMoreS) {
        let q = supabase.from(saldoTable).select('produto, filial, armazem, quantidade, endereco, custo_unitario')
        if (userFilial) q = q.eq('filial', userFilial)
        const { data, error } = await q.range(fromS, fromS + stepS - 1)
        if (error || !data || data.length === 0) {
          fetchMoreS = false
        } else {
          saldoAll = saldoAll.concat(data)
          if (data.length < stepS) fetchMoreS = false
          else fromS += stepS
        }
      }

      // 2. Contagens
      let confAll = []
      try {
        let fromC = 0, stepC = 1000, fetchMoreC = true
        while (fetchMoreC) {
          let q = supabase.from(contagemTable).select('*').order('created_at', { ascending: true })
          if (userFilial) {
            const uPad = String(userFilial).padStart(2, '0')
            const uRaw = String(parseInt(userFilial, 10))
            if (uPad === uRaw) {
              q = q.eq('filial', uPad)
            } else {
              q = q.in('filial', [uPad, uRaw])
            }
          }
          const { data, error } = await q.range(fromC, fromC + stepC - 1)
          if (error || !data || data.length === 0) {
            fetchMoreC = false
          } else {
            const mapped = data.map(d => ({
              created_at: d.created_at,
              produto: String(d.produto).trim(),
              filial: String(d.filial || '01').trim().padStart(2, '0'),
              armazem: String(d.armazem_contagem || d.armazem || '01').trim().padStart(2, '0'),
              qtd_contada: Number(d.quantidade_contada !== undefined ? d.quantidade_contada : (d.qtd_contada || 0)),
              conferente_nome: d.quem_contou || d.conferente_nome || 'SISTEMA',
              observacao: d.observacao || ''
            }))
            confAll = confAll.concat(mapped)
            if (data.length < stepC) fetchMoreC = false
            else fromC += stepC
          }
        }
      } catch (eC) {
        console.warn('Erro ao carregar contagens:', eC)
      }

      // 3. Validades
      let valAll = []
      try {
        let fromV = 0, stepV = 1000, fetchMoreV = true
        while (fetchMoreV) {
          let q = supabase.from(valTable).select('*')
          if (userFilial) {
            const uPad = String(userFilial).padStart(2, '0')
            const uRaw = String(parseInt(userFilial, 10))
            if (uPad === uRaw) {
              q = q.eq('filial', uPad)
            } else {
              q = q.in('filial', [uPad, uRaw])
            }
          }
          const { data, error } = await q.range(fromV, fromV + stepV - 1)
          if (error || !data || data.length === 0) {
            fetchMoreV = false
          } else {
            valAll = valAll.concat(data)
            if (data.length < stepV) fetchMoreV = false
            else fromV += stepV
          }
        }
      } catch (eV) {
        console.warn('Erro ao carregar validades:', eV)
      }

      // 4. Catálogo SB1 (reutiliza cache em atualizações periódicas/silenciosas para sincronização ultrarrápida)
      let sb1All = []
      const hasCachedSb1 = silent && rawSb1Ref.current && rawSb1Ref.current.length > 0
      if (hasCachedSb1) {
        sb1All = [...rawSb1Ref.current]
        const existingCodes = new Set(rawSb1Ref.current.map(p => String(p.codigo).trim().toUpperCase()))
        const missingCodes = new Set()
        confAll.forEach(c => {
          const cod = String(c.produto || '').trim().toUpperCase()
          if (cod && !existingCodes.has(cod)) missingCodes.add(cod)
        })
        saldoAll.forEach(s => {
          const cod = String(s.produto || '').trim().toUpperCase()
          if (cod && !existingCodes.has(cod)) missingCodes.add(cod)
        })
        if (missingCodes.size > 0) {
          const arrMissing = Array.from(missingCodes)
          for (let i = 0; i < arrMissing.length; i += 500) {
            const chunk = arrMissing.slice(i, i + 500)
            const { data } = await supabase.from(sb1Table)
              .select('codigo, descricao, unidade, fator_conv, tags, fornecedores, endereco')
              .in('codigo', chunk)
            if (data && data.length > 0) {
              sb1All = sb1All.concat(data)
            }
          }
        }
      } else {
        try {
          const { count: totalSb1 } = await supabase.from(sb1Table).select('codigo', { count: 'exact', head: true })
          const totalRows = totalSb1 || (sector === 'INDUSTRIA' ? 50000 : 12000)
          const chunkSize = 1000
          const totalChunks = Math.ceil(totalRows / chunkSize)
          const batchLimit = 6

          for (let i = 0; i < totalChunks; i += batchLimit) {
            const batchPromises = []
            for (let j = i; j < Math.min(i + batchLimit, totalChunks); j++) {
              const fromIdx = j * chunkSize
              batchPromises.push(
                supabase.from(sb1Table)
                  .select('codigo, descricao, unidade, fator_conv, tags, fornecedores, endereco')
                  .range(fromIdx, fromIdx + chunkSize - 1)
                  .then(res => res.data || [])
              )
            }
            const batchResults = await Promise.all(batchPromises)
            batchResults.forEach(chunkData => {
              if (chunkData && chunkData.length > 0) {
                sb1All = sb1All.concat(chunkData)
              }
            })
          }
        } catch (errSb1) {
          console.warn('Erro ao carregar catálogo completo, buscando ativos:', errSb1)
          const activeCodesSet = new Set([
            ...saldoAll.map(s => String(s.produto).trim()),
            ...confAll.map(c => String(c.produto).trim()),
            ...valAll.map(v => String(v.produto).trim())
          ])
          const activeCodes = Array.from(activeCodesSet).filter(Boolean)
          for (let i = 0; i < activeCodes.length; i += 500) {
            const chunk = activeCodes.slice(i, i + 500)
            const { data } = await supabase.from(sb1Table)
              .select('codigo, descricao, unidade, fator_conv, tags, fornecedores, endereco')
              .in('codigo', chunk)
            if (data) sb1All = sb1All.concat(data)
          }
        }
      }

      // 5. Etiquetas Compartilhadas (Auditoria de Estoque do Supabase)
      let sharedEtiquetasMap = null
      try {
        let fromA = 0, stepA = 1000, fetchMoreA = true
        let auditEtiquetasAll = []
        while (fetchMoreA) {
          const { data: aData, error: aErr } = await supabase
            .from('auditoria_estoque')
            .select('filial, armazem, produto, acao, usuario_nome, usuario_matricula, created_at, meta')
            .in('acao', ['ETIQUETA_TROCADA', 'ETIQUETA_DESMARCADA'])
            .order('created_at', { ascending: true })
            .range(fromA, fromA + stepA - 1)

          if (aErr || !aData || aData.length === 0) {
            fetchMoreA = false
          } else {
            auditEtiquetasAll = auditEtiquetasAll.concat(aData)
            if (aData.length < stepA) fetchMoreA = false
            else fromA += stepA
          }
        }

        if (auditEtiquetasAll.length > 0) {
          sharedEtiquetasMap = mergeEtiquetasFromDb(auditEtiquetasAll)
        } else {
          sharedEtiquetasMap = getEtiquetasStorageMap(true)
        }
      } catch (errAudit) {
        console.warn('Erro ao carregar etiquetas compartilhadas do Supabase:', errAudit)
        sharedEtiquetasMap = getEtiquetasStorageMap(true)
      }

      // Deduplicação SB1
      const uniqueSb1Map = {}
      sb1All.forEach(p => {
        const cod = String(p.codigo || p.Codigo || '').trim()
        if (!cod) return
        if (!uniqueSb1Map[cod]) {
          uniqueSb1Map[cod] = {
            codigo: cod,
            descricao: String(p.descricao || p['Descr.Espec.'] || 'SEM DESCRIÇÃO').trim(),
            unidade: String(p.unidade || p.Unidade || 'PC').trim(),
            fatorConv: p.fator_conv !== undefined ? Number(p.fator_conv) : 1,
            tags: p.tags || '',
            fornecedores: p.fornecedores || '',
            endereco: p.endereco || p.Endereco || ''
          }
        }
      })

      const latestConfMap = {}
      confAll.forEach(c => {
        const key = `${c.filial}_${c.armazem}_${c.produto}`
        if (!latestConfMap[key] || new Date(c.created_at) > new Date(latestConfMap[key].created_at)) {
          latestConfMap[key] = c
        }
      })

      const parsedSaldos = saldoAll.map(s => ({
        ...s,
        produto: String(s.produto || '').trim(),
        filial: String(s.filial || '01').trim().padStart(2, '0'),
        armazem: String(s.armazem || '01').trim().padStart(2, '0'),
        quantidade: parseFloat(s.quantidade || 0),
        endereco: s.endereco || ''
      }))

      if (!hasCachedSb1 || Object.keys(uniqueSb1Map).length !== rawSb1Ref.current.length) {
        setRawSb1(Object.values(uniqueSb1Map))
      }
      setRawSaldo(parsedSaldos)
      setRawConf(Object.values(latestConfMap))
      setRawValidades(valAll)
      setEtiquetasMap(sharedEtiquetasMap || getEtiquetasStorageMap(true))
      setLastSyncedAt(new Date())
    } catch (err) {
      console.error('Erro ao carregar inventário:', err)
      setError('Falha ao carregar dados do inventário.')
    } finally {
      setIsSyncing(false)
      if (!silent) setLoading(false)
    }
  }, [sector, filial, isGlobal])

  // Recarrega sempre que o setor ou filial mudar
  useEffect(() => {
    loadData()
  }, [loadData])

  // Sincronização periódica contínua e em eventos de retorno à aba/janela
  useEffect(() => {
    // 1. Polling contínuo em segundo plano a cada 15 segundos
    const intervalId = setInterval(() => {
      if (!document.hidden && navigator.onLine) {
        loadData(true)
      }
    }, 15000)

    // 2. Atualização imediata ao reativar a aba ou focar na janela (PC ou Celular)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        loadData(true)
      }
    }

    const handleFocus = () => {
      if (navigator.onLine) {
        loadData(true)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [loadData])

  // Lista dinâmica de armazéns disponíveis
  const availableArmazens = useMemo(() => {
    const set = new Set()
    rawSaldo.forEach(s => {
      const a = String(s.armazem || '01').trim().padStart(2, '0')
      if (a && a.length <= 4) set.add(a)
    })
    return Array.from(set).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
  }, [rawSaldo])

  // Garante seleção inicial de armazéns
  const hasInitializedArmazens = useRef(false)
  useEffect(() => {
    if (!hasInitializedArmazens.current && availableArmazens.length > 0) {
      hasInitializedArmazens.current = true
      const saved = localStorage.getItem('amazon_selected_armazens')
      if (!saved || JSON.parse(saved).length === 0) {
        setSelectedArmazens(availableArmazens)
      }
    }
  }, [availableArmazens])

  // Lista de tags disponíveis ({ key, label })
  const availableTags = useMemo(() => {
    const map = new Map()
    rawSb1.forEach(p => {
      if (p.tags) {
        p.tags.split(',').forEach(t => {
          const tr = t.trim()
          if (tr) {
            const key = tr.toLowerCase()
            if (!map.has(key)) map.set(key, tr)
          }
        })
      }
    })
    return Array.from(map.entries()).map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [rawSb1])

  // Lista de fornecedores disponíveis ({ key, label })
  const availableFornecedores = useMemo(() => {
    const map = new Map()
    rawSb1.forEach(p => {
      if (p.fornecedores) {
        p.fornecedores.split(/,|;/).forEach(f => {
          const tr = f.trim()
          if (tr) {
            const key = tr.toLowerCase()
            if (!map.has(key)) map.set(key, tr)
          }
        })
      }
    })
    return Array.from(map.entries()).map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [rawSb1])

  // Mapeamento de saldos e contagens por armazém
  const { saldoMap, productWarehousesMap, warehouseSaldoMap, warehouseCountMap, productCountsMap, hasCountMap, productLastDateMap, productLastObsMap } = useMemo(() => {
    const sMap = {}
    const pwMap = {}
    const wsMap = {}
    const wcMap = {}
    const pcMap = {}
    const hcMap = {}
    const pldMap = {}
    const ploMap = {}

    const isFilialMatch = (itemFil) => {
      if (!filial || filial === 'ALL' || filial === '00') return true
      return String(itemFil).padStart(2, '0') === String(filial).padStart(2, '0')
    }

    const isArmSelectedCheck = (rawArm) => {
      if (!selectedArmazens || selectedArmazens.length === 0) return false
      const arm = String(rawArm || '01').trim()
      const armPad = arm.padStart(2, '0')
      const armRaw = String(parseInt(arm, 10) || 0)
      return selectedArmazens.includes(arm) || selectedArmazens.includes(armPad) || selectedArmazens.includes(armRaw)
    }

    rawSaldo.forEach(s => {
      if (!isFilialMatch(s.filial)) return
      const cod = s.produto
      if (!cod) return
      const arm = String(s.armazem || '01').trim().padStart(2, '0')

      if (!pwMap[cod]) pwMap[cod] = new Set()
      pwMap[cod].add(arm)

      const wKey = `${arm}_${cod}`
      wsMap[wKey] = (wsMap[wKey] || 0) + (s.quantidade || 0)

      if (isArmSelectedCheck(arm)) {
        sMap[cod] = (sMap[cod] || 0) + (s.quantidade || 0)
      }
    })

    rawConf.forEach(c => {
      if (!isFilialMatch(c.filial)) return
      const cod = c.produto
      if (!cod) return
      const arm = String(c.armazem || '01').trim().padStart(2, '0')

      if (!pwMap[cod]) pwMap[cod] = new Set()
      pwMap[cod].add(arm)

      const wKey = `${arm}_${cod}`
      wcMap[wKey] = c.qtd_contada

      if (isArmSelectedCheck(arm)) {
        pcMap[cod] = (pcMap[cod] || 0) + c.qtd_contada
        hcMap[cod] = true

        if (c.observacao && !ploMap[cod]) ploMap[cod] = c.observacao
        if (c.created_at) {
          const dt = new Date(c.created_at)
          if (!isNaN(dt.getTime())) {
            if (!pldMap[cod] || dt > pldMap[cod]) {
              pldMap[cod] = dt
              if (c.observacao) ploMap[cod] = c.observacao
            }
          }
        }
      }
    })

    // Incorpora contagens locais offline (apenas se ainda não existirem no rawConf para aquele armazém)
    Object.keys(localCounts).forEach(key => {
      const parts = key.split('_')
      const armRaw = parts[0]
      const cod = parts.slice(1).join('_')
      if (cod) {
        const armPad = armRaw.padStart(2, '0')
        if (!pwMap[cod]) pwMap[cod] = new Set()
        pwMap[cod].add(armPad)

        const wKey = `${armPad}_${cod}`
        if (wcMap[wKey] === undefined) {
          const val = Number(localCounts[key] || 0)
          wcMap[wKey] = val

          if (isArmSelectedCheck(armPad)) {
            pcMap[cod] = (pcMap[cod] || 0) + val
            hcMap[cod] = true
            pldMap[cod] = new Date()
          }
        }
      }
    })

    return {
      saldoMap: sMap,
      productWarehousesMap: pwMap,
      warehouseSaldoMap: wsMap,
      warehouseCountMap: wcMap,
      productCountsMap: pcMap,
      hasCountMap: hcMap,
      productLastDateMap: pldMap,
      productLastObsMap: ploMap
    }
  }, [rawSaldo, rawConf, localCounts, filial, selectedArmazens])

  // Mapeamento base de produtos com cálculos de etiquetas, acurácia e metas
  const allMapped = useMemo(() => {
    const filialForEtiqueta = (filial && filial !== 'ALL' && filial !== '00') ? filial : '01'
    const nowTime = Date.now()
    const todayStr = new Date(nowTime).toISOString().slice(0, 10)

    const localCountedCodesSet = new Set(
      Object.keys(localCounts).map(k => k.split('_').slice(1).join('_'))
    )

    return rawSb1.map(prod => {
      const cod = prod.codigo
      const sysQty = saldoMap[cod] || 0
      const hasRealCount = hasCountMap[cod] === true

      let hasCount = hasRealCount
      let countedQty = null
      let diff = 0
      let status = 'PENDENTE'

      if (hasRealCount) {
        countedQty = productCountsMap[cod] || 0
        diff = countedQty - sysQty
        if (Math.abs(diff) < 0.0001) status = 'ACURADO'
        else if (diff > 0) status = 'GANHO'
        else status = 'PERDA'
      } else if (sysQty <= 0.0001) {
        hasCount = true
        countedQty = 0
        diff = 0
        status = 'ACURADO'
      }

      const lastDate = productLastDateMap[cod] || null
      let daysSinceCount = null
      let isOutdated = false
      let isCountedToday = false

      if (lastDate) {
        const diffMs = nowTime - lastDate.getTime()
        daysSinceCount = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        if (daysSinceCount >= 14) isOutdated = true
        const lastDateStr = new Date(lastDate).toISOString().slice(0, 10)
        if (todayStr === lastDateStr || daysSinceCount === 0) isCountedToday = true
      }

      if (localCountedCodesSet.has(cod)) {
        isCountedToday = true
      }

      // Armazéns do produto no filtro
      const allItemArmazens = Array.from(productWarehousesMap[cod] || [])
      let armazensNoFiltro = allItemArmazens.filter(a => {
        const armPad = String(a).trim().padStart(2, '0')
        const armRaw = String(parseInt(a, 10) || 0)
        return selectedArmazens.includes(a) || selectedArmazens.includes(armPad) || selectedArmazens.includes(armRaw)
      })

      const isSpecificWarehouseFilter = selectedArmazens.length > 0 && selectedArmazens.length < availableArmazens.length
      if (armazensNoFiltro.length === 0 && !isSpecificWarehouseFilter) {
        armazensNoFiltro = ['01']
      }
      armazensNoFiltro.sort((a, b) => parseInt(a, 10) - parseInt(b, 10))

      const armZeradoMap = {}
      const armazensZerados = []
      const etiquetasTrocadas = []
      const etiquetasPendentes = []
      const etiquetasDispensadas = []

      armazensNoFiltro.forEach(arm => {
        const wKey = `${arm}_${cod}`
        const armSys = warehouseSaldoMap[wKey] || 0
        const armCount = warehouseCountMap[wKey]
        const isTrocada = isEtiquetaTrocada(filialForEtiqueta, arm, cod, etiquetasMap)

        const isSysZero = Math.abs(armSys) <= 0.0001
        const hasExplicitCount = (armCount !== null && armCount !== undefined)
        const isCountZero = hasExplicitCount ? (Math.abs(armCount) <= 0.0001) : (countedQty !== null && Math.abs(countedQty) <= 0.0001)

        const isZeradoAcurado = isSysZero && (
          (hasExplicitCount && isCountZero) ||
          (status === 'ACURADO' && (countedQty === null || Math.abs(countedQty) <= 0.0001))
        )

        if (isZeradoAcurado) {
          armZeradoMap[arm] = true
          armazensZerados.push(arm)
          if (isTrocada) etiquetasTrocadas.push(arm)
          else etiquetasDispensadas.push(arm)
        } else {
          armZeradoMap[arm] = false
          if (isTrocada) etiquetasTrocadas.push(arm)
          else etiquetasPendentes.push(arm)
        }
      })

      const temEtiquetaPendente = etiquetasPendentes.length > 0
      const isEtiquetaTotalmenteTrocada = armazensNoFiltro.length > 0 && etiquetasPendentes.length === 0 && (etiquetasTrocadas.length > 0 || etiquetasDispensadas.length === armazensNoFiltro.length)

      return {
        ...prod,
        filial: filialForEtiqueta,
        quantidade: sysQty,
        qtd_contada: countedQty,
        hasCount,
        divergencia: diff,
        status,
        observacao: productLastObsMap[cod] || '',
        lastCountDate: lastDate,
        daysSinceCount,
        isOutdated,
        isCountedToday,
        isDailyGoalItem: false,
        armazensNoFiltro,
        armZeradoMap,
        armazensZerados,
        etiquetasTrocadas,
        etiquetasPendentes,
        etiquetasDispensadas,
        temEtiquetaPendente,
        isEtiquetaTotalmenteTrocada
      }
    })
  }, [rawSb1, saldoMap, productWarehousesMap, warehouseSaldoMap, warehouseCountMap, productCountsMap, hasCountMap, productLastDateMap, productLastObsMap, selectedArmazens, availableArmazens, filial, etiquetasMap, localCounts])

  // Itens escopados pelos filtros base (Tags, Fornecedores, Saldo, Armazéns)
  const baseScopedItems = useMemo(() => {
    const isSpecificWarehouseFilter = selectedArmazens.length > 0 && selectedArmazens.length < availableArmazens.length

    return allMapped.filter(item => {
      // Quando filtrando por armazéns específicos, só exibe produtos presentes nos armazéns selecionados
      if (isSpecificWarehouseFilter && item.armazensNoFiltro.length === 0) {
        return false
      }

      if (saldoFilterMode === 'COM_SALDO') {
        if (item.quantidade <= 0.0001 && item.status !== 'GANHO') return false
      } else if (saldoFilterMode === 'SALDO_ZERO') {
        if (item.quantidade > 0.0001) return false
      }

      if (selectedTags.length > 0) {
        const itemTags = item.tags ? item.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : []
        const isItemWithoutTag = itemTags.length === 0

        if (isExcludeTagMode) {
          if (selectedTags.includes('__no_tag__') && isItemWithoutTag) return false
          if (itemTags.some(t => selectedTags.includes(t))) return false
        } else {
          const matchNoTag = selectedTags.includes('__no_tag__') && isItemWithoutTag
          const matchSpecific = itemTags.some(t => selectedTags.includes(t))
          if (!matchNoTag && !matchSpecific) return false
        }
      }

      if (selectedFornecedores.length > 0) {
        const itemForns = item.fornecedores ? item.fornecedores.split(/,|;/).map(f => f.trim().toLowerCase()).filter(Boolean) : []
        const isItemWithoutForn = itemForns.length === 0

        if (isExcludeFornMode) {
          if (selectedFornecedores.includes('__no_forn__') && isItemWithoutForn) return false
          if (itemForns.some(f => selectedFornecedores.includes(f))) return false
        } else {
          const matchNoForn = selectedFornecedores.includes('__no_forn__') && isItemWithoutForn
          const matchSpecific = itemForns.some(f => selectedFornecedores.includes(f))
          if (!matchNoForn && !matchSpecific) return false
        }
      }

      return true
    })
  }, [allMapped, saldoFilterMode, selectedTags, isExcludeTagMode, selectedFornecedores, isExcludeFornMode, selectedArmazens, availableArmazens])

  // Placar de Etiquetas
  const scoreboardStats = useMemo(() => {
    let totalSlots = 0
    let trocadas = 0

    baseScopedItems.forEach(item => {
      const slots = item.armazensNoFiltro.filter(arm => !item.armazensZerados.includes(arm) || item.etiquetasTrocadas.includes(arm))
      totalSlots += slots.length
      trocadas += item.etiquetasTrocadas.length
    })

    const pendentes = Math.max(0, totalSlots - trocadas)
    const pct = totalSlots > 0 ? Math.round((trocadas / totalSlots) * 100) : 100

    return {
      totalSlots,
      trocadas,
      pendentes,
      pct,
      filterMode: etiquetaFilterMode
    }
  }, [baseScopedItems, etiquetaFilterMode])

  // Meta Diária de 15 Itens Prioritários
  const { dailyGoalItems, dailyGoalStats, userScopedItems } = useMemo(() => {
    const userItems = baseScopedItems.filter(item => {
      if (etiquetaFilterMode === 'FALTA_TROCAR') return item.temEtiquetaPendente
      if (etiquetaFilterMode === 'JA_TROCADO') return item.isEtiquetaTotalmenteTrocada
      return true
    })

    const DAILY_TARGET = 15
    const priorityItems = [...userItems].sort((a, b) => {
      const getScore = (item) => {
        if (item.status === 'GANHO' || item.status === 'PERDA') return 5
        if (item.isOutdated) return 4
        if (item.quantidade > 0 && !item.hasCount) return 3
        if (item.isCountedToday) return 2
        if (!item.hasCount) return 1
        return 0
      }
      const diff = getScore(b) - getScore(a)
      if (diff !== 0) return diff
      return String(a.codigo).localeCompare(String(b.codigo))
    })

    const targetCount = Math.min(DAILY_TARGET, userItems.length)
    const goalItems = priorityItems.slice(0, targetCount > 0 ? targetCount : DAILY_TARGET)
    const goalCodesSet = new Set(goalItems.map(i => i.codigo))

    userItems.forEach(i => {
      i.isDailyGoalItem = goalCodesSet.has(i.codigo)
    })

    const doneCount = goalItems.filter(i => i.isCountedToday || (i.hasCount && (i.daysSinceCount === 0 || i.daysSinceCount === null))).length
    const pct = targetCount > 0 ? Math.min(100, Math.round((doneCount / targetCount) * 100)) : 100

    return {
      dailyGoalItems: goalItems,
      dailyGoalStats: {
        targetCount,
        doneCount,
        pct,
        pendentesCount: Math.max(0, targetCount - doneCount)
      },
      userScopedItems: userItems
    }
  }, [baseScopedItems, etiquetaFilterMode])

  // Itens filtrados finais (Busca Rápida + Status + Rota)
  const filteredItems = useMemo(() => {
    const term = search.toLowerCase().trim()
    const normTerm = normalizeProductCode(term).toLowerCase()

    const list = userScopedItems.filter(item => {
      if (isDailyGoalFilterActive && !item.isDailyGoalItem) return false
      if (!selectedStatuses.includes(item.status)) return false

      if (term) {
        const inCode = item.codigo.toLowerCase().includes(term) || (normTerm !== term && item.codigo.toLowerCase().includes(normTerm))
        const inDesc = item.descricao.toLowerCase().includes(term)
        const inTags = item.tags.toLowerCase().includes(term)
        const inForn = (item.fornecedores || '').toLowerCase().includes(term)
        const inEnd = (item.endereco || '').toLowerCase().includes(term)
        if (!inCode && !inDesc && !inTags && !inForn && !inEnd) return false
      }

      return true
    })

    return list.sort((a, b) => {
      if (isRouteSortActive) {
        const endA = (a.endereco || '').trim().toUpperCase()
        const endB = (b.endereco || '').trim().toUpperCase()
        if (!endA && endB) return 1
        if (endA && !endB) return -1
        if (endA && endB && endA !== endB) {
          return endA.localeCompare(endB, undefined, { numeric: true, sensitivity: 'base' })
        }
      }
      return String(a.codigo || '').localeCompare(String(b.codigo || ''), undefined, { numeric: true, sensitivity: 'base' })
    })
  }, [userScopedItems, search, selectedStatuses, isDailyGoalFilterActive, isRouteSortActive])

  // KPIs
  const kpis = useMemo(() => {
    const isArmSelectedCheck = (rawArm) => {
      if (!selectedArmazens || selectedArmazens.length === 0) return false
      const arm = String(rawArm || '01').trim()
      const armPad = arm.padStart(2, '0')
      const armRaw = String(parseInt(arm, 10) || 0)
      return selectedArmazens.includes(arm) || selectedArmazens.includes(armPad) || selectedArmazens.includes(armRaw)
    }

    const isFilialMatch = (itemFil) => {
      if (!filial || filial === 'ALL' || filial === '00') return true
      return String(itemFil).padStart(2, '0') === String(filial).padStart(2, '0')
    }

    const totalCadastrados = rawSb1.length
    const prodsWithSaldo = new Set()
    for (let i = 0; i < rawSaldo.length; i++) {
      const s = rawSaldo[i]
      if (!isFilialMatch(s.filial)) continue
      const arm = String(s.armazem || '01').trim().padStart(2, '0')
      if (isArmSelectedCheck(arm) && (s.quantidade || 0) > 0.0001 && s.produto) {
        prodsWithSaldo.add(String(s.produto).trim())
      }
    }
    const itensComSaldoCount = prodsWithSaldo.size

    const acuradosCount = filteredItems.filter(i => i.status === 'ACURADO').length
    const ganhosCount = filteredItems.filter(i => i.status === 'GANHO').length
    const perdasCount = filteredItems.filter(i => i.status === 'PERDA').length
    const totalContados = acuradosCount + ganhosCount + perdasCount

    const pctAcurados = totalContados > 0 ? ((acuradosCount / totalContados) * 100).toFixed(1) : '0.0'
    const pctGanhos = totalContados > 0 ? ((ganhosCount / totalContados) * 100).toFixed(1) : '0.0'
    const pctPerdas = totalContados > 0 ? ((perdasCount / totalContados) * 100).toFixed(1) : '0.0'

    const volumeTotal = filteredItems.reduce((sum, item) => sum + item.quantidade, 0)

    return {
      totalCadastrados,
      itensComSaldoCount,
      acuradosCount,
      ganhosCount,
      perdasCount,
      totalContados,
      pctAcurados,
      pctGanhos,
      pctPerdas,
      volumeTotal
    }
  }, [rawSb1.length, rawSaldo, filteredItems, selectedArmazens, filial])

  // Sincronização em Tempo Real (Supabase Realtime)
  useEffect(() => {
    const contagemTable = sector === 'INDUSTRIA' ? 'contagem_industria' : 'contagem_comercio'
    const saldoTable = sector === 'INDUSTRIA' ? 'saldo_industria' : 'saldo_comercio'
    
    const channelName = `inventory-realtime-${sector}-${Date.now()}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: contagemTable },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newRow = payload.new
            if (newRow && newRow.produto) {
              const mappedItem = {
                created_at: newRow.created_at || new Date().toISOString(),
                produto: String(newRow.produto).trim().toUpperCase(),
                filial: String(newRow.filial || '01').trim().padStart(2, '0'),
                armazem: String(newRow.armazem_contagem || newRow.armazem || '01').trim().padStart(2, '0'),
                qtd_contada: Number(newRow.quantidade_contada !== undefined ? newRow.quantidade_contada : (newRow.qtd_contada || 0)),
                conferente_nome: newRow.quem_contou || newRow.conferente_nome || 'SISTEMA',
                observacao: newRow.observacao || ''
              }
              setRawConf(prev => {
                const without = prev.filter(c => !(
                  String(c.filial || '01').padStart(2, '0') === mappedItem.filial &&
                  String(c.armazem || '01').padStart(2, '0') === mappedItem.armazem &&
                  String(c.produto || '').trim().toUpperCase() === mappedItem.produto
                ))
                return [mappedItem, ...without]
              })
            }
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old
            if (oldRow && oldRow.produto) {
              const delFil = String(oldRow.filial || '01').trim().padStart(2, '0')
              const delArm = String(oldRow.armazem_contagem || oldRow.armazem || '01').trim().padStart(2, '0')
              const delProd = String(oldRow.produto || '').trim().toUpperCase()
              setRawConf(prev => prev.filter(c => !(
                String(c.filial || '01').padStart(2, '0') === delFil &&
                String(c.armazem || '01').padStart(2, '0') === delArm &&
                String(c.produto || '').trim().toUpperCase() === delProd
              )))
            }
          }
          // Sincroniza em segundo plano para manter integridade dos cálculos
          loadData(true)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: saldoTable },
        () => {
          loadData(true)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auditoria_estoque' },
        (payload) => {
          const newRow = payload.new
          if (newRow && (newRow.acao === 'ETIQUETA_TROCADA' || newRow.acao === 'ETIQUETA_DESMARCADA')) {
            const updated = mergeEtiquetasFromDb([newRow])
            setEtiquetasMap(updated)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sector, loadData])

  // Ação de Toggle de Etiqueta (compartilhada no Supabase e otimista no React)
  const toggleEtiqueta = useCallback(async (itemFilial, armazem, codigo) => {
    const targetFilial = (itemFilial && itemFilial !== 'ALL' && itemFilial !== '00')
      ? itemFilial
      : (filial && filial !== 'ALL' && filial !== '00')
        ? filial
        : (user?.filial_atual || '01')
    const filPad = String(targetFilial).padStart(2, '0')
    const armPad = String(armazem || '01').padStart(2, '0')
    const codNorm = String(codigo || '').trim().toUpperCase()

    const { newStatus, key, entry } = saveEtiquetaToggle(filPad, armPad, codNorm, user)
    
    // Atualização otimista imediata no estado React (0ms)
    setEtiquetasMap(prev => {
      const updated = { ...prev }
      if (newStatus && entry) {
        updated[key] = entry
      } else {
        delete updated[key]
        const altFil = filPad === '01' ? '05' : '01'
        delete updated[makeEtiquetaKey(altFil, armPad, codNorm)]
      }
      return updated
    })

    try {
      await logAuditAction({
        filial: filPad,
        armazem: armPad,
        produto: codNorm,
        modulo: 'INVENTARIO',
        acao: newStatus ? 'ETIQUETA_TROCADA' : 'ETIQUETA_DESMARCADA',
        detalhes: newStatus
          ? `Etiqueta física do Armazém ${armPad} marcada como OK`
          : `Etiqueta física do Armazém ${armPad} desmarcada (voltando para pendente)`,
        meta: { trocado_em: new Date().toISOString(), status: newStatus },
        currentUser: user
      })
    } catch (e) {
      console.warn('Erro ao registrar log de etiqueta:', e)
    }
  }, [filial, user])

  // Ação de Salvar Contagem (Atualização Otimista Imediata + Supabase)
  const saveCount = useCallback(async ({ codigo, armazem, quantidade, observacao = '', validade = '', lote = '' }) => {
    const targetFilial = (filial && filial !== 'ALL' && filial !== '00')
      ? filial
      : (user?.filial_atual || '01')
    const filPad = String(targetFilial).padStart(2, '0')
    const armPad = String(armazem || '01').padStart(2, '0')
    const codNorm = String(codigo).trim().toUpperCase()
    const contagemTable = sector === 'INDUSTRIA' ? 'contagem_industria' : 'contagem_comercio'
    const conferenteIdent = user ? `${user.matricula || ''} - ${user.nome || ''}`.replace(/^ - /, '') : 'SISTEMA'

    const currentSysRecord = rawSaldo.find(s => {
      if (String(s.produto || '').trim().toUpperCase() !== codNorm) return false
      const sf = String(s.filial || '01').padStart(2, '0')
      const sa = String(s.armazem || '01').padStart(2, '0')
      return sf === filPad && sa === armPad
    })
    const qtdSistema = currentSysRecord ? Number(currentSysRecord.quantidade || 0) : 0
    const nowIso = new Date().toISOString()

    const payload = {
      filial: filPad,
      armazem_contagem: armPad,
      produto: codNorm,
      quantidade_contada: Number(quantidade),
      quantidade_sistema: qtdSistema,
      quem_contou: conferenteIdent,
      observacao: observacao || null,
      created_at: nowIso
    }

    // 1. ATUALIZAÇÃO OTIMISTA IMEDIATA (0ms) no estado local React
    const newConfItem = {
      created_at: nowIso,
      produto: codNorm,
      filial: filPad,
      armazem: armPad,
      qtd_contada: Number(quantidade),
      conferente_nome: conferenteIdent,
      observacao: observacao || ''
    }

    setRawConf(prev => {
      const filtered = prev.filter(c => !(
        String(c.filial || '01').padStart(2, '0') === filPad &&
        String(c.armazem || '01').padStart(2, '0') === armPad &&
        String(c.produto || '').trim().toUpperCase() === codNorm
      ))
      return [newConfItem, ...filtered]
    })

    if (validade || lote) {
      setRawValidades(prev => [{
        created_at: nowIso,
        filial: filPad,
        armazem: armPad,
        produto: codNorm,
        quantidade: Number(quantidade),
        data_validade: validade || null,
        lote: lote || null,
        quem_registrou: user ? user.nome : 'SISTEMA',
        observacao: observacao || null
      }, ...prev])
    }

    const countKey = `${armPad}_${codNorm}`
    const updatedLocal = { ...localCounts, [countKey]: Number(quantidade) }
    setLocalCounts(updatedLocal)
    try {
      localStorage.setItem('amazon_local_counts', JSON.stringify(updatedLocal))
    } catch (e) {}

    // 2. Gravação no Supabase e Auditoria
    try {
      const { error } = await supabase.from(contagemTable).insert([payload])
      if (error) {
        console.warn('Erro ao salvar no Supabase, contagem mantida no cache local:', error)
      } else {
        logAuditAction({
          filial: filPad,
          armazem: armPad,
          produto: codNorm,
          modulo: 'INVENTARIO',
          acao: 'CONTAGEM_REGISTRADA',
          detalhes: `Contagem física registrada: ${quantidade} un (Obs: ${observacao || 'Nenhuma'})`,
          meta: payload,
          currentUser: user
        })
      }

      if (validade || lote) {
        const valTable = sector === 'INDUSTRIA' ? 'validade_industria' : 'validade_comercio'
        await supabase.from(valTable).insert([{
          filial: filPad,
          armazem: armPad,
          produto: codNorm,
          quantidade: Number(quantidade),
          data_validade: validade || null,
          lote: lote || null,
          quem_registrou: user ? user.nome : 'SISTEMA',
          observacao: observacao || null,
          created_at: nowIso
        }])
      }
    } catch (err) {
      console.warn('Falha de rede, contagem preservada localmente:', err)
    }

    // 3. Recarga silenciosa em background para sincronização definitiva
    setTimeout(() => {
      loadData(true)
    }, 1000)
  }, [filial, sector, user, localCounts, rawSaldo, loadData])

  // Ação de Atualizar Tags do Produto no Supabase
  const updateProductTags = useCallback(async (codigo, newTagsArray) => {
    const sb1Table = sector === 'INDUSTRIA' ? 'sb1_industria' : 'sb1_comercio'
    const tagsString = newTagsArray.join(',')

    setRawSb1(prev => prev.map(p => p.codigo === codigo ? { ...p, tags: tagsString } : p))

    try {
      let { error } = await supabase.from(sb1Table).update({ tags: tagsString || null }).eq('codigo', codigo)
      if (error) {
        await supabase.from(sb1Table).update({ tags: tagsString || null }).eq('Codigo', codigo)
      }
      logAuditAction({
        filial: filial || '01',
        produto: codigo,
        modulo: 'INVENTARIO',
        acao: 'TAGS_ATUALIZADAS',
        detalhes: `Tags atualizadas para produto ${codigo}: ${tagsString || 'Nenhuma'}`,
        meta: { tags: tagsString },
        currentUser: user
      })
    } catch (err) {
      console.error('Erro ao atualizar tags:', err)
    }
  }, [sector, filial, user])

  // Ação de Atualizar Fornecedores do Produto no Supabase
  const updateProductFornecedores = useCallback(async (codigo, newFornArray) => {
    const sb1Table = sector === 'INDUSTRIA' ? 'sb1_industria' : 'sb1_comercio'
    const fornString = newFornArray.join(',')

    setRawSb1(prev => prev.map(p => p.codigo === codigo ? { ...p, fornecedores: fornString } : p))

    try {
      let { error } = await supabase.from(sb1Table).update({ fornecedores: fornString || null }).eq('codigo', codigo)
      if (error) {
        await supabase.from(sb1Table).update({ fornecedores: fornString || null }).eq('Codigo', codigo)
      }
      logAuditAction({
        filial: filial || '01',
        produto: codigo,
        modulo: 'INVENTARIO',
        acao: 'FORNECEDORES_ATUALIZADOS',
        detalhes: `Fornecedores atualizados para produto ${codigo}: ${fornString || 'Nenhum'}`,
        meta: { fornecedores: fornString },
        currentUser: user
      })
    } catch (err) {
      console.error('Erro ao atualizar fornecedores:', err)
    }
  }, [sector, filial, user])

  return (
    <InventoryContext.Provider
      value={{
        rawSb1,
        rawSaldo,
        rawConf,
        rawValidades,
        loading,
        error,
        isSyncing,
        lastSyncedAt,
        reload: loadData,
        // Filtros
        search,
        setSearch,
        selectedArmazens,
        setSelectedArmazens,
        availableArmazens,
        selectedStatuses,
        setSelectedStatuses,
        selectedTags,
        setSelectedTags,
        availableTags,
        isExcludeTagMode,
        setIsExcludeTagMode,
        selectedFornecedores,
        setSelectedFornecedores,
        availableFornecedores,
        isExcludeFornMode,
        setIsExcludeFornMode,
        saldoFilterMode,
        setSaldoFilterMode,
        etiquetaFilterMode,
        setEtiquetaFilterMode,
        isDailyGoalFilterActive,
        setIsDailyGoalFilterActive,
        isRouteSortActive,
        setIsRouteSortActive,
        // Listas e Métricas
        filteredItems,
        scoreboardStats,
        dailyGoalStats,
        dailyGoalItems,
        warehouseSaldoMap,
        warehouseCountMap,
        kpis,
        // Ações
        toggleEtiqueta,
        saveCount,
        updateProductTags,
        updateProductFornecedores
      }}
    >
      {children}
    </InventoryContext.Provider>
  )
}

export function useInventory() {
  const context = useContext(InventoryContext)
  if (!context) {
    throw new Error('useInventory deve ser usado dentro de um InventoryProvider')
  }
  return context
}
