
import React, { useEffect, useState } from 'react'
import Uploader from './components/Uploader'
import BeforeAfter from './components/BeforeAfter'
import { createJob, getJob, runJob } from './lib/api'

const styles = ['scandinavian','japandi','luxury','industrial']

export default function App(){
  const [asset, setAsset] = useState<{assetId: string, r2Key: string} | null>(null)
  const [style, setStyle] = useState('scandinavian')
  const [jobId, setJobId] = useState<string>('')
  const [job, setJob] = useState<any>(null)
  const [outUrl, setOutUrl] = useState<string>('')

  useEffect(() => {
    if (!jobId) return
    const t = setInterval(async () => {
      const j = await getJob(jobId)
      setJob(j.job)
    }, 1500)
    return () => clearInterval(t)
  }, [jobId])

  const start = async () => {
    if (!asset) return
    const { jobId } = await createJob({ originalAssetId: asset.assetId, style })
    setJobId(jobId)
    await runJob(jobId)
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Virtual Staging (Cloudflare)</h1>
      <p className="text-slate-600">Auth via Cloudflare Access. Upload → pick style → run staging with Workers AI.</p>

      <Uploader onUploaded={setAsset} />

      <div className="p-4 border rounded-xl bg-white shadow-sm">
        <label className="block text-sm font-medium mb-2">Style</label>
        <div className="flex gap-2">
          {styles.map(s => (
            <button key={s}
              onClick={() => setStyle(s)}
              className={"px-3 py-1 rounded-full border " + (style===s ? "bg-black text-white" : "bg-white")}>
              {s}
            </button>
          ))}
        </div>
        <button onClick={start} disabled={!asset} className="mt-4 px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50">Run staging</button>
      </div>

      {job && (
        <div className="p-4 border rounded-xl bg-white shadow-sm space-y-2">
          <div className="text-sm">
            <span className="font-semibold">Job:</span> {job.id} • <span className="capitalize">{job.status}</span>
          </div>
          {job.status === 'succeeded' && (
            <div>
              <p className="text-sm text-slate-600 mb-2">Output saved to R2: <code>{job.output_r2_key}</code></p>
              {/* In a real app, you'd return a signed URL from the API. For demo we just show keys. */}
              <BeforeAfter beforeUrl={"https://via.placeholder.com/1280x720?text=Before"} afterUrl={"https://via.placeholder.com/1280x720?text=After"} />
            </div>
          )}
        </div>
      )}

      <footer className="text-xs text-slate-500">© 2025 Virtual Staging — Cloudflare Stack</footer>
    </div>
  )
}
