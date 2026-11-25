import { expect, test } from 'claude-code/testing'

import { buildScene } from './scene'

const still = (t: number) => buildScene({ from: t, to: t, elapsedMs: 1e9, nowMs: 1_700_000_000_000 })

test('la escena cabe en el límite y no lleva nada que el motor rechace', () => {
  for (const t of [0, 0.25, 0.6, 0.85, 1]) {
    const svg = still(t)

    expect(svg.length).toBeLessThan(131072)
    expect(svg).toMatch(/^<svg /)
    expect(svg).not.toMatch(/<!--|<image|href|CDATA|&|<script|<foreignObject|<filter|@font-face|url\(['"]?(http|data)/)
  }
})

test('las estrellas sólo salen cuando el atardecer está completo', () => {
  expect(still(0)).not.toContain('class="s ')
  expect(still(0.6)).not.toContain('class="s ')
  expect(still(1)).toContain('class="s ')
})

test('las nubes se mueven despacio y respetan el movimiento reducido', () => {
  const svg = still(0.6)

  expect(svg).toContain('@keyframes d0')
  expect(svg).toContain('prefers-reduced-motion:reduce')

  // Cada nube dura más de cinco minutos en cruzar.
  const durations = [...svg.matchAll(/#c\d\{animation:d\d (\d+)s linear/g)].map(m => Number(m[1]))
  expect(durations).toHaveLength(7)

  for (const seconds of durations) {
    expect(seconds).toBeGreaterThan(300)
  }
})

test('las nubes siguen el reloj: redibujar no las hace saltar', () => {
  const at = (nowMs: number) => buildScene({ from: 0.6, to: 0.6, elapsedMs: 1e9, nowMs })
  const delay = (svg: string) => Number(/#c0\{animation:d0 \d+s linear (-?[\d.]+)s/.exec(svg)?.[1])

  // Diez segundos después, la nube lleva diez segundos más de camino.
  expect(Math.abs(delay(at(10_000)) - delay(at(0)) + 10)).toBeLessThan(0.1)
})

test('un cambio en marcha trae su transición y uno terminado no', () => {
  const moving = buildScene({ from: 0.3, to: 0.5, elapsedMs: 2000, nowMs: 5000 })
  const done = buildScene({ from: 0.3, to: 0.5, elapsedMs: 8000, nowMs: 5000 })
  const same = buildScene({ from: 0.5, to: 0.5, elapsedMs: 100, nowMs: 5000 })

  expect(moving).toContain('@keyframes sus')
  expect(moving).toMatch(/#sun\{animation:sus 7s [^ ]+ -2s/)
  expect(done).not.toContain('@keyframes sus')
  expect(same).not.toContain('@keyframes sus')
})

test('el sol baja y el cielo se oscurece con el avance', () => {
  const sunY = (svg: string) => Number(/<g id="sun" transform="translate\(\d+ ([\d.]+)\)/.exec(svg)?.[1])

  expect(sunY(still(0))).toBeLessThan(sunY(still(0.5)))
  expect(sunY(still(0.5))).toBeLessThan(sunY(still(1)))
})
