import React from 'react'
import { Calculator, X, ChevronUp, Delete } from 'lucide-react'

export default function CalculatorKeypad({ 
  onKeyPress, 
  onCalculate, 
  onClose, 
  currentValue = '', 
  evaluatedValue = null,
  targetLabel = ''
}) {
  const handleKeyClick = (char) => {
    if (char === '=') {
      if (onCalculate) onCalculate()
    } else {
      if (onKeyPress) onKeyPress(char)
    }
  }

  return (
    <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-2xl p-3 shadow-2xl space-y-2 border border-slate-800 transition-all duration-200 select-none animate-in fade-in zoom-in-95 duration-150">
      
      {/* Header com título e prévia */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
          <Calculator className="w-3.5 h-3.5" />
          <span>Calculadora Inteligente</span>
        </span>
        
        <div className="flex items-center gap-2">
          {targetLabel && (
            <span className="text-[10px] font-bold text-slate-400 truncate max-w-[120px]">
              {targetLabel}
            </span>
          )}
          {onClose && (
            <button 
              type="button" 
              onClick={onClose} 
              className="text-slate-400 hover:text-white p-1 rounded-lg text-xs hover:bg-slate-800 transition-colors" 
              title="Minimizar Calculadora"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Visor / Display da Expressão e Resultado */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 flex flex-col items-end justify-center min-h-[46px]">
        <div className="text-xs font-mono text-slate-400 truncate w-full text-right tracking-wider">
          {currentValue || '0'}
        </div>
        {evaluatedValue !== null && evaluatedValue !== undefined && (
          <div className="text-sm font-black font-mono text-emerald-400 flex items-center gap-1">
            <span className="text-slate-500 text-xs">=</span>
            <span>{typeof evaluatedValue === 'number' ? evaluatedValue.toLocaleString('pt-BR') : evaluatedValue}</span>
          </div>
        )}
      </div>

      {/* Grid de Teclas */}
      <div className="grid grid-cols-4 gap-1.5 font-bold text-xs">
        {/* Linha 1: Parênteses, Limpar e Apagar */}
        <button 
          type="button" 
          onClick={() => handleKeyClick('(')} 
          className="bg-slate-800 hover:bg-slate-700 active:bg-amber-600 text-slate-200 p-2.5 rounded-xl transition-all shadow-sm font-black active:scale-95"
        >
          (
        </button>
        <button 
          type="button" 
          onClick={() => handleKeyClick(')')} 
          className="bg-slate-800 hover:bg-slate-700 active:bg-amber-600 text-slate-200 p-2.5 rounded-xl transition-all shadow-sm font-black active:scale-95"
        >
          )
        </button>
        <button 
          type="button" 
          onClick={() => handleKeyClick('C')} 
          className="bg-rose-900/80 hover:bg-rose-800 active:bg-rose-700 text-rose-200 p-2.5 rounded-xl transition-all shadow-sm font-black active:scale-95"
          title="Limpar tudo"
        >
          C
        </button>
        <button 
          type="button" 
          onClick={() => handleKeyClick('BACKSPACE')} 
          className="bg-amber-900/80 hover:bg-amber-800 active:bg-amber-700 text-amber-200 p-2.5 rounded-xl transition-all shadow-sm font-black active:scale-95 flex items-center justify-center"
          title="Apagar último dígito"
        >
          ⌫
        </button>

        {/* Linha 2: 7, 8, 9, ÷ */}
        <button 
          type="button" 
          onClick={() => handleKeyClick('7')} 
          className="bg-slate-800 hover:bg-slate-700 active:bg-amber-600 text-white p-2.5 rounded-xl transition-all shadow-sm text-sm active:scale-95"
        >
          7
        </button>
        <button 
          type="button" 
          onClick={() => handleKeyClick('8')} 
          className="bg-slate-800 hover:bg-slate-700 active:bg-amber-600 text-white p-2.5 rounded-xl transition-all shadow-sm text-sm active:scale-95"
        >
          8
        </button>
        <button 
          type="button" 
          onClick={() => handleKeyClick('9')} 
          className="bg-slate-800 hover:bg-slate-700 active:bg-amber-600 text-white p-2.5 rounded-xl transition-all shadow-sm text-sm active:scale-95"
        >
          9
        </button>
        <button 
          type="button" 
          onClick={() => handleKeyClick('/')} 
          className="bg-amber-900/90 hover:bg-amber-800 active:bg-amber-700 text-amber-200 p-2.5 rounded-xl transition-all shadow-sm font-black text-sm active:scale-95"
        >
          ÷
        </button>

        {/* Linha 3: 4, 5, 6, × */}
        <button 
          type="button" 
          onClick={() => handleKeyClick('4')} 
          className="bg-slate-800 hover:bg-slate-700 active:bg-amber-600 text-white p-2.5 rounded-xl transition-all shadow-sm text-sm active:scale-95"
        >
          4
        </button>
        <button 
          type="button" 
          onClick={() => handleKeyClick('5')} 
          className="bg-slate-800 hover:bg-slate-700 active:bg-amber-600 text-white p-2.5 rounded-xl transition-all shadow-sm text-sm active:scale-95"
        >
          5
        </button>
        <button 
          type="button" 
          onClick={() => handleKeyClick('6')} 
          className="bg-slate-800 hover:bg-slate-700 active:bg-amber-600 text-white p-2.5 rounded-xl transition-all shadow-sm text-sm active:scale-95"
        >
          6
        </button>
        <button 
          type="button" 
          onClick={() => handleKeyClick('*')} 
          className="bg-amber-900/90 hover:bg-amber-800 active:bg-amber-700 text-amber-200 p-2.5 rounded-xl transition-all shadow-sm font-black text-sm active:scale-95"
        >
          ×
        </button>

        {/* Linha 4: 1, 2, 3, − */}
        <button 
          type="button" 
          onClick={() => handleKeyClick('1')} 
          className="bg-slate-800 hover:bg-slate-700 active:bg-amber-600 text-white p-2.5 rounded-xl transition-all shadow-sm text-sm active:scale-95"
        >
          1
        </button>
        <button 
          type="button" 
          onClick={() => handleKeyClick('2')} 
          className="bg-slate-800 hover:bg-slate-700 active:bg-amber-600 text-white p-2.5 rounded-xl transition-all shadow-sm text-sm active:scale-95"
        >
          2
        </button>
        <button 
          type="button" 
          onClick={() => handleKeyClick('3')} 
          className="bg-slate-800 hover:bg-slate-700 active:bg-amber-600 text-white p-2.5 rounded-xl transition-all shadow-sm text-sm active:scale-95"
        >
          3
        </button>
        <button 
          type="button" 
          onClick={() => handleKeyClick('-')} 
          className="bg-amber-900/90 hover:bg-amber-800 active:bg-amber-700 text-amber-200 p-2.5 rounded-xl transition-all shadow-sm font-black text-sm active:scale-95"
        >
          −
        </button>

        {/* Linha 5: 0, ., +, = */}
        <button 
          type="button" 
          onClick={() => handleKeyClick('0')} 
          className="bg-slate-800 hover:bg-slate-700 active:bg-amber-600 text-white p-2.5 rounded-xl transition-all shadow-sm text-sm active:scale-95"
        >
          0
        </button>
        <button 
          type="button" 
          onClick={() => handleKeyClick('.')} 
          className="bg-slate-800 hover:bg-slate-700 active:bg-amber-600 text-white p-2.5 rounded-xl transition-all shadow-sm text-sm active:scale-95"
        >
          .
        </button>
        <button 
          type="button" 
          onClick={() => handleKeyClick('+')} 
          className="bg-amber-900/90 hover:bg-amber-800 active:bg-amber-700 text-amber-200 p-2.5 rounded-xl transition-all shadow-sm font-black text-sm active:scale-95"
        >
          +
        </button>
        <button 
          type="button" 
          onClick={() => handleKeyClick('=')} 
          className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 p-2.5 rounded-xl transition-all shadow-md font-black text-sm active:scale-95"
          title="Calcular resultado"
        >
          =
        </button>
      </div>

    </div>
  )
}
