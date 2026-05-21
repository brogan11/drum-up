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
      animation: {
        shimmer: 'shimmer 1.5s infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config