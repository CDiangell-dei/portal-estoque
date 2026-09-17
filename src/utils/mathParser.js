/**
 * Avalia de forma segura expressões matemáticas inteligentes digitadas pelo operador.
 * Suporta:
 * - Operações básicas: +, -, *, /, decimais com ponto ou vírgula
 * - Parênteses balanceados automaticamente: (10 * 12 + 5
 * - Multiplicação implícita: 10(12) ou (5+5)(2)
 * - Adição cumulativa se iniciar com +: +15 soma ao valor anterior
 */
export function parseSmartMathExpression(exprStr, prevCount = 0) {
  if (exprStr === null || exprStr === undefined) return null
  let s = String(exprStr).trim()
  if (!s) return null

  // Substitui vírgula por ponto decimal
  s = s.replace(/,/g, '.')

  // Se começar com '+', soma ao valor já existente
  if (s.startsWith('+')) {
    s = `${prevCount}` + s
  }

  // Balanceia parênteses não fechados automaticamente
  const openCount = (s.match(/\(/g) || []).length
  const closeCount = (s.match(/\)/g) || []).length
  if (openCount > closeCount) {
    s += ')'.repeat(openCount - closeCount)
  }

  // Multiplicação implícita: 10(5) -> 10*(5) e (5)(2) -> (5)*(2)
  s = s.replace(/(\d+(\.\d+)?)\s*\(/g, '$1*(')
  s = s.replace(/\)\s*(\d+(\.\d+)?)/g, ')*$1')
  s = s.replace(/\)\s*\(/g, ')*(')

  // Validação estrita de segurança: apenas dígitos e operadores aritméticos
  if (!/^[0-9+\-*/.()\s]+$/.test(s)) return null

  try {
    const result = Function(`'use strict'; return (${s});`)()
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      // Arredonda para no máximo 4 casas decimais
      return Math.round(result * 10000) / 10000
    }
  } catch {
    return null
  }

  return null
}

/**
 * Retorna true se o texto parecer ser uma expressão matemática (contém operadores ou parênteses)
 */
export function isMathExpression(str) {
  if (!str) return false
  const s = String(str).trim()
  return /[+\-*/()]/.test(s)
}
