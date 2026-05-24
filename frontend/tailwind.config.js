/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#04060f',
          900: '#0a0e1a',
          800: '#0d1225',
          700: '#111830',
          600: '#172040',
          500: '#1e2a50',
          400: '#2a3a6a',
          300: '#3d5080',
        },
        brand: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          900: '#0c4a6e',
        },
        accent: {
          cyan:   '#06b6d4',
          teal:   '#14b8a6',
          blue:   '#3b82f6',
          indigo: '#6366f1',
        },
        confidence: {
          strong:    '#22c55e',
          watch:     '#f59e0b',
          lean:      '#f97316',
          reject:    '#ef4444',
        }
      },
      backgroundImage: {
        'gradient-navy': 'linear-gradient(135deg, #0a0e1a 0%, #0d1225 100%)',
        'gradient-card': 'linear-gradient(135deg, #0f1629 0%, #111a35 100%)',
        'gradient-header': 'linear-gradient(90deg, #0a0e1a 0%, #0d1a3a 50%, #0a0e1a 100%)',
      },
    },
  },
  plugins: [],
}
