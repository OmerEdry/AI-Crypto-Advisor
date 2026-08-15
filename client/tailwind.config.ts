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
      // Preflight sets `border-color` on every element from this key, and its default is
      // Tailwind's own gray-200 — a pale line on a near-black surface, arriving from the
      // framework rather than from any file here. Deliberately without <alpha-value>: preflight
      // substitutes this string into static CSS, where the placeholder would survive into an
      // invalid declaration. The named `border` colour above keeps its alpha form.
      borderColor: { DEFAULT: 'rgb(var(--color-border))' },
      // A named key, never DEFAULT: DEFAULT would redefine every bare `rounded` in the project,
      // including ones nobody has written yet.
      borderRadius: { surface: 'var(--radius)' },
    },
  },
  plugins: [],
} satisfies Config;
