/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'neo-dark': {
          DEFAULT: '#050816',
          secondary: '#0B1020',
          card: '#0f172a',
          border: 'rgba(255,255,255,0.08)',
        },
        'neo-cyan': '#06b6d4',
        'neo-violet': '#7c3aed',
        'neo-pink': '#ec4899',
        'neo-text': {
          primary: '#f1f5f9',
          secondary: '#94a3b8',
          muted: '#475569',
        },
      },
      screens: {
        '3xl': '1920px',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'var(--font-jakarta)', 'sans-serif'],
        outfit: ['Outfit', 'var(--font-outfit)', 'sans-serif'],
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px #06b6d4, 0 0 10px #06b6d4' },
          '50%': { boxShadow: '0 0 20px #06b6d4, 0 0 40px #06b6d4, 0 0 60px #06b6d4' },
        },
        glowPulse: {
          '0%, 100%': { textShadow: '0 0 4px #06b6d4, 0 0 8px #06b6d4' },
          '50%': { textShadow: '0 0 12px #06b6d4, 0 0 24px #06b6d4, 0 0 36px #06b6d4' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s linear infinite',
        fadeIn: 'fadeIn 0.6s ease-out forwards',
        slideUp: 'slideUp 0.7s ease-out forwards',
        glow: 'glow 2s ease-in-out infinite',
        glowPulse: 'glowPulse 2s ease-in-out infinite',
        scaleIn: 'scaleIn 0.3s ease-out forwards',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'neo-gradient': 'linear-gradient(135deg, #06b6d4, #7c3aed)',
        'neo-gradient-pink': 'linear-gradient(135deg, #7c3aed, #ec4899)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
