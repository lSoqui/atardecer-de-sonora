import type { SonoraItem, SonoraSky, SonoraStatus, SonoraTasks } from '../types'

// Lógica pura de «Atardecer de Sonora»: cómo se lee la lista de tareas de la
// sesión y cuánto debe haber avanzado el atardecer. No toca el motor.

// Sin lista de tareas: un atardecer tranquilo (sol cerca del horizonte, sin estrellas).
export const CALM = 0.6

// Lo que tarda el cielo en pasar de un momento al siguiente.
export const SHIFT_MS = 7000

export const EMPTY_TASKS: SonoraTasks = { source: null, list: [] }

export const CALM_SKY: SonoraSky = { from: CALM, to: CALM, at: 0 }

export type Call = {
  tool: string
  input: Record<string, unknown>
  result?: unknown
  text?: string
  isError?: boolean
}

function statusOf(value: unknown): SonoraStatus {
  return value === 'completed' || value === 'in_progress' ? value : 'pending'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function idOfCreated(call: Call): string | undefined {
  const task = isRecord(call.result) ? call.result.task : undefined

  if (isRecord(task) && (typeof task.id === 'string' || typeof task.id === 'number')) {
    return String(task.id)
  }
  const found = /#(\d+)/.exec(call.text ?? '')

  return found?.[1]
}

// Al terminar el turno la app marca la última tarea del plan como hecha.
export function settle(list: SonoraItem[]): SonoraItem[] {
  const last = list[list.length - 1]

  if (
    last !== undefined &&
    last.status === 'in_progress' &&
    list.slice(0, -1).every(item => item.status === 'completed')
  ) {
    return [...list.slice(0, -1), { ...last, status: 'completed' }]
  }

  return list
}

function applyPlan(prev: SonoraTasks, input: Record<string, unknown>): SonoraTasks | null {
  if (Array.isArray(input.items)) {
    const list = input.items.map((item, index) => ({
      id: `p${index + 1}`,
      status: statusOf(isRecord(item) ? item.status : undefined),
    }))

    return { source: 'plan', list }
  }

  if (prev.source !== 'plan' || prev.list.length === 0) {
    return null
  }
  let list = prev.list.map(item => ({ ...item }))

  if (input.advance === true) {
    list = list.map(item => (item.status === 'in_progress' ? { ...item, status: 'completed' } : item))
    const next = list.findIndex(item => item.status === 'pending')

    if (next >= 0) {
      list = list.map((item, index) => (index === next ? { ...item, status: 'in_progress' } : item))
    }
  }

  if (Array.isArray(input.done)) {
    const done = input.done.filter((n): n is number => typeof n === 'number')
    list = list.map((item, index) => (done.includes(index + 1) ? { ...item, status: 'completed' } : item))
  }

  if (typeof input.start === 'number') {
    const start = input.start
    list = list.map((item, index) => (index + 1 === start ? { ...item, status: 'in_progress' } : item))
  }

  return { source: 'plan', list }
}

// Qué cambia en la lista cuando pasa esta llamada; null si no la toca.
export function applyCall(prev: SonoraTasks, call: Call): SonoraTasks | null {
  if (call.isError === true) {
    return null
  }

  switch (call.tool) {
    case 'TodoWrite': {
      if (!Array.isArray(call.input.todos)) {
        return null
      }
      const list = call.input.todos.map((todo, index) => ({
        id: `t${index + 1}`,
        status: statusOf(isRecord(todo) ? todo.status : undefined),
      }))

      return { source: 'todo', list }
    }

    case 'TaskCreate': {
      const base = prev.source === 'task' ? prev.list : []
      const id = idOfCreated(call) ?? `n${base.length + 1}`

      if (base.some(item => item.id === id)) {
        return null
      }

      return { source: 'task', list: [...base, { id, status: 'pending' }] }
    }

    case 'TaskUpdate': {
      const id = call.input.taskId === undefined ? undefined : String(call.input.taskId)
      const status = call.input.status

      if (id === undefined) {
        return null
      }
      const base = prev.source === 'task' ? prev.list : []

      if (status === 'deleted') {
        return base.some(item => item.id === id)
          ? { source: 'task', list: base.filter(item => item.id !== id) }
          : null
      }

      if (status !== 'pending' && status !== 'in_progress' && status !== 'completed') {
        return null
      }

      if (base.some(item => item.id === id)) {
        return {
          source: 'task',
          list: base.map(item => (item.id === id ? { ...item, status } : item)),
        }
      }

      // Una tarea que el mod no vio nacer (la creó un subagente, por ejemplo).
      return { source: 'task', list: [...base, { id, status }] }
    }

    case 'mcp__ccd_turn__update_plan':
      return applyPlan(prev, call.input)

    default:
      return null
  }
}

// A dónde apunta el cielo: 0 sin ninguna tarea hecha, 1 con todas hechas.
export function targetOf(list: SonoraItem[]): number {
  if (list.length === 0) {
    return CALM
  }
  const done = list.filter(item => item.status === 'completed').length

  return done / list.length
}

function ease(k: number): number {
  return k * k * (3 - 2 * k)
}

// Dónde va el cielo ahora mismo, a mitad de un cambio.
export function valueAt(sky: SonoraSky, now: number): number {
  const k = Math.min(1, Math.max(0, (now - sky.at) / SHIFT_MS))

  return sky.from + (sky.to - sky.from) * ease(k)
}

// El cielo hacia un nuevo destino, partiendo de donde estaba.
export function retarget(sky: SonoraSky, to: number, now: number): SonoraSky {
  return { from: valueAt(sky, now), to, at: now }
}

// El cielo ya puesto, sin movimiento (al cargar o recargar el mod).
export function settled(to: number): SonoraSky {
  return { from: to, to, at: 0 }
}
