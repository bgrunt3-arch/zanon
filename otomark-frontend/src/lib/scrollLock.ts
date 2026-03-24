let locked = false
let timer: ReturnType<typeof setTimeout> | null = null
const callbacks: (() => void)[] = []

/** スクロール検知を ms の間ロックし、登録済みコールバック（ナビ表示リセット）を呼ぶ */
export function lockScroll(ms = 300) {
  locked = true
  callbacks.forEach((cb) => cb())
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    locked = false
  }, ms)
}

export function isScrollLocked() {
  return locked
}

/** ロック時に呼び出すコールバックを登録。戻り値で解除できる */
export function onScrollLock(cb: () => void): () => void {
  callbacks.push(cb)
  return () => {
    const i = callbacks.indexOf(cb)
    if (i !== -1) callbacks.splice(i, 1)
  }
}
