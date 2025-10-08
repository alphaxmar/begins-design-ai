
export type JobStatus = 'queued'|'processing'|'succeeded'|'failed'|'canceled'
export interface Job {
  id: string
  user_email: string
  original_r2_key: string
  status: JobStatus
  style?: string
  prompt?: string
  negative_prompt?: string
  strength?: number
  model?: string
  output_r2_key?: string
  error?: string
  created_at?: number
  updated_at?: number
}
