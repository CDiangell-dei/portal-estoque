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
  if (!forceReload && inMemoryEtiquetasMap !== null && (now - inMemoryEtiquetasTimestamp) < 60000) {
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

export function isEtiquetaTrocada(filial, armazem, codigo, cachedMap = null) {
  const map = cachedMap || getEtiquetasStorageMap()
  const key = makeEtiquetaKey(filial, armazem, codigo)
  const entry = map[key]
  if (!entry || entry.status !== true || !entry.trocado_em) return false
  const dt = typeof entry._ts === 'number' ? entry._ts : new Date(entry.trocado_em).getTime()
  if (isNaN(dt) || (Date.now() - dt) > ETIQUETA_EXPIRATION_MS) return false
  return true
}

export function getEtiquetaInfo(filial, armazem, codigo, cachedMap = null) {
  const map = cachedMap || getEtiquetasStorageMap()
  const key = makeEtiquetaKey(filial, armazem, codigo)
  return map[key] || null
}

export function saveEtiquetaToggle(filial, armazem, codigo, currentUser) {
  const filPad = String(filial || '01').trim().padStart(2, '0')
  const armPad = String(armazem || '01').trim().padStart(2, '0')
  const codNorm = String(codigo || '').trim().toUpperCase()
  const key = makeEtiquetaKey(filPad, armPad, codNorm)

  const map = getEtiquetasStorageMap()
  const current = map[key]
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
  }

  inMemoryEtiquetasMap = map
  inMemoryEtiquetasTimestamp = now

  try {
    localStorage.setItem('amazon_etiquetas_status', JSON.stringify(map))
  } catch (e) {
    console.error('Erro ao salvar etiquetas:', e)
  }

  return { newStatus, key, entry: map[key] || null }
}
