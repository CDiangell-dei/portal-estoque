import React, { useState } from 'react'
import { Warehouse, Lock, User, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const [matricula, setMatricula] = useState('')
  const [senha, setSenha] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    if (!matricula || !senha) {
      setErrorMsg('Informe sua matrícula e senha.')
      return
    }

    setLoading(true)
    try {
      await login(matricula, senha)
    } catch (err) {
      setErrorMsg(err.message || 'Falha ao autenticar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#002f6c] to-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-950/20 mx-auto">
            <Warehouse className="w-8 h-8 text-amber-300" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            AMAZON AÇO
          </h2>
          <p className="text-xs font-bold text-slate-400">
            Portal de Controle & Inventário Rotativo
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex items-center gap-2 text-rose-800 dark:text-rose-200 text-xs font-bold">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Matrícula */}
          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Matrícula
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="number"
                required
                autoFocus
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                placeholder="Digite sua matrícula"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 pl-10 pr-4 text-xs font-black text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#002f6c]"
              />
            </div>
          </div>

          {/* Senha */}
          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 pl-10 pr-10 text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#002f6c]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#002f6c] to-blue-700 hover:from-[#002555] hover:to-blue-800 text-white font-black text-xs py-3.5 rounded-2xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer touch-active disabled:opacity-50"
          >
            <LogIn className="w-4 h-4 text-amber-300" />
            <span>{loading ? 'Verificando...' : 'Acessar Sistema'}</span>
          </button>

        </form>

        <p className="text-[11px] text-center text-slate-400">
          Acesso restrito aos colaboradores autorizados da Amazon Aço.
        </p>

      </div>
    </div>
  )
}
