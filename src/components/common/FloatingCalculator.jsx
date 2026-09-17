import React, { useState } from 'react'
import { Calculator, X, Copy, Check, RotateCcw } from 'lucide-react'
import { parseSmartMathExpression } from '../../utils/mathParser'

export default function FloatingCalculator({ isOpen, onClose }) {
  const [expression, setExpression] = useState('')
  const [history, setHistory] = useState([])
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const liveResult = parseSmartMathExpression(expression)

  const handleKeyPress = (char) => {
    if (char === 'C') {
      setExpression('')
    } else if (char === 'BACKSPACE') {
      setExpression(prev => prev.slice(0, -1))
    } else if (char === '=') {
      handleCalculate()
    } else {
      setExpression(prev => prev + char)
    }
  }

  const handleCalculate = () => {
    if (!expression.trim()) return
    const res = parseSmartMathExpression(expression)
    if (res !== null && !isNaN(res)) {
      setHistory(prev => [{ expr: expression, res }, ...prev].slice(0, 5))
      setExpression(String(res))
    }
  }

  const handleCopy = () => {
    const textToCopy = liveResult !== null ? String(liveResult) : expression
    if (!textToCopy) return
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-3xl border border-slate-800 shadow-2xl p-4 w-full max-w-xs sm:max-w-sm space-y-3">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-300">
                Calculadora do Almoxarifado
              </h3>
              <p className="text-[10px] text-slate-400">Contagem de peças, fardos e pesos</p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Visor Display */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex flex-col items-end justify-center min-h-[58px]">
          <div className="text-xs font-mono text-slate-400 truncate w-full text-right">
            {expression || '0'}
          </div>
          <div className="text-lg font-black font-mono text-emerald-400 flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-slate-500">=</span>
            <span>{liveResult !== null ? liveResult.toLocaleString('pt-BR') : '---'}</span>
          </div>
        </div>

        {/* Teclado da Calculadora */}
        <div className="grid grid-cols-4 gap-1.5 font-bold text-xs select-none">
          <button type="button" onClick={() => handleKeyPress('(')} className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2.5 rounded-xl font-black active:scale-95">(</button>
          <button type="button" onClick={() => handleKeyPress(')')} className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2.5 rounded-xl font-black active:scale-95">)</button>
          <button type="button" onClick={() => handleKeyPress('C')} className="bg-rose-900/80 hover:bg-rose-800 text-rose-200 p-2.5 rounded-xl font-black active:scale-95">C</button>
          <button type="button" onClick={() => handleKeyPress('BACKSPACE')} className="bg-amber-900/80 hover:bg-amber-800 text-amber-200 p-2.5 rounded-xl font-black active:scale-95">⌫</button>

          <button type="button" onClick={() => handleKeyPress('7')} className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-xl text-sm active:scale-95">7</button>
          <button type="button" onClick={() => handleKeyPress('8')} className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-xl text-sm active:scale-95">8</button>
          <button type="button" onClick={() => handleKeyPress('9')} className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-xl text-sm active:scale-95">9</button>
          <button type="button" onClick={() => handleKeyPress('/')} className="bg-amber-900/90 hover:bg-amber-800 text-amber-200 p-2.5 rounded-xl font-black text-sm active:scale-95">÷</button>

          <button type="button" onClick={() => handleKeyPress('4')} className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-xl text-sm active:scale-95">4</button>
          <button type="button" onClick={() => handleKeyPress('5')} className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-xl text-sm active:scale-95">5</button>
          <button type="button" onClick={() => handleKeyPress('6')} className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-xl text-sm active:scale-95">6</button>
          <button type="button" onClick={() => handleKeyPress('*')} className="bg-amber-900/90 hover:bg-amber-800 text-amber-200 p-2.5 rounded-xl font-black text-sm active:scale-95">×</button>

          <button type="button" onClick={() => handleKeyPress('1')} className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-xl text-sm active:scale-95">1</button>
          <button type="button" onClick={() => handleKeyPress('2')} className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-xl text-sm active:scale-95">2</button>
          <button type="button" onClick={() => handleKeyPress('3')} className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-xl text-sm active:scale-95">3</button>
          <button type="button" onClick={() => handleKeyPress('-')} className="bg-amber-900/90 hover:bg-amber-800 text-amber-200 p-2.5 rounded-xl font-black text-sm active:scale-95">−</button>

          <button type="button" onClick={() => handleKeyPress('0')} className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-xl text-sm active:scale-95">0</button>
          <button type="button" onClick={() => handleKeyPress('.')} className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-xl text-sm active:scale-95">.</button>
          <button type="button" onClick={() => handleKeyPress('+')} className="bg-amber-900/90 hover:bg-amber-800 text-amber-200 p-2.5 rounded-xl font-black text-sm active:scale-95">+</button>
          <button type="button" onClick={() => handleKeyPress('=')} className="bg-amber-400 hover:bg-amber-300 text-slate-950 p-2.5 rounded-xl font-black text-sm active:scale-95">=</button>
        </div>

        {/* Ações inferiores e Histórico */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
          <button 
            type="button" 
            onClick={handleCopy}
            disabled={!expression}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all font-bold disabled:opacity-40"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
            <span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>

          {history.length > 0 && (
            <span className="text-[10px] text-slate-400">
              Último: <span className="font-mono text-slate-200">{history[0].expr} = {history[0].res}</span>
            </span>
          )}
        </div>

      </div>
    </div>
  )
}
