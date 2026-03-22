type ToastType = 'success' | 'error' | 'info'

type ToastEvent = {
  id: number
  type: ToastType
  message: string
  href?: string
}

type ToastListener = (event: ToastEvent) => void

let nextId = 1
const listeners: ToastListener[] = []

function emit(type: ToastType, message: string, options?: { href?: string }) {
  const event: ToastEvent = { id: nextId++, type, message, href: options?.href }
  listeners.forEach(fn => fn(event))
}

export const toast = {
  success: (message: string, options?: { href?: string }) => emit('success', message, options),
  error:   (message: string, options?: { href?: string }) => emit('error', message, options),
  info:    (message: string, options?: { href?: string }) => emit('info', message, options),
}

export function subscribeToast(listener: ToastListener): () => void {
  listeners.push(listener)
  return () => {
    const idx = listeners.indexOf(listener)
    if (idx !== -1) listeners.splice(idx, 1)
  }
}

export type { ToastEvent, ToastType }
