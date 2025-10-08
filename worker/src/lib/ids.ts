
export function rid(prefix = ''): string {
  const r = crypto.getRandomValues(new Uint8Array(8))
  const id = Array.from(r).map(b => b.toString(16).padStart(2, '0')).join('')
  return prefix ? `${prefix}${id}` : id
}
