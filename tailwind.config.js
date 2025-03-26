/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          lighter: '#8FD99F',
          light: '#6FCF7F',
          DEFAULT: '#4CAF50',
          dark: '#45a049',
          darker: '#3d8b40'
        },
        secondary: {
          light: '#64B5F6',
          DEFAULT: '#2196F3',
          dark: '#1976D2'
        },
        accent: {
          light: '#FFD54F',
          DEFAULT: '#FFC107',
          dark: '#FFA000'
        },
        danger: {
          light: '#FF8A80',
          DEFAULT: '#FF5252',
          dark: '#D50000'
        }
      },
      boxShadow: {
        'custom': '0 4px 8px rgba(0, 0, 0, 0.1)',
        'custom-hover': '0 6px 12px rgba(0, 0, 0, 0.15)',
        'custom-md': '0 6px 16px rgba(0, 0, 0, 0.12)',
        'custom-lg': '0 12px 28px rgba(0, 0, 0, 0.15)',
        'custom-inner': 'inset 0 2px 4px rgba(0, 0, 0, 0.05)'
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite'
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem'
      },
      transitionDuration: {
        '400': '400ms'
      }
    },
  },
  plugins: [],
}