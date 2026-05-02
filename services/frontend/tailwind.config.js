export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#0f172a', light: '#1e293b' },
        accent: '#3b82f6',
        gain: '#22c55e',
        loss: '#ef4444',
      },
    },
  },
  plugins: [],
}
