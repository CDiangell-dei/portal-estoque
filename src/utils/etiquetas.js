const ETIQUETA_EXPIRATION_DAYS = 60
const ETIQUETA_EXPIRATION_MS = ETIQUETA_EXPIRATION_DAYS * 24 * 60 * 60 * 1000

let inMemoryEtiquetasMap = null
let inMemoryEtiquetasTimestamp = 0

export function makeEtiquetaKey(filial, armazem, codigo) {
  const f = String(filial || '01').trim().padStart(2, '0')
  const a = String(armazem || '01').trim().padStart(2, '0')
  const c = String(codigo || '').trim().toUpperCase()
  return `${f}_${a}_${c}`
}

export function getEtiquetasStorageMap(forceReload = false) {
  const now = Date.now()
  if (!forceReload && inMemoryEtiquetasMap !== null && (now - inMemoryEtiquetasTimestamp) < 30000) {
    return inMemoryEtiquetasMap
  }

  try {
    const raw = localStorage.getItem('amazon_etiquetas_status')
    if (!raw) {
      inMemoryEtiquetasMap = {}
      inMemoryEtiquetasTimestamp = now
      return inMemoryEtiquetasMap
    }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      inMemoryEtiquetasMap = {}
      inMemoryEtiquetasTimestamp = now
      return inMemoryEtiquetasMap
    }

    let cleaned = false
    for (const key of Object.keys(parsed)) {
      const entry = parsed[key]
      if (!entry || !entry.trocado_em) {
        delete parsed[key]
        cleaned = true
        continue
      }
      const dt = typeof entry._ts === 'number' ? entry._ts : new Date(entry.trocado_em).getTime()
      if (isNaN(dt) || (now - dt) > ETIQUETA_EXPIRATION_MS) {
        delete parsed[key]
        cleaned = true
      } else {
        entry._ts = dt
      }
    }
    if (cleaned) {
      try { localStorage.setItem('amazon_etiquetas_status', JSON.stringify(parsed)) } catch (e) {}
    }
    inMemoryEtiquetasMap = parsed
    inMemoryEtiquetasTimestamp = now
    return inMemoryEtiquetasMap
  } catch (e) {
    console.warn('Erro ao carregar mapa de etiquetas:', e)
    inMemoryEtiquetasMap = {}
    inMemoryEtiquetasTimestamp = now
    return inMemoryEtiquetasMap
  }
}

export function setEtiquetasCache(newMap) {
  inMemoryEtiquetasMap = { ...newMap }
  inMemoryEtiquetasTimestamp = Date.now()
  try {
    localStorage.setItem('amazon_etiquetas_status', JSON.stringify(inMemoryEtiquetasMap))
  } catch (e) {
    console.warn('Erro ao salvar etiquetas no localStorage:', e)
  }
}

export function mergeEtiquetasFromDb(dbRows = []) {
  const now = Date.now()
  const dbMap = {}

  // Processa na ordem cronológica (os mais recentes sobrescrevem os mais antigos)
  if (Array.isArray(dbRows)) {
    for (const row of dbRows) {
      const filPad = String(row.filial || '01').trim().padStart(2, '0')
      const armPad = String(row.armazem || '01').trim().padStart(2, '0')
      const codNorm = String(row.produto || '').trim().toUpperCase()
      if (!codNorm) continue

      const key = makeEtiquetaKey(filPad, armPad, codNorm)
      const action = String(row.acao || '').toUpperCase()

      if (action === 'ETIQUETA_TROCADA') {
        const dateRaw = row.meta?.trocado_em || row.created_at || new Date().toISOString()
        const dt = new Date(dateRaw).getTime()
        if (isNaN(dt) || (now - dt) > ETIQUETA_EXPIRATION_MS) {
          delete dbMap[key]
        } else {
          dbMap[key] = {
            filial: filPad,
            armazem: armPad,
            codigo: codNorm,
            status: true,
            trocado_em: dateRaw,
            _ts: dt,
            usuario_nome: row.usuario_nome || 'SISTEMA',
            usuario_matricula: String(row.usuario_matricula || '0000')
          }
        }
      } else if (action === 'ETIQUETA_DESMARCADA') {
        delete dbMap[key]
      }
    }
  }

  // Mescla com cache local pré-existente (preservando entradas locais recentes)
  const currentLocal = getEtiquetasStorageMap(true)
  const merged = { ...dbMap }

  for (const [key, localEntry] of Object.entries(currentLocal)) {
    if (!localEntry || !localEntry.trocado_em) continue
    const lts = typeof localEntry._ts === 'number' ? localEntry._ts : new Date(localEntry.trocado_em).getTime()
    if (isNaN(lts) || (now - lts) > ETIQUETA_EXPIRATION_MS) continue

    const dbEntry = dbMap[key]
    if (!dbEntry || lts > dbEntry._ts) {
      merged[key] = localEntry
    }
  }

  setEtiquetasCache(merged)
  return merged
}

