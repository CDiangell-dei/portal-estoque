import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { 
  getEtiquetasStorageMap, 
  isEtiquetaTrocada, 
  getEtiquetaInfo, 
  saveEtiquetaToggle,
  makeEtiquetaKey 
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
    setError(null)

    const sb1Table = sector === 'INDUSTRIA' ? 'sb1_industria' : 'sb1_comercio'
    const saldoTable = sector === 'INDUSTRIA' ? 'saldo_industria' : 'saldo_comercio'
    const contagemTable = sector === 'INDUSTRIA' ? 'contagens_industria' : 'contagens_comercio'
    const valTable = sector === 'INDUSTRIA' ? 'validades_industria' : 'validades_comercio'

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
          let q = supabase.from(contagemTable).select('*')
          if (userFilial) q = q.eq('filial', userFilial)
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
          if (userFilial) q = q.eq('filial', userFilial)
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

      // 4. Catálogo SB1
      let sb1All = []
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

      // Deduplicação
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

      setRawSb1(Object.values(uniqueSb1Map))
      setRawSaldo(parsedSaldos)
      setRawConf(Object.values(latestConfMap))
      setRawValidades(valAll)
      setEtiquetasMap(getEtiquetasStorageMap(true))
    } catch (err) {
      console.error('Erro ao carregar inventário:', err)
      setError('Falha ao carregar dados do inventário.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [sector, filial, isGlobal])

  // Recarrega sempre que o setor ou filial mudar
  useEffect(() => {
    loadData()
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
  useEffect(() => {
    if (availableArmazens.length > 0 && selectedArmazens.length === 0) {
      setSelectedArmazens(availableArmazens)
    }
  }, [availableArmazens, selectedArmazens.length])

  // Lista de tags disponíveis
  const availableTags = useMemo(() => {
    const set = new Set()
    rawSb1.forEach(p => {
      if (p.tags) {
        p.tags.split(',').forEach(t => {
          const tr = t.trim().toLowerCase()
          if (tr) set.add(tr)
        })
      }
    })
    return Array.from(set).sort()
  }, [rawSb1])

  // Lista de fornecedores disponíveis
  const availableFornecedores = useMemo(() => {
    const set = new Set()
    rawSb1.forEach(p => {
      if (p.fornecedores) {
        p.fornecedores.split(/,|;/).forEach(f => {
          const tr = f.trim().toLowerCase()
          if (tr) set.add(tr)
        })
      }
    })
    return Array.from(set).sort()
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

    rawSaldo.forEach(s => {
      if (!isFilialMatch(s.filial)) return
      const cod = s.produto
      if (!cod) return
      const arm = s.armazem
      sMap[cod] = (sMap[cod] || 0) + (s.quantidade || 0)

      if (!pwMap[cod]) pwMap[cod] = new Set()
      pwMap[cod].add(arm)

      const wKey = `${arm}_${cod}`
      wsMap[wKey] = (wsMap[wKey] || 0) + (s.quantidade || 0)
    })

    rawConf.forEach(c => {
      if (!isFilialMatch(c.filial)) return
      const cod = c.produto
      if (!cod) return
      const arm = c.armazem

      if (!pwMap[cod]) pwMap[cod] = new Set()
      pwMap[cod].add(arm)

      const wKey = `${arm}_${cod}`
      wcMap[wKey] = c.qtd_contada

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
    })

    // Incorpora contagens locais offline
    Object.keys(localCounts).forEach(key => {
      const [arm, cod] = key.split('_')
      if (cod) {
        const armPad = arm.padStart(2, '0')
        if (!pwMap[cod]) pwMap[cod] = new Set()
        pwMap[cod].add(armPad)

        wcMap[key] = Number(localCounts[key] || 0)
        pcMap[cod] = (pcMap[cod] || 0) + Number(localCounts[key] || 0)
        hcMap[cod] = true
        pldMap[cod] = new Date()
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
  }, [rawSaldo, rawConf, localCounts, filial])

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
      let armazensNoFiltro = allItemArmazens.filter(a => selectedArmazens.includes(a))
      if (armazensNoFiltro.length === 0) {
        armazensNoFiltro = selectedArmazens.length > 0 ? [selectedArmazens[0]] : ['01']
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
  }, [rawSb1, saldoMap, productWarehousesMap, warehouseSaldoMap, warehouseCountMap, productCountsMap, hasCountMap, productLastDateMap, productLastObsMap, selectedArmazens, filial, etiquetasMap, localCounts])

  // Itens escopados pelos filtros base (Tags, Fornecedores, Saldo)
  const baseScopedItems = useMemo(() => {
    return allMapped.filter(item => {
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
  }, [allMapped, saldoFilterMode, selectedTags, isExcludeTagMode, selectedFornecedores, isExcludeFornMode])

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
    const totalCadastrados = rawSb1.length
    const prodsWithSaldo = new Set()
    for (let i = 0; i < rawSaldo.length; i++) {
      const s = rawSaldo[i]
      if ((s.quantidade || 0) > 0.0001 && s.produto) {
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
  }, [rawSb1.length, rawSaldo, filteredItems])

  // Ação de Toggle de Etiqueta
  const toggleEtiqueta = useCallback(async (itemFilial, armazem, codigo) => {
    const filPad = String(itemFilial || filial || '01').padStart(2, '0')
    const armPad = String(armazem || '01').padStart(2, '0')
    const codNorm = String(codigo || '').trim().toUpperCase()

    const { newStatus } = saveEtiquetaToggle(filPad, armPad, codNorm, user)
    setEtiquetasMap(getEtiquetasStorageMap(true))

    logAuditAction({
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
  }, [filial, user])

  // Ação de Salvar Contagem
  const saveCount = useCallback(async ({ codigo, armazem, quantidade, observacao = '', validade = '', lote = '' }) => {
    const filPad = String(filial === 'ALL' || filial === '00' ? '01' : filial).padStart(2, '0')
    const armPad = String(armazem || '01').padStart(2, '0')
    const codNorm = String(codigo).trim().toUpperCase()
    const contagemTable = sector === 'INDUSTRIA' ? 'contagens_industria' : 'contagens_comercio'

    const payload = {
      filial: filPad,
      armazem: armPad,
      armazem_contagem: armPad,
      produto: codNorm,
      quantidade_contada: Number(quantidade),
      qtd_contada: Number(quantidade),
      quem_contou: user ? user.nome : 'SISTEMA',
      conferente_nome: user ? user.nome : 'SISTEMA',
      observacao: observacao || '',
      validade: validade || null,
      lote: lote || null,
      created_at: new Date().toISOString()
    }

    // Grava localmente de imediato
    const countKey = `${armPad}_${codNorm}`
    const updatedLocal = { ...localCounts, [countKey]: Number(quantidade) }
    setLocalCounts(updatedLocal)
    localStorage.setItem('amazon_local_counts', JSON.stringify(updatedLocal))

    try {
      const { error } = await supabase.from(contagemTable).insert([payload])
      if (error) {
        console.warn('Erro ao salvar no Supabase, mantido em cache local:', error)
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
    } catch (err) {
      console.warn('Falha de rede, contagem preservada localmente:', err)
    }

    // Auto recarga silenciosa para sincronizar contagens consolidadas
    setTimeout(() => loadData(true), 500)
  }, [filial, sector, user, localCounts, loadData])

  return (
    <InventoryContext.Provider
      value={{
        rawSb1,
        rawSaldo,
        rawConf,
        rawValidades,
        loading,
        error,
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
        kpis,
        // Ações
        toggleEtiqueta,
        saveCount
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
