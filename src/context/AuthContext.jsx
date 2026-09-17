import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { isGlobalFilial } from '../utils/formatters'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sector, setSectorState] = useState(() => {
    return localStorage.getItem('amazon_selected_sector') || 'COMERCIO'
  })
  const [filial, setFilialState] = useState(() => {
    return localStorage.getItem('amazon_selected_filial') || '01'
  })
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light'
  })

  useEffect(() => {
    // Restaura sessão existente
    try {
      const raw = localStorage.getItem('amazon_user_session')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.user?.matricula) {
          setUser(parsed.user)
          if (!isGlobalFilial(parsed.user) && parsed.user.filial_atual) {
            const lockedFil = String(parsed.user.filial_atual).padStart(2, '0')
            setFilialState(lockedFil)
            localStorage.setItem('amazon_selected_filial', lockedFil)
          } else if (localStorage.getItem('amazon_selected_filial')) {
            setFilialState(localStorage.getItem('amazon_selected_filial'))
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao ler sessão salva:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  // Garante que se o usuário não for admin global, a filial seja estritamente a atrelada ao login
  useEffect(() => {
    if (user && !isGlobalFilial(user) && user.filial_atual) {
      const lockedFil = String(user.filial_atual).padStart(2, '0')
      if (filial !== lockedFil) {
        setFilialState(lockedFil)
        localStorage.setItem('amazon_selected_filial', lockedFil)
      }
    }
  }, [user, filial])

  useEffect(() => {
    // Sincroniza tema dark/light
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  const setSector = (newSector) => {
    setSectorState(newSector)
    localStorage.setItem('amazon_selected_sector', newSector)
  }

  const setFilial = (newFilial) => {
    if (!isGlobalFilial(user)) {
      // Bloqueado: usuário comum não pode trocar de filial
      const lockedFil = String(user?.filial_atual || '01').padStart(2, '0')
      setFilialState(lockedFil)
      localStorage.setItem('amazon_selected_filial', lockedFil)
      return
    }
    const pad = newFilial === 'ALL' ? 'ALL' : String(newFilial).padStart(2, '0')
    setFilialState(pad)
    localStorage.setItem('amazon_selected_filial', pad)
  }

  const login = async (matricula, senha) => {
    const matNum = parseInt(matricula, 10)
    if (isNaN(matNum) || !senha) {
      throw new Error('Matrícula e senha são obrigatórios.')
    }

    let { data, error } = await supabase.rpc('login_usuario', {
      p_matricula: matNum,
      p_senha: senha
    })

    if (error) {
      const fallback = await supabase.rpc('autenticar_usuario', {
        p_matricula: matNum,
        p_senha: senha
      })
      data = fallback.data
      error = fallback.error
    }

    if (error) {
      throw new Error(error.message || 'Falha ao autenticar usuário.')
    }

    if (!data || data.length === 0 || !data[0]?.id) {
      throw new Error('Matrícula ou senha incorretos.')
    }

    const userData = data[0]

    if (userData.status !== true) {
      throw new Error('Conta inativa ou aguardando aprovação pelo Administrador.')
    }

    setUser(userData)
    const sessionObj = {
      user: userData,
      loginTime: new Date().toISOString()
    }
    localStorage.setItem('amazon_user_session', JSON.stringify(sessionObj))
    sessionStorage.setItem('amazon_user_pwd', senha)

    // Se o usuário tiver filial atribuída e não for admin global:
    if (!isGlobalFilial(userData) && userData.filial_atual) {
      const userFilPad = String(userData.filial_atual).padStart(2, '0')
      setFilial(userFilPad)
    }

    return userData
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('amazon_user_session')
    localStorage.removeItem('amazon_user_pwd')
    sessionStorage.removeItem('amazon_user_pwd')
  }

  const isGlobal = isGlobalFilial(user)

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sector,
        setSector,
        filial,
        setFilial,
        isGlobal,
        login,
        logout,
        theme,
        toggleTheme
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