export function isEtiquetaTrocada(filial, armazem, codigo, cachedMap = null) {
  const map = cachedMap || getEtiquetasStorageMap()
  const filPad = String(filial || '01').trim().padStart(2, '0')
  const armPad = String(armazem || '01').trim().padStart(2, '0')
  const codNorm = String(codigo || '').trim().toUpperCase()

  // 1. Busca exata com filial
  const key = makeEtiquetaKey(filPad, armPad, codNorm)
  let entry = map[key]

  // 2. Fallback: se não encontrar e filial for '01' ou '05', verifica variações comuns ou armazém + código
  if (!entry) {
    const altFil = filPad === '01' ? '05' : '01'
    entry = map[makeEtiquetaKey(altFil, armPad, codNorm)]
  }

  // 3. Fallback genérico: busca qualquer filial para aquele armazém e código
  if (!entry) {
    const suffix = `_${armPad}_${codNorm}`
    const matchKey = Object.keys(map).find(k => k.endsWith(suffix))
    if (matchKey) entry = map[matchKey]
  }

  if (!entry || entry.status !== true || !entry.trocado_em) return false
  const dt = typeof entry._ts === 'number' ? entry._ts : new Date(entry.trocado_em).getTime()
  if (isNaN(dt) || (Date.now() - dt) > ETIQUETA_EXPIRATION_MS) return false
  return true
}

export function getEtiquetaInfo(filial, armazem, codigo, cachedMap = null) {
  const map = cachedMap || getEtiquetasStorageMap()
  const filPad = String(filial || '01').trim().padStart(2, '0')
  const armPad = String(armazem || '01').trim().padStart(2, '0')
  const codNorm = String(codigo || '').trim().toUpperCase()

  const key = makeEtiquetaKey(filPad, armPad, codNorm)
  let entry = map[key]

  if (!entry) {
    const altFil = filPad === '01' ? '05' : '01'
    entry = map[makeEtiquetaKey(altFil, armPad, codNorm)]
  }

  if (!entry) {
    const suffix = `_${armPad}_${codNorm}`
    const matchKey = Object.keys(map).find(k => k.endsWith(suffix))
    if (matchKey) entry = map[matchKey]
  }

  return entry || null
}

export function saveEtiquetaToggle(filial, armazem, codigo, currentUser) {
  const filPad = String(filial || '01').trim().padStart(2, '0')
  const armPad = String(armazem || '01').trim().padStart(2, '0')
  const codNorm = String(codigo || '').trim().toUpperCase()
  const key = makeEtiquetaKey(filPad, armPad, codNorm)

  const map = getEtiquetasStorageMap()
  const current = map[key] || getEtiquetaInfo(filPad, armPad, codNorm, map)
  const currentTs = current ? (typeof current._ts === 'number' ? current._ts : new Date(current.trocado_em).getTime()) : 0
  const isCurrentlyOk = current && current.status === true && ((Date.now() - currentTs) <= ETIQUETA_EXPIRATION_MS)

  const newStatus = !isCurrentlyOk
  const now = Date.now()
  const nowIso = new Date(now).toISOString()

  const userName = currentUser ? (currentUser.nome || currentUser.username || 'USUARIO') : 'USUARIO'
  const userMat = currentUser ? (currentUser.matricula || currentUser.id || '0000') : '0000'

  if (newStatus) {
    map[key] = {
      filial: filPad,
      armazem: armPad,
      codigo: codNorm,
      status: true,
      trocado_em: nowIso,
      _ts: now,
      usuario_nome: userName,
      usuario_matricula: String(userMat)
    }
  } else {
    delete map[key]
    // Também limpa variações
    const altFil = filPad === '01' ? '05' : '01'
    delete map[makeEtiquetaKey(altFil, armPad, codNorm)]
  }

  setEtiquetasCache(map)
  return { newStatus, key, entry: map[key] || null }
}
