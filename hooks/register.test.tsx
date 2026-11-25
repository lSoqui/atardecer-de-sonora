import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const BACKDROP = {
  plugin: 'atardecer-de-sonora',
  component: 'Backdrop',
  requestId: 'backdrop',
  props: {
    scene: 'sonora',
    plugin: 'atardecer-de-sonora',
    glass: { blur: 18, tint: '#1c1123', opacity: 0.7 },
  },
} as const

const sunOf = (source: string) => Number(/<g id="sun" transform="translate\(\d+ ([\d.]+)\)/.exec(source)?.[1])

// Nada hay debajo del mod: estos hooks hacen de motor.
function engine(on: Parameters<TestBody>[1], now: () => number) {
  on('clock.now', () => ({ value: now() }))
  on('command.register', () => ({ value: { command: 'atardecer' } }))
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'backdrop' } }))
  on('session.messages', () => ({ value: [] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
}

test('el cielo sigue la lista de tareas de la sesión', async ($, on) => {
  const clock = { now: 1_700_000_000_000 }
  engine(on, () => clock.now)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  async function sky(surface: 'desktop' | 'mobile' = 'desktop') {
    const ui = await $.ui.mount({ ...BACKDROP, surface })
    const svg = await ui.find({ type: 'Svg' })
    await ui.unmount()

    return String(svg?.props.source)
  }
  const calm = await sky()
  expect(calm).toMatch(/^<svg /)

  // Un plan de tres pasos: al empezar, el sol está más alto que en la calma.
  await $.tool.call({
    tool: 'mcp__ccd_turn__update_plan',
    items: [
      { content: 'a', status: 'in_progress' },
      { content: 'b', status: 'pending' },
      { content: 'c', status: 'pending' },
    ],
  })
  const start = await sky()
  expect(sunOf(start)).toBeLessThan(sunOf(calm))

  // Con cada paso hecho, el sol baja, y el cambio se ve como una transición.
  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', advance: true })
  const one = await sky()
  expect(sunOf(one)).toBeGreaterThan(sunOf(start))
  expect(one).toContain('@keyframes sus')

  // Pasado el tiempo del cambio, el cielo queda quieto en su sitio.
  clock.now += 60_000
  expect(await sky()).not.toContain('@keyframes sus')

  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', advance: true })
  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', advance: true })
  const all = await sky()
  expect(sunOf(all)).toBeGreaterThan(sunOf(one))
  expect(all).toContain('class="s ')
})

test('una herramienta que no es de tareas no mueve el cielo', async ($, on) => {
  engine(on, () => 1_700_000_000_000)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const before = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  const calm = String((await before.find({ type: 'Svg' }))?.props.source)
  await before.unmount()

  await $.tool.call({ tool: 'Bash', command: 'ls' })
  const after = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  expect(String((await after.find({ type: 'Svg' }))?.props.source)).toBe(calm)
  await after.unmount()
})

test('el tema se dibuja en la app de escritorio y en el móvil', async ($, on) => {
  engine(on, () => 1_700_000_000_000)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BACKDROP, surface })
    expect((await ui.find({ type: 'Svg' }))?.type).toBe('Svg')
    await ui.unmount()
  }
})
