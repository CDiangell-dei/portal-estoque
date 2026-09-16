import { supabase } from './supabase'

export async function logAuditAction({
  filial = '01',
  armazem = '01',
  produto = '',
  lote = '',
  acao = '',
  detalhes = '',
  modulo = 'ESTOQUE',
  meta = {},
  currentUser = null
}) {
  try {
    const userName = currentUser ? (currentUser.nome || currentUser.username || 'USUARIO') : 'SISTEMA'
    const userMat = currentUser ? (currentUser.matricula || currentUser.id || '0000') : '0000'

    const payload = {
      filial: String(filial || '01').trim().padStart(2, '0'),
      armazem: String(armazem || '01').trim().padStart(2, '0'),
      produto: String(produto || '').trim().toUpperCase(),
      lote: String(lote || '').trim().toUpperCase(),
      modulo,
      acao,
      detalhes,
      usuario_nome: userName,
      usuario_matricula: String(userMat),
      meta,
      created_at: new Date().toISOString()
    }

    const { error } = await supabase.from('auditoria_estoque').insert([payload])
    if (error) {
      console.warn('Erro ao gravar auditoria no Supabase:', error)
    }
  } catch (err) {
    console.warn('Falha silenciosa ao registrar auditoria:', err)
  }
}
