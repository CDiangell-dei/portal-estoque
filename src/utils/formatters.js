export const FILIAIS_LIST = [
  { num_filial: '00', nome_filial: 'Geral (Todas as Filiais)' },
  { num_filial: '01', nome_filial: '01 - Alvorada' },
  { num_filial: '02', nome_filial: '02 - Matriz CD' },
  { num_filial: '04', nome_filial: '04 - Raiz' },
  { num_filial: '05', nome_filial: '05 - Cidade Nova' },
  { num_filial: '06', nome_filial: '06 - Jorge Teixeira' },
  { num_filial: '12', nome_filial: '12 - Boa Vista' }
]

export function getFilialName(num) {
  const fPad = String(num || '01').padStart(2, '0')
  const found = FILIAIS_LIST.find(f => f.num_filial === fPad)
  return found ? found.nome_filial : `Filial ${fPad}`
}

export function isGlobalFilial(user) {
  if (!user) return false
  const fil = String(user.filial_atual || user.filial || '').trim()
  return fil === '00' || fil === '0' || user.role === 'admin' || user.is_admin || user.eh_admin === true
}

export function formatNumber(val, minimumFractionDigits = 0) {
  if (val === null || val === undefined || isNaN(val)) return '-'
  return Number(val).toLocaleString('pt-BR', { minimumFractionDigits })
}

export function formatDate(val) {
  if (!val) return '-'
  const d = new Date(val)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('pt-BR')
}

export function normalizeProductCode(term) {
  if (!term) return ''
  return String(term).trim().toUpperCase()
}
