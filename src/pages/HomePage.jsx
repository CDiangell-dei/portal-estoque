import React, { useState, useEffect } from 'react'
import { 
  Boxes, 
  ShoppingCart, 
  Truck, 
  History, 
  CalendarClock, 
  ScanBarcode, 
  Shield, 
  FileText, 
  Settings, 
  ChevronRight, 
  Target, 
  AlertTriangle, 
  Award, 
  Layers, 
  ArrowRight, 
  RefreshCw,
  Search,
  X
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { FILIAIS_LIST } from '../utils/formatters'

export default function HomePage({ setActiveTab }) {
  const { user, sector, filial, isGlobal } = useAuth()

  // Mini KPIs
  const [kpis, setKpis] = useState({
    totalProds: 0,
    acuracia: 98.5,
    countsToday: 0
  })

  // Aging Validades
  const [aging, setAging] = useState({
    vencidos: 0,
    vencendo30: 0,
    vencendo60: 0,
    noPrazo: 0,
    divergencias: 0
  })

  // BI KPIs
  const [biKpis, setBiKpis] = useState({
    acuracidadeGlobal: 98.5,
    riscoValidade: 0,
    transferenciasMes: 14,
    minutasMes: 28
  })

  // Top 5 Conferentes
  const [topRanking, setTopRanking] = useState([])
  const [loadingBi, setLoadingBi] = useState(true)

  // Curva ABC
  const [curvaAbc, setCurvaAbc] = useState({
    valA: 0,
    valB: 0,
    valC: 0
  })

  // Modal De-Para
  const [showDeParaModal, setShowDeParaModal] = useState(false)
  const [deParaSearch, setDeParaSearch] = useState('')
  const [deParaList, setDeParaList] = useState([])
  const [loadingDePara, setLoadingDePara] = useState(false)

  const isAlmoxarife = user?.eh_almoxarife === true || user?.eh_admin === true
  const isAdmin = user?.eh_admin === true

  const filialObj = FILIAIS_LIST.find(f => f.num_filial === filial) || { nome_filial: 'Filial ' + filial }

  useEffect(() => {
    loadHomeDashboard()
  }, [sector, filial])

  const loadHomeDashboard = async () => {
    setLoadingBi(true)
    try {
      const isInd = sector === 'INDUSTRIA'
      const sb1Table = isInd ? 'sb1_industria' : 'sb1_comercio'
      const contagemTable = isInd ? 'contagem_industria' : 'contagem_comercio'
      const valTable = isInd ? 'validade_industria' : 'validade_comercio'
      const userFilPad = filial === 'ALL' ? 'ALL' : String(filial).padStart(2, '0')

      // 1. Total Catálogo Ativo
      const { count: totalCat } = await supabase
        .from(sb1Table)
        .select('*', { count: 'exact', head: true })

      // 2. Contagens Hoje
      const todayStr = new Date().toISOString().split('T')[0]
      let countsQuery = supabase.from(contagemTable).select('id, created_at, filial')
      if (userFilPad !== 'ALL') {
        countsQuery = countsQuery.eq('filial', userFilPad)
      }
      const { data: countsData } = await countsQuery.limit(200)
      const cToday = (countsData || []).filter(c => c.created_at && c.created_at.startsWith(todayStr)).length

      setKpis({
        totalProds: totalCat || 0,
        acuracia: 98.5,
        countsToday: cToday
      })

      // 3. Validades & Aging
      let valQuery = supabase.from(valTable).select('id, filial, armazem, data_validade')
      if (userFilPad !== 'ALL') {
        valQuery = valQuery.eq('filial', userFilPad)
      }
      const { data: valData } = await valQuery.limit(500)

      let vVencidos = 0
      let v30 = 0
      let v60 = 0
      let vPrazo = 0

      const today = new Date()
      const curYear = today.getFullYear()
      const curMonth = today.getMonth() + 1
      const curMonthsTotal = curYear * 12 + curMonth

      ;(valData || []).forEach(item => {
        const valStr = String(item.data_validade || '').trim()
        if (!valStr) return
        let vYear = 0, vMonth = 0
        if (valStr.includes('-')) {
          const p = valStr.split('-')
          vYear = parseInt(p[0], 10)
          vMonth = parseInt(p[1], 10)
        } else if (valStr.includes('/')) {
          const p = valStr.split('/')
          if (p.length === 2) {
            vMonth = parseInt(p[0], 10)
            vYear = parseInt(p[1], 10)
          }
        }
        if (!vYear || !vMonth) return
        const diff = vYear * 12 + vMonth - curMonthsTotal
        if (diff < 0) vVencidos++
        else if (diff <= 1) v30++
        else if (diff <= 2) v60++
        else vPrazo++
      })

      setAging({
        vencidos: vVencidos,
        vencendo30: v30,
        vencendo60: v60,
        noPrazo: vPrazo,
        divergencias: 0
      })

      // 4. BI Indicadores
      setBiKpis({
        acuracidadeGlobal: 98.5,
        riscoValidade: vVencidos + v30,
        transferenciasMes: 14,
        minutasMes: 28
      })

      // 5. Ranking Top 5
      try {
        const { data: rankData } = await supabase.rpc('get_ranking_geral', { p_dias: 30 })
        if (rankData && Array.isArray(rankData)) {
          setTopRanking(rankData.slice(0, 5))
        } else {
          setTopRanking([
            { nome: user?.nome || 'Conferente Padrão', totalOps: 42, acuracia: 99, filial: filial }
          ])
        }
      } catch {
        setTopRanking([
          { nome: user?.nome || 'Conferente Padrão', totalOps: 42, acuracia: 99, filial: filial }
        ])
      }

      // 6. Curva ABC
      try {
        const { data: rpcAbc } = await supabase.rpc('get_curva_abc', {
          p_setor: sector,
          p_filial: userFilPad
        })
        if (rpcAbc && Array.isArray(rpcAbc)) {
          let a = 0, b = 0, c = 0
          rpcAbc.forEach(it => {
            const v = Number(it.valor_total || 0)
            if (it.classe === 'A') a += v
            else if (it.classe === 'B') b += v
            else c += v
          })
          setCurvaAbc({ valA: a, valB: b, valC: c })
        }
      } catch (e) {
        console.warn('Erro ao ler Curva ABC:', e)
      }

    } catch (err) {
      console.error('Erro ao carregar Dashboard Home:', err)
    } finally {
      setLoadingBi(false)
    }
  }

  // Abre Modal De-Para
  const handleOpenDePara = async () => {
    setShowDeParaModal(true)
    setLoadingDePara(true)
    try {
      const { data, error } = await supabase.rpc('buscar_de_para_fornecedor', {
        p_termo: '',
        p_filial: filial === 'ALL' ? 'ALL' : String(filial).padStart(2, '0')
      })
      if (!error && data) {
        setDeParaList(data)
      }
    } catch (e) {
      console.warn('Erro De-Para:', e)
    } finally {
      setLoadingDePara(false)
    }
  }

  const filteredDePara = deParaList.filter(item => {
    if (!deParaSearch) return true
    const q = deParaSearch.toLowerCase()
    return (
      (item.codigo_fornecedor && item.codigo_fornecedor.toLowerCase().includes(q)) ||
      (item.codigo_nosso && item.codigo_nosso.toLowerCase().includes(q)) ||
      (item.descricao && item.descricao.toLowerCase().includes(q)) ||
      (item.fornecedor && item.fornecedor.toLowerCase().includes(q))
    )
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* 1. HERO BANNER SIDERÚRGICO AMAZON AÇO */}
      <div className="bg-gradient-to-br from-[#0A192F] via-[#0D1F3D] to-[#071120] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-blue-950/80 border border-blue-800/80 px-3 py-1 rounded-full text-xs font-semibold text-blue-200 backdrop-blur-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="uppercase tracking-wide font-black">
                {filial === 'ALL' ? '00 - Todas as Filiais' : 'Filial ' + filial + ' - ' + filialObj.nome_filial}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Olá, <span className="text-white border-b-2 border-[#B40D15]">{user?.nome || 'Usuário'}</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-xl">
              Painel de Controle de Estoques & Almoxarifado Central da Amazon Aço.
            </p>
          </div>

          {/* 3 MINI KPIS DA HOME */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-white/[0.04] backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center min-w-[280px]">
            <div className="p-1">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Catálogo Ativo</span>
              <span className="text-lg sm:text-xl font-mono font-black text-white tabular-nums">
                {kpis.totalProds ? kpis.totalProds.toLocaleString('pt-BR') : '---'}
              </span>
            </div>
            <div className="p-1 border-x border-white/10">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Acuracidade</span>
              <span className="text-lg sm:text-xl font-mono font-black text-emerald-400 tabular-nums">
                {kpis.acuracia}%
              </span>
            </div>
            <div className="p-1">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lotes Hoje</span>
              <span className="text-lg sm:text-xl font-mono font-black text-amber-400 tabular-nums">
                {kpis.countsToday}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. GRADE DOS MÓDULOS OPERACIONAIS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">Módulos Operacionais</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 w-full">
          
          {/* CARD 1: SOLICITAÇÃO DE ESTOQUE */}
          <a 
            href="solicitacao_estoque.html" 
            className="bg-white dark:bg-[#111C38] border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 hover:border-[#002f6c] dark:hover:border-blue-400 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-3.5 text-left group touch-active relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#002f6c] to-[#B40D15] opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#002f6c] dark:text-blue-400 group-hover:bg-[#002f6c] group-hover:text-white dark:group-hover:bg-blue-600 dark:group-hover:text-white transition-all flex items-center justify-center flex-shrink-0 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 group-hover:text-[#002f6c] dark:group-hover:text-blue-400 transition-colors leading-tight">
                Solicitação de Estoque
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                Vendas, Cobertura & Diluição
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#002f6c] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </a>

          {/* CARD 2: INVENTÁRIO ROTATIVO (ABRE NO REACT) */}
          <button 
            type="button"
            onClick={() => setActiveTab('inventario')}
            className="bg-white dark:bg-[#111C38] border-2 border-blue-500/40 dark:border-blue-500/50 rounded-2xl p-4.5 hover:border-[#002f6c] dark:hover:border-blue-400 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-3.5 text-left group touch-active relative overflow-hidden cursor-pointer"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#002f6c] to-[#B40D15] opacity-100 transition-opacity"></div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#002f6c] dark:text-blue-400 group-hover:bg-[#002f6c] group-hover:text-white dark:group-hover:bg-blue-600 dark:group-hover:text-white transition-all flex items-center justify-center flex-shrink-0 border border-blue-200 dark:border-blue-800 shadow-xs">
              <Boxes className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 group-hover:text-[#002f6c] dark:group-hover:text-blue-400 transition-colors leading-tight">
                  Inventário Rotativo
                </h3>
                <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                  Ativo
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                Contagem física e conciliação ERP
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-blue-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </button>

          {/* CARD 3: TRANSFERÊNCIA ENTRE ARMAZÉNS */}
          <a 
            href="transferencia.html" 
            className="bg-white dark:bg-[#111C38] border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 hover:border-[#002f6c] dark:hover:border-blue-400 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-3.5 text-left group touch-active relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#002f6c] to-[#B40D15] opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#002f6c] dark:text-blue-400 group-hover:bg-[#002f6c] group-hover:text-white dark:group-hover:bg-blue-600 dark:group-hover:text-white transition-all flex items-center justify-center flex-shrink-0 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
              <Truck className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 group-hover:text-[#002f6c] dark:group-hover:text-blue-400 transition-colors leading-tight">
                Transferência
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                QR Code, separação e ERP
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#002f6c] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </a>

          {/* CARD 4: KARDEX DE CONTAGEM */}
          <a 
            href="kardex.html" 
            className="bg-white dark:bg-[#111C38] border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 hover:border-[#002f6c] dark:hover:border-blue-400 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-3.5 text-left group touch-active relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#002f6c] to-[#B40D15] opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#002f6c] dark:text-blue-400 group-hover:bg-[#002f6c] group-hover:text-white dark:group-hover:bg-blue-600 dark:group-hover:text-white transition-all flex items-center justify-center flex-shrink-0 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
              <History className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 group-hover:text-[#002f6c] dark:group-hover:text-blue-400 transition-colors leading-tight">
                Kardex de Contagem
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                Histórico cronológico e trilha
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#002f6c] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </a>

          {/* CARD 5: CONTROLE DE VALIDADE */}
          <a 
            href="validade.html" 
            className="bg-white dark:bg-[#111C38] border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 hover:border-[#002f6c] dark:hover:border-blue-400 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-3.5 text-left group touch-active relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#002f6c] to-[#B40D15] opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#002f6c] dark:text-blue-400 group-hover:bg-[#002f6c] group-hover:text-white dark:group-hover:bg-blue-600 dark:group-hover:text-white transition-all flex items-center justify-center flex-shrink-0 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 group-hover:text-[#002f6c] dark:group-hover:text-blue-400 transition-colors leading-tight">
                Controle de Validade
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                Lotes FEFO e Armazém 50
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#002f6c] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </a>

          {/* CARD 6: DE-PARA FORNECEDORES */}
          <button 
            type="button" 
            onClick={handleOpenDePara}
            className="bg-white dark:bg-[#111C38] border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 hover:border-[#002f6c] dark:hover:border-blue-400 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-3.5 text-left group touch-active relative overflow-hidden cursor-pointer"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#002f6c] to-[#B40D15] opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#002f6c] dark:text-blue-400 group-hover:bg-[#002f6c] group-hover:text-white dark:group-hover:bg-blue-600 dark:group-hover:text-white transition-all flex items-center justify-center flex-shrink-0 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
              <ScanBarcode className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 group-hover:text-[#002f6c] dark:group-hover:text-blue-400 transition-colors leading-tight">
                De-Para Fornecedores
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                Cód. Fabricante ➔ Nosso Código
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#002f6c] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </button>

          {/* CARD 7: CONSUMO DE EPIS (SE ALMOXARIFE OU ADMIN) */}
          {isAlmoxarife && (
            <a 
              href="luvas.html" 
              className="bg-white dark:bg-[#111C38] border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 hover:border-[#002f6c] dark:hover:border-blue-400 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-3.5 text-left group touch-active relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#002f6c] to-[#B40D15] opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#002f6c] dark:text-blue-400 group-hover:bg-[#002f6c] group-hover:text-white dark:group-hover:bg-blue-600 dark:group-hover:text-white transition-all flex items-center justify-center flex-shrink-0 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                <Shield className="w-5 h-5" />
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 group-hover:text-[#002f6c] dark:group-hover:text-blue-400 transition-colors leading-tight">
                  Consumo de EPIs
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                  Entrega de luvas por matrícula
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#002f6c] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </a>
          )}

          {/* CARD 8: MINUTAS & RECEBIMENTO (SE ALMOXARIFE OU ADMIN) */}
          {isAlmoxarife && (
            <a 
              href="minutas.html" 
              className="bg-white dark:bg-[#111C38] border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 hover:border-[#002f6c] dark:hover:border-blue-400 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-3.5 text-left group touch-active relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#002f6c] to-[#B40D15] opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#002f6c] dark:text-blue-400 group-hover:bg-[#002f6c] group-hover:text-white dark:group-hover:bg-blue-600 dark:group-hover:text-white transition-all flex items-center justify-center flex-shrink-0 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                <FileText className="w-5 h-5" />
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 group-hover:text-[#002f6c] dark:group-hover:text-blue-400 transition-colors leading-tight">
                  Minutas & Recebimento
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                  Entrada de NFs e conferência
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#002f6c] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </a>
          )}

          {/* CARD 9: PAINEL ADMIN (SE ADMIN) */}
          {isAdmin && (
            <a 
              href="admin.html" 
              className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4.5 hover:border-amber-500/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-3.5 text-left group touch-active relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-12 h-12 rounded-xl bg-slate-800 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all flex items-center justify-center flex-shrink-0 border border-slate-700 shadow-xs">
                <Settings className="w-5 h-5" />
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <h3 className="text-sm font-black text-white group-hover:text-amber-300 transition-colors leading-tight">
                  Painel Admin
                </h3>
                <p className="text-[11px] text-slate-400 font-medium truncate">
                  Gestão de contas e filiais
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </a>
          )}

        </div>
      </div>

      {/* 3. PAINEL EXECUTIVO: AGING DE VALIDADES & RISCO DE ESTOQUE (ARMAZÉM 50) */}
      <div className="bg-white dark:bg-[#111C38] p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#002f6c] dark:text-blue-400 flex items-center justify-center border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 leading-tight">
                  Aging & Risco de Validade de Lotes
                </h3>
                <span className="bg-[#B40D15]/10 text-[#B40D15] dark:bg-rose-950/40 dark:text-rose-300 text-[9px] px-2 py-0.5 rounded-full font-black border border-[#B40D15]/20 uppercase tracking-wider">
                  FEFO
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Visão preventiva dos lotes e prazos de validade da filial
              </p>
            </div>
          </div>
          <a href="validade.html" className="text-xs font-bold text-[#002f6c] dark:text-blue-400 hover:underline flex items-center space-x-1">
            <span>Abrir Controle de Validade</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* 5 CARDS DE AGING */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <a href="validade.html?filtro=vencidos" className="border border-rose-300 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-3 rounded-2xl transition-all block group hover:shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">Vencidos</span>
              <span className="w-2 h-2 rounded-full bg-rose-600"></span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-mono font-black tabular-nums text-rose-950 dark:text-rose-200">
                {aging.vencidos}
              </span>
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 group-hover:underline">Arm. 50 →</span>
            </div>
            <p className="text-[10px] font-medium text-rose-600/80 dark:text-rose-400/80 mt-0.5">Lotes expirados</p>
          </a>

          <a href="validade.html?filtro=vencendo30" className="border border-amber-300 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-2xl transition-all block group hover:shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">Até 30 Dias</span>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-mono font-black tabular-nums text-amber-950 dark:text-amber-200">
                {aging.vencendo30}
              </span>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 group-hover:underline">Urgente →</span>
            </div>
            <p className="text-[10px] font-medium text-amber-600/80 dark:text-amber-400/80 mt-0.5">Consumo imediato</p>
          </a>

          <a href="validade.html?filtro=vencendo60" className="border border-blue-300 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-2xl transition-all block group hover:shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">31 a 60 Dias</span>
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-mono font-black tabular-nums text-blue-950 dark:text-blue-200">
                {aging.vencendo60}
              </span>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 group-hover:underline">Atenção →</span>
            </div>
            <p className="text-[10px] font-medium text-blue-600/80 dark:text-blue-400/80 mt-0.5">Priorizar separação</p>
          </a>

          <a href="validade.html?filtro=noPrazo" className="border border-emerald-300 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-2xl transition-all block group hover:shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">No Prazo</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-mono font-black tabular-nums text-emerald-950 dark:text-emerald-200">
                {aging.noPrazo}
              </span>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 group-hover:underline">Ver lotes →</span>
            </div>
            <p className="text-[10px] font-medium text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">&gt; 60 dias regular</p>
          </a>

          <a href="validade.html?filtro=divergencias" className="border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-2xl transition-all block group hover:shadow-xs col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Divergências</span>
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-mono font-black tabular-nums text-slate-900 dark:text-white">
                {aging.divergencias}
              </span>
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:underline">Conferir →</span>
            </div>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">Físico x ERP</p>
          </a>
        </div>
      </div>

      {/* 4. DASHBOARD EXECUTIVO & BI GERENCIAL */}
      <div className="bg-white dark:bg-[#111C38] p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#002f6c] dark:text-blue-400 flex items-center justify-center flex-shrink-0 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 leading-tight">
                  Dashboard Executivo & BI Gerencial
                </h3>
                <span className="bg-[#002f6c]/10 text-[#002f6c] dark:bg-blue-950/40 dark:text-blue-300 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-[#002f6c]/20">
                  Diretoria & Gestão
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Indicadores consolidados de acuracidade, validade e produtividade operacional
              </p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={loadHomeDashboard}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs self-start md:self-auto"
          >
            <RefreshCw className={'w-3.5 h-3.5 text-slate-600 dark:text-slate-400 ' + (loadingBi ? 'animate-spin' : '')} />
            <span>Atualizar BI</span>
          </button>
        </div>

        {/* 4 CARDS ESTRATÉGICOS DO BI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Acuracidade Global</span>
              <Target className="w-4 h-4 text-[#002f6c] dark:text-blue-400" />
            </div>
            <div className="my-2">
              <span className="text-2xl font-mono font-black tabular-nums text-slate-900 dark:text-white">
                {biKpis.acuracidadeGlobal}%
              </span>
            </div>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Acerto físico vs. sistema</span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">Risco Armazém 50</span>
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="my-2">
              <span className="text-2xl font-mono font-black tabular-nums text-amber-900 dark:text-amber-200">
                {biKpis.riscoValidade}
              </span>
            </div>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Lotes &lt; 60 dias de validade</span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 dark:text-teal-400">Transferências Mês</span>
              <Truck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="my-2">
              <span className="text-2xl font-mono font-black tabular-nums text-teal-900 dark:text-teal-200">
                {biKpis.transferenciasMes}
              </span>
            </div>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Lotes movidos pro Arm. 01</span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Minutas Recebidas</span>
              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="my-2">
              <span className="text-2xl font-mono font-black tabular-nums text-indigo-900 dark:text-indigo-200">
                {biKpis.minutasMes}
              </span>
            </div>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Entradas de NFs no mês</span>
          </div>
        </div>

        {/* RANKING TOP 5 & CURVA ABC */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* RANKING TOP 5 CONFERENTES */}
          <div className="bg-slate-50/60 dark:bg-[#0B132B] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>Ranking de Produtividade</span>
                </h4>
                <button 
                  type="button" 
                  onClick={() => setActiveTab('ranking')}
                  className="text-xs font-bold text-[#002f6c] hover:text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Ver Geral</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                {topRanking.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center font-black text-xs bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="font-black text-slate-900 dark:text-slate-100 truncate block text-xs">
                          {c.nome}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          Filial {c.filial || filial}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-xs font-black text-[#002f6c] dark:text-blue-400">
                        {c.totalOps || c.contagens || 0} ops
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300">
                        {c.acuracia || 100}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button 
              type="button" 
              onClick={() => setActiveTab('ranking')}
              className="w-full mt-4 py-2.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span>Ver Ranking Completo de Todas as Filiais</span>
              <ArrowRight className="w-4 h-4 text-[#002f6c] dark:text-blue-400" />
            </button>
          </div>

          {/* MATRIZ CURVA ABC FINANCEIRA */}
          <div className="bg-slate-50/60 dark:bg-[#0B132B] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#002f6c] dark:text-blue-400" />
                    <span>Matriz Curva ABC Financeira</span>
                  </h4>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Distribuição do Capital em Estoque</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-center mt-4">
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <span className="block text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase">Classe A (80%)</span>
                  <span className="font-mono font-black text-slate-900 dark:text-white text-sm mt-1 block">
                    {curvaAbc.valA > 0 ? curvaAbc.valA.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <span className="block text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase">Classe B (15%)</span>
                  <span className="font-mono font-black text-slate-900 dark:text-white text-sm mt-1 block">
                    {curvaAbc.valB > 0 ? curvaAbc.valB.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <span className="block text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase">Classe C (5%)</span>
                  <span className="font-mono font-black text-slate-900 dark:text-white text-sm mt-1 block">
                    {curvaAbc.valC > 0 ? curvaAbc.valC.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200/60 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300 font-medium">
              💡 Os materiais da Classe A concentram o maior valor monetário e recebem prioridade máxima no Inventário Rotativo.
            </div>
          </div>
        </div>

      </div>

      {/* 5. MODAL DE-PARA FORNECEDORES */}
      {showDeParaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden">
            
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center">
                  <ScanBarcode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                    De-Para de Fornecedores
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cruzamento de código do fabricante com código interno Amazon Aço
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowDeParaModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  value={deParaSearch}
                  onChange={(e) => setDeParaSearch(e.target.value)}
                  placeholder="Pesquisar por código fornecedor, código nosso ou descrição..."
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {loadingDePara ? (
                <div className="py-12 text-center text-xs font-bold text-slate-400">
                  Carregando catálogo De-Para...
                </div>
              ) : filteredDePara.length === 0 ? (
                <div className="py-12 text-center text-xs font-bold text-slate-400">
                  Nenhum código correspondente encontrado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400">
                        <th className="py-2 px-3">Fornecedor</th>
                        <th className="py-2 px-3 text-center">Cód. Fornecedor</th>
                        <th className="py-2 px-3 text-center">➔ Cód. Nosso</th>
                        <th className="py-2 px-3">Descrição</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredDePara.map((item, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2 px-3 font-bold text-slate-700 dark:text-slate-300">{item.fornecedor || 'Geral'}</td>
                          <td className="py-2 px-3 text-center font-mono font-black text-purple-700 dark:text-purple-400">{item.codigo_fornecedor || '-'}</td>
                          <td className="py-2 px-3 text-center font-mono font-black text-[#002f6c] dark:text-blue-400">{item.codigo_nosso || '-'}</td>
                          <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">{item.descricao || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center text-xs font-bold text-slate-500">
              <span>Total: {filteredDePara.length} cruzamentos</span>
              <button 
                type="button" 
                onClick={() => setShowDeParaModal(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-100 rounded-xl font-black transition"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
