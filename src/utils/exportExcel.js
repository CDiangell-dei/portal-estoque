import * as XLSX from 'xlsx'

export function exportInventarioExcel(items, sector = 'COMERCIO') {
  if (!items || items.length === 0) {
    alert('Nenhum dado para exportar.')
    return
  }

  const exportData = items.map(item => ({
    "Código": item.codigo,
    "Descrição": item.descricao,
    "Unidade": item.unidade,
    "Endereço": item.endereco || '',
    "Saldo Sistema": item.quantidade,
    "Qtd Contada": item.hasCount ? item.qtd_contada : "",
    "Divergência": item.hasCount ? item.divergencia : "",
    "Status": item.status,
    "Tags": item.tags || '',
    "Fornecedores": item.fornecedores || '',
    "Fator Conv.": item.fatorConv || 1
  }))

  const ws = XLSX.utils.json_to_sheet(exportData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Inventário")

  const today = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `Inventario_${sector}_${today}.xlsx`)
}