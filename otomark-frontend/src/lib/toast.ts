type ToastType = 'success' | 'error' | 'info'

type ToastEvent = {
  id: number
  type: ToastType
  message: string
}

type ToastListener = (event: ToastEvent) => void

let nextId = 1
const listeners: ToastListener[] = []

function emit(type: ToastType, message: string) {
  const event: ToastEvent = { id: nextId++, type, message }
  listeners.forEach(fn => fn(event))
}

export const toast = {
  success: (message: string) => emit('success', message),
  error:   (message: string) => emit('error', message),
  info:    (message: string) => emit('info', message),
}

export function subscribeToast(listener: ToastListener): () => void {
  listeners.push(listener)
  return () => {
    const idx = listeners.indexOf(listener)
    if (idx !== -1) listeners.splice(idx, 1)
  }
}

export type { ToastEvent, ToastType }
