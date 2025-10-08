
const API = import.meta.env.VITE_API_BASE || ''

export async function presignUpload(filename: string, mime: string, kind='original') {
  const res = await fetch(`${API}/api/uploads/presign`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filename, mime, kind })
  })
  if (!res.ok) throw new Error('presign failed')
  return res.json() as Promise<{ uploadUrl: string; r2Key: string; assetId: string }>
}

export async function commitUpload(data: any) {
  const res = await fetch(`${API}/api/uploads/commit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data)
  })
  return res.json()
}

export async function createJob(input: { originalAssetId: string; style: string; options?: any }) {
  const res = await fetch(`${API}/api/jobs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input)
  })
  if (!res.ok) throw new Error('Failed to create job')
  return res.json() as Promise<{ jobId: string }>
}

export async function getJob(id: string) {
  const res = await fetch(`${API}/api/jobs/${id}`)
  return res.json() as Promise<{ job: any }>
}

export async function runJob(id: string) {
  const res = await fetch(`${API}/api/staging/${id}/run`, { method: 'POST' })
  return res.json()
}
