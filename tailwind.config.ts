import type { Config } from 'tailwindcss'

export default {
  content: [
  './app/**/*.{ts,tsx}',
  './components/**/*.{ts,tsx}',
  './lib/**/*.{ts,tsx}',
],
  theme: {
    extend: {
      colors: {
        graphite: '#333333',
        chestnut: '#DC7F41',
        snow: '#FCFAF9',
        teal: '#6C9A8B',
        charcoal: '#5E5E5E',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config