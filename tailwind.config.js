/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
        DEFAULT: '#17324D',
          50: '#E8EDF5',
          100: '#C5D0E6',
          200: '#8FA4CC',
          300: '#5977B2',
          400: '#2D4D96',
          500: '#0F2044',
          600: '#0B1A36',
          700: '#081428',
          800: '#050D1A',
          900: '#02060D',
        },
        accent: {
        DEFAULT: '#E4B56B',
          50: '#E0FFF3',
          100: '#B3FFE3',
          200: '#66FFD0',
          300: '#00FFB0',
          400: '#00D97E',
          500: '#00B366',
          600: '#008C50',
          700: '#006639',
          800: '#004023',
          900: '#00190D',
        },
        warning: '#FF9500',
        danger: '#FF3B30',
        info: '#007AFF',
      },
      fontFamily: {
        sans: ['Cairo', 'system-ui', 'sans-serif'],
        arabic: ['Cairo', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
}
