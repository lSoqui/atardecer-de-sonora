import { expect, test } from 'claude-code/testing'

import { problems, theme } from './palette'

test('la app acepta los colores del tema', () => {
  // Una línea que empieza así hace que la app ignore el tema entero.
  expect(problems.filter(line => line.startsWith("Desktop won't paint"))).toEqual([])
  expect(Object.keys(theme).length).toBeGreaterThan(0)
})

test('el texto se lee: nada de los avisos de contraste toca al texto principal', () => {
  expect(problems.filter(line => line.startsWith('text-primary') || line.startsWith('text-secondary'))).toEqual([])
})
