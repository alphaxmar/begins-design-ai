
import React, { useRef } from 'react'

export default function BeforeAfter({ beforeUrl, afterUrl }:{ beforeUrl: string; afterUrl: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const onMove = (e: React.MouseEvent) => {
    const box = ref.current!.getBoundingClientRect()
    const x = e.clientX - box.left
    ref.current!.style.setProperty('--x', `${(x / box.width) * 100}%`)
  }
  return (
    <div ref={ref} onMouseMove={onMove} className="relative w-full max-w-3xl aspect-video overflow-hidden rounded-xl shadow bg-black/5" style={{['--x' as any]:'50%'}}>
      <img src={beforeUrl} className="absolute inset-0 w-full h-full object-cover" />
      <img src={afterUrl} className="absolute inset-0 w-full h-full object-cover [clip-path:inset(0_calc(100%-var(--x))_0_0)]" />
      <div className="absolute inset-y-0" style={{left:'var(--x)'}}>
        <div className="w-1 h-full bg-white/80" />
      </div>
    </div>
  )
}
