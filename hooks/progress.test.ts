import { expect, test } from 'claude-code/testing'

import { CALM, EMPTY_TASKS, SHIFT_MS, applyCall, retarget, settle, settled, targetOf, valueAt } from './progress'
import type { Call } from './progress'

const call = (tool: string, input: Record<string, unknown>, extra: Partial<Call> = {}): Call => ({
  tool,
  input,
  ...extra,
})

test('sin lista de tareas el atardecer se queda tranquilo', () => {
  expect(targetOf([])).toBe(CALM)
  expect(applyCall(EMPTY_TASKS, call('Read', { file_path: 'a' }))).toBe(null)
})

test('TodoWrite: cada tarea hecha acerca el atardecer', () => {
  const todos = (done: number) =>
    call('TodoWrite', {
      todos: [0, 1, 2, 3].map(i => ({
        content: `t${i}`,
        activeForm: `t${i}`,
        status: i < done ? 'completed' : i === done ? 'in_progress' : 'pending',
      })),
    })

  const start = applyCall(EMPTY_TASKS, todos(0))
  expect(start?.source).toBe('todo')
  expect(targetOf(start?.list ?? [])).toBe(0)

  expect(targetOf(applyCall(EMPTY_TASKS, todos(1))?.list ?? [])).toBe(0.25)
  expect(targetOf(applyCall(EMPTY_TASKS, todos(3))?.list ?? [])).toBe(0.75)
  expect(targetOf(applyCall(EMPTY_TASKS, todos(4))?.list ?? [])).toBe(1)
})

test('TaskCreate y TaskUpdate llevan la cuenta, también los borrados', () => {
  let board = EMPTY_TASKS

  for (const id of ['1', '2', '3']) {
    const next = applyCall(board, call('TaskCreate', { subject: id }, { result: { task: { id, subject: id } } }))
    board = next ?? board
  }
  expect(board.list).toHaveLength(3)
  expect(targetOf(board.list)).toBe(0)

  board = applyCall(board, call('TaskUpdate', { taskId: '1', status: 'completed' })) ?? board
  expect(targetOf(board.list)).toBe(1 / 3)

  board = applyCall(board, call('TaskUpdate', { taskId: '3', status: 'deleted' })) ?? board
  expect(board.list).toHaveLength(2)
  expect(targetOf(board.list)).toBe(0.5)

  board = applyCall(board, call('TaskUpdate', { taskId: '2', status: 'completed' })) ?? board
  expect(targetOf(board.list)).toBe(1)

  // Una llamada que falló no cambia nada.
  expect(applyCall(board, call('TaskUpdate', { taskId: '2', status: 'pending' }, { isError: true }))).toBe(null)
})

test('update_plan: items, advance, done y start, y el cierre del turno', () => {
  const plan = applyCall(
    EMPTY_TASKS,
    call('mcp__ccd_turn__update_plan', {
      items: [
        { content: 'a', status: 'in_progress' },
        { content: 'b', status: 'pending' },
        { content: 'c', status: 'pending' },
      ],
      scope: 'first_task',
    }),
  )
  expect(plan?.source).toBe('plan')
  expect(targetOf(plan?.list ?? [])).toBe(0)

  const advanced = applyCall(plan ?? EMPTY_TASKS, call('mcp__ccd_turn__update_plan', { advance: true }))
  expect(advanced?.list.map(item => item.status)).toEqual(['completed', 'in_progress', 'pending'])

  const out = applyCall(advanced ?? EMPTY_TASKS, call('mcp__ccd_turn__update_plan', { done: [2], start: 3 }))
  expect(out?.list.map(item => item.status)).toEqual(['completed', 'completed', 'in_progress'])
  expect(targetOf(out?.list ?? [])).toBeLessThan(1)

  // Al terminar el turno la app marca la última; con otras sin hacer, no.
  expect(targetOf(settle(out?.list ?? []))).toBe(1)
  expect(settle(advanced?.list ?? []).map(item => item.status)).toEqual(['completed', 'in_progress', 'pending'])

  // Sin un plan en marcha, `advance` no inventa nada.
  expect(applyCall(EMPTY_TASKS, call('mcp__ccd_turn__update_plan', { advance: true }))).toBe(null)
})

test('un cambio a medias parte de donde iba el cielo', () => {
  const first = retarget(settled(0), 0.5, 1000)
  expect(first.from).toBe(0)
  expect(valueAt(first, 1000)).toBe(0)
  expect(valueAt(first, 1000 + SHIFT_MS)).toBe(0.5)

  const midway = valueAt(first, 1000 + SHIFT_MS / 2)
  expect(midway).toBeGreaterThan(0.2)
  expect(midway).toBeLessThan(0.3)

  const second = retarget(first, 1, 1000 + SHIFT_MS / 2)
  expect(second.from).toBe(midway)
  expect(second.to).toBe(1)
})
