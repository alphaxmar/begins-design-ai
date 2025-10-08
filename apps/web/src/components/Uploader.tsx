
import React, { useState } from 'react'
import { presignUpload, commitUpload } from '../lib/api'

export default function Uploader({ onUploaded }: { onUploaded: (asset: {assetId: string, r2Key: string}) => void }){
  const [busy, setBusy] = useState(false)
  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    const { uploadUrl, r2Key, assetId } = await presignUpload(f.name, f.type)
    await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': f.type }, body: f })
    await commitUpload({ assetId, width: 0, height: 0, bytes: f.size, checksum: '', meta: {} })
    setBusy(false)
    onUploaded({ assetId, r2Key })
  }
  return (
    <div className="p-4 border rounded-xl bg-white shadow-sm">
      <label className="block text-sm font-medium mb-2">Upload room photo (JPG/PNG)</label>
      <input type="file" accept="image/*" onChange={onChange} disabled={busy} />
      {busy && <p className="text-sm text-slate-500 mt-2">Uploading…</p>}
    </div>
  )
}
