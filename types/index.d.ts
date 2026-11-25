export type SonoraStatus = 'pending' | 'in_progress' | 'completed'

export type SonoraItem = { id: string; status: SonoraStatus }

// La lista de tareas que el mod ve pasar: de dónde viene y cómo va cada una.
export type SonoraTasks = {
  source: 'todo' | 'task' | 'plan' | null
  list: SonoraItem[]
}

// Hacia dónde se mueve el cielo: `from` y `to` van de 0 (sol alto, dorado) a 1
// (atardecer completo con estrellas); `at` es la hora (ms) en que empezó el cambio.
export type SonoraSky = { from: number; to: number; at: number }

declare module 'claude-code' {
  interface PluginState {
    'atardecer-de-sonora': {
      tasks: Shaped<SonoraTasks>
      sky: Shaped<SonoraSky>
      isOff: boolean
    }
  }
}
