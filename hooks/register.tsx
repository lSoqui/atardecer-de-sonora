import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeSetArgs, ThemeStyle } from 'claude-code'

import type { SonoraItem, SonoraTasks } from '../types'
import { problems, theme } from './palette'
import {
  CALM_SKY,
  EMPTY_TASKS,
  applyCall,
  retarget,
  settle,
  targetOf,
} from './progress'
import type { Call } from './progress'
import { buildScene } from './scene'

const SCENE = 'sonora'

// Lo que el mod recuerda durante la sesión (sobrevive a una recarga del código).
const tasks = atom({ plugin: 'atardecer-de-sonora', key: 'tasks' } as const, EMPTY_TASKS, {
  shape: 'tasks-1',
})
const sky = atom({ plugin: 'atardecer-de-sonora', key: 'sky' } as const, CALM_SKY, {
  shape: 'sky-1',
})
const isOff = atom({ plugin: 'atardecer-de-sonora', key: 'isOff' } as const, false)

// Paneles semitransparentes: la app los esmerila sobre el cielo, y los mensajes
// llevan un fondo casi opaco para que el texto se lea siempre.
const GLASS = { blur: 18, tint: '#1c1123', opacity: 0.7 } as const

const STYLE: ThemeStyle = {
  UserMessage: {
    color: '#fff1de',
    backgroundColor: '#4a2a52e6',
    radius: 14,
    padding: 14,
    borderColor: '#ff9a4d66',
    borderWidth: 1,
  },
  AssistantMessage: {
    color: '#fff1de',
    backgroundColor: '#1f1428e0',
    radius: 14,
    padding: 14,
  },
  ToolUse: {
    color: '#f0d6c0',
    backgroundColor: '#1f1428d9',
    radius: 8,
    paddingX: 8,
  },
}

const LOOK: ThemeSetArgs = {
  backdrop: { scene: SCENE, glass: GLASS },
  overrideColorScheme: 'dark',
  colors: theme,
}

async function paint($: EngineInterface) {
  try {
    return await $.theme.set({ ...LOOK, style: STYLE })
  } catch (error) {
    // Una app que no entiende `style`: el cielo y los colores van igual.
    $.ui.log(`atardecer-de-sonora: sin estilo de mensajes (${String(error)})`)

    return $.theme.set(LOOK)
  }
}

// Hacia dónde mover el cielo según la lista; no toca nada si ya apunta ahí.
async function aim($: EngineInterface, list: SonoraItem[], now: number) {
  const to = targetOf(list)
  const held = await read($, sky)

  if (Math.abs(held.to - to) < 0.0005) {
    return
  }
  await update($, sky, current => retarget(current, to, now))
}

// Una llamada a una herramienta de tareas ya resuelta: ¿cambió la lista?
async function follow($: EngineInterface, call: Call) {
  try {
    const now = await $.clock.now()
    const change: { tasks: SonoraTasks | null } = { tasks: null }

    await update($, tasks, held => {
      change.tasks = applyCall(held, call)

      return change.tasks ?? held
    })

    if (change.tasks !== null) {
      await aim($, change.tasks.list, now)
    }
  } catch (error) {
    $.ui.log(`atardecer-de-sonora: no pude leer la lista de tareas (${String(error)})`)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'atardecer',
      description: 'Enciende o apaga el tema Atardecer de Sonora',
      argumentHint: '[on|off]',
    })
    if (problems.some(line => line.startsWith("Desktop won't paint"))) {
      $.ui.log('atardecer-de-sonora: los colores no pasan la prueba de contraste de la app')
    }

    if (!(await read($, isOff))) {
      await paint($)
    }

    return next(e)
  })

  // Sólo las herramientas que escriben la lista de tareas; no se agrega ningún texto.
  on('tool.call', { tool: ['TodoWrite', 'TaskCreate', 'TaskUpdate', 'mcp__ccd_turn__update_plan'] }, async ($, e, next) => {
    const ran = await next(e)

    if (ran.deny === undefined && ran.isError !== true) {
      const { tool, tool_use_id: _id, agentId: _agent, ...input } = e as unknown as Record<string, unknown>

      await follow($, {
        tool: String(tool),
        input,
        result: ran.result,
        text: ran.text,
      })
    }

    return ran
  })

  // Al acabar un turno normal, la app da por hecha la última tarea del plan.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && e.reason === 'answer') {
      try {
        const held = await read($, tasks)
        const list = settle(held.list)

        if (held.source === 'plan' && list !== held.list) {
          const settledTasks: SonoraTasks = { source: 'plan', list }

          await update($, tasks, () => settledTasks)
          await aim($, list, await $.clock.now())
        }
      } catch (error) {
        $.ui.log(`atardecer-de-sonora: ${String(error)}`)
      }
    }

    return next(e)
  })

  // Tras un /clear no hay lista: el cielo vuelve a la calma.
  on('session.end', { reason: 'clear' }, async ($, e, next) => {
    try {
      await update($, tasks, () => EMPTY_TASKS)
      await aim($, [], await $.clock.now())
    } catch (error) {
      $.ui.log(`atardecer-de-sonora: ${String(error)}`)
    }

    return next(e)
  })

  on('command.run', { command: 'atardecer' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()

    if (arg === 'off' || arg === 'apagar') {
      await update($, isOff, () => true)
      await $.theme.clear()

      return {
        text: 'Atardecer de Sonora apagado: la app vuelve a su aspecto normal. Para encenderlo: /atardecer on',
        isTextDisplayOnly: true,
      }
    }

    if (arg === 'on' || arg === 'encender') {
      await update($, isOff, () => false)
      const set = await paint($)

      return {
        text: set.isDrawn
          ? 'Atardecer de Sonora encendido.'
          : `Atardecer de Sonora no se puede dibujar aquí: ${set.reason}`,
        isTextDisplayOnly: true,
      }
    }

    return {
      text: (await read($, isOff))
        ? 'Atardecer de Sonora está apagado. Para encenderlo: /atardecer on'
        : 'Atardecer de Sonora está encendido. Para apagarlo: /atardecer off',
      isTextDisplayOnly: true,
    }
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }

    if (e.props.scene !== SCENE) {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)
    const held = await read($, sky)
    const now = await $.clock.now()

    return (
      <Svg
        source={buildScene({ from: held.from, to: held.to, elapsedMs: now - held.at, nowMs: now })}
        alt="Atardecer en el desierto de Sonora: cielo dorado, naranja, rosa y morado, nubes que avanzan despacio y siluetas de saguaros"
        isInteractive
      />
    )
  })
}
