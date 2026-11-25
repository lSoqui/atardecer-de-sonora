import { makeColors } from './make-colors.js'

// Colores de la app: un tema oscuro de ciruela y crema, hecho para leerse sobre el cielo.
export const { theme, problems } = makeColors({
  label: 'Atardecer de Sonora',
  only: 'dark',
  roles: {
    accent: '#ff9a4d',
    danger: '#e5604f',
    success: '#8fbf6a',
    warning: '#f0b040',
    pro: '#b985e0',
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#1c1123',
        'surface-1': '#231629',
        'surface-2': '#291a32',
        'surface-3': '#2e1e38',
        'text-primary': '#fff1de',
        'text-secondary': '#f0d6c0',
        'text-muted': '#cdb0a2',
      },
    },
  },
})
