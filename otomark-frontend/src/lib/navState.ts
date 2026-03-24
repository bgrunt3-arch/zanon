type Listener = (hidden: boolean) => void
const listeners: Listener[] = []

export function setNavHidden(hidden: boolean) {
  listeners.forEach((fn) => fn(hidden))
}

export function onNavHiddenChange(fn: Listener): () => void {
  listeners.push(fn)
  return () => {
    const i = listeners.indexOf(fn)
    if (i !== -1) listeners.splice(i, 1)
  }
}
