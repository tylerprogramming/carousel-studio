/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        border:     'hsl(var(--border))',
        input:      'hsl(var(--input))',
        ring:       'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary:    { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary:  { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive:{ DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted:      { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent:     { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        card:       { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        coral: { DEFAULT: 'hsl(16 65% 61%)', light: 'hsl(16 65% 97%)', dark: 'hsl(16 65% 50%)' },
      },
      borderRadius: {
        lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)', '2xl': 'calc(var(--radius) + 8px)',
      },
      boxShadow: {
        soft:  '0 1px 2px 0 hsl(20 14% 4% / 0.05)',
        card:  '0 1px 3px 0 hsl(20 14% 4% / 0.08), 0 1px 2px -1px hsl(20 14% 4% / 0.06)',
        modal: '0 20px 60px -8px hsl(20 14% 4% / 0.18), 0 0 0 1px hsl(24 6% 88%)',
        phone: '0 0 0 1.5px #2a2a2a, 0 28px 72px hsl(20 14% 4% / 0.28), inset 0 0 0 1px hsl(0 0% 100% / 0.06)',
      },
    },
  },
  plugins: [],
}
