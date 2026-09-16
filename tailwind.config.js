/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        amazon: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#38bdf8',
          500: '#0284c7',
          600: '#0369a1',
          700: '#004b99',
          800: '#002f6c', // Azul Institucional Amazon Aço
          900: '#00204d',
          950: '#001433',
        },
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        }
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'elevated': '0 4px 20px -2px rgba(0, 47, 108, 0.08), 0 2px 6px -1px rgba(0, 47, 108, 0.04)',
      }
    },
  },
  plugins: [],
}
