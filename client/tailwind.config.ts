import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-alt': 'rgb(var(--color-surface-alt) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        foreground: 'rgb(var(--color-text) / <alpha-value>)',
        muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'accent-foreground': 'rgb(var(--color-accent-fg) / <alpha-value>)',
        positive: 'rgb(var(--color-positive) / <alpha-value>)',
        negative: 'rgb(var(--color-negative) / <alpha-value>)',
      },
    },
  },
  plugins: [],
} satisfies Config;
