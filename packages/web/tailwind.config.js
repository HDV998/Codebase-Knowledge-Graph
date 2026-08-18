/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#090d16',
        surface: '#111726',
        'surface-highlight': '#1b2438',
        border: '#232f48',
        primary: {
          DEFAULT: '#38bdf8',
          hover: '#0ea5e9',
        },
        node: {
          file: '#38bdf8',       // Sky Blue
          function: '#fbbf24',   // Amber
          class: '#c084fc',      // Purple
          test: '#34d399',       // Emerald
          module: '#a3e635',     // Lime
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', filter: 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.6))' },
          '50%': { opacity: '.6', filter: 'drop-shadow(0 0 2px rgba(56, 189, 248, 0.2))' },
        }
      }
    },
  },
  plugins: [],
}
