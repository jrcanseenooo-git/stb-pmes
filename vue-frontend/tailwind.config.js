/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#e8eef4',
          100: '#c5d5e6',
          500: '#1e3f61',
          700: '#152d47',
          900: '#0D2137'
        },
        brand: {
          50:  '#EBF4FF',
          100: '#BFDBFE',
          500: '#2F80ED',
          600: '#1a6cd4',
          700: '#1558b0'
        }
      },
      fontFamily: {
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui'],
        mono: ['DM Mono', 'ui-monospace']
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms')
  ]
}
