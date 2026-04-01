// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Syne', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Design tokens do Chronos PM
        bg: {
          DEFAULT: '#0b0f1a',
          surface: '#111827',
          surface2: '#1a2235',
          surface3: '#222d42',
        },
        border: {
          DEFAULT: '#2a3650',
          2: '#3a4a68',
        },
        text: {
          DEFAULT: '#e8edf5',
          2: '#9aabc4',
          3: '#5a6a84',
        },
        // Status de tarefas
        status: {
          planned: '#3b82f6',
          executed: '#22c55e',
          delayed: '#ef4444',
          critical: '#f59e0b',
          milestone: '#a855f7',
          onHold: '#6b7280',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
