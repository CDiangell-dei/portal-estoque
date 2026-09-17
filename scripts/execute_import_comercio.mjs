import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wpwerdaiqyfhfhhioosp.supabase.co'
const SUPABASE_KEY = 'sb_publishable_BGgecij1uLNAr-2XWMTPCA_y8_lT9Go'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function run() {
  console.log('Concatenando partes do CSV...')
  const p1 = fs.readFileSync(path.resolve('scripts/saldo_comercio_part1.csv'), 'utf8')
  const p2 = fs.readFileSync(path.resolve('scripts/saldo_comercio_part2.csv'), 'utf8')
  const p3 = fs.readFileSync(path.resolve('scripts/saldo_comercio_part3.csv'), 'utf8')

  const allText = p1 + '\n' + p2 + '\n' + p3
  const lines = allText.split(/\r\n|\n/).map(l => l.trim()).filter(Boolean)

  console.log(`Total de linhas lidas: ${lines.length}`)

  // Primeira linha é header: filial;produto;armazem;quantidade;custo_unitario
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';')
    if (parts.length < 4) continue

    const filial = String(parts[0]).trim().padStart(2, '0')
    let produto = String(parts[1]).trim().toUpperCase()
    const armazem = String(parts[2]).trim().padStart(2, '0')
    const rawQtd = String(parts[3]).trim().replace(/\./g, '').replace(',', '.')
    const quantidade = parseFloat(rawQtd) || 0

    let custo_unitario = null
    if (parts[4]) {
      const rawCusto = String(parts[4]).trim().replace('R$', '').trim().replace(/\./g, '').replace(',', '.')
      const parsedCusto = parseFloat(rawCusto)
      if (!isNaN(parsedCusto)) custo_unitario = parsedCusto
    }

    if (/^\d+$/.test(produto) && produto.length < 8) {
      produto = produto.padStart(8, '0')
    }

    if (!produto || Math.abs(quantidade) < 0.0001) continue

    rows.push({
      filial,
      produto,
      armazem,
      quantidade,
      custo_unitario,
      endereco: ''
    })
  }

  console.log(`Itens válidos com saldo ativo: ${rows.length}`)

  // 1. Limpar saldo_comercio via RPC clear_saldo_table
  console.log('Chamando RPC clear_saldo_table para saldo_comercio...')
  const { error: truncErr } = await supabase.rpc('clear_saldo_table', {
    p_table: 'saldo_comercio'
  })
  if (truncErr) {
    console.error('Erro ao limpar tabela:', truncErr)
    process.exit(1)
  }
  console.log('Tabela saldo_comercio limpa com sucesso.')

  // 2. Inserir em lotes de 500
  const batchSize = 500
  let inserted = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize)
    console.log(`Inserindo lote ${i + 1} a ${i + chunk.length}...`)
    const { error: insErr } = await supabase.rpc('import_saldo_lote', {
      p_table: 'saldo_comercio',
      p_rows: chunk
    })
    if (insErr) {
      console.error('Erro no lote:', insErr)
      process.exit(1)
    }
    inserted += chunk.length
  }

  console.log(`Sucesso total! Inseridos ${inserted} itens em saldo_comercio.`)

  // 3. Consulta de conferência
  const { count, error: countErr } = await supabase
    .from('saldo_comercio')
    .select('*', { count: 'exact', head: true })

  console.log(`Contagem confirmada no banco: ${count} registros em saldo_comercio.`)
}

run().catch(console.error)
