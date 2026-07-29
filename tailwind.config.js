/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0B1F3A',
          50:  '#E7ECF3',
          100: '#C2D0E2',
          200: '#8AA5C4',
          300: '#5379A6',
          400: '#2B5088',
          500: '#0B1F3A',
          600: '#091830',
          700: '#071226',
          800: '#040C1A',
          900: '#02060D',
        },
        accent: {
          DEFAULT: '#1DBF73',
          50:  '#E4F9EF',
          100: '#BBF0D5',
          200: '#77E1AB',
          300: '#33D281',
          400: '#1DBF73',
          500: '#18A060',
          600: '#13804D',
          700: '#0E5F39',
          800: '#094026',
          900: '#042013',
        },
        warning: '#FF9500',
        danger:  '#FF3B30',
        info:    '#007AFF',
      },
      fontFamily: {
        sans:   ['Inter',  'system-ui', 'sans-serif'],
        arabic: ['Cairo',  'Inter',     'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'ping-slow':   'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
}
