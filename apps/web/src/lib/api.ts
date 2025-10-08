
const API = import.meta.env.VITE_API_BASE || ''

export interface ApiError {
  error: string
  message?: string
  details?: string
  supportedTypes?: string[]
  warning?: string
}

export class ApiException extends Error {
  public status: number
  public apiError: ApiError

  constructor(status: number, apiError: ApiError) {
    super(apiError.message || apiError.error)
    this.status = status
    this.apiError = apiError
    this.name = 'ApiException'
  }

  get userMessage(): string {
    return this.apiError.message || this.apiError.error
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500
  }

  get isServerError(): boolean {
    return this.status >= 500
  }
}

async function handleApiResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return response.json()
  }

  let errorData: ApiError
  try {
    errorData = await response.json()
  } catch {
    errorData = {
      error: 'Network Error',
      message: `Request failed with status ${response.status}: ${response.statusText}`
    }
  }

  throw new ApiException(response.status, errorData)
}

export async function presignUpload(filename: string, mime: string, kind = 'original') {
  try {
    const res = await fetch(`${API}/api/uploads/presign`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename, mime, kind })
    })
    
    return await handleApiResponse<{ uploadUrl: string; r2Key: string; assetId: string; warning?: string }>(res)
  } catch (error) {
    if (error instanceof ApiException) {
      throw error
    }
    throw new ApiException(500, {
      error: 'Network Error',
      message: 'Failed to connect to the server. Please check your internet connection and try again.'
    })
  }
}

export async function uploadFile(uploadUrl: string, file: File) {
  try {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      body: file
    })
    
    return await handleApiResponse<{ success: boolean }>(res)
  } catch (error) {
    if (error instanceof ApiException) {
      throw error
    }
    throw new ApiException(500, {
      error: 'Upload Error',
      message: 'Failed to upload file. Please try again.'
    })
  }
}

export async function commitUpload(data: any) {
  try {
    const res = await fetch(`${API}/api/uploads/commit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data)
    })
    
    return await handleApiResponse<{ ok: boolean }>(res)
  } catch (error) {
    if (error instanceof ApiException) {
      throw error
    }
    throw new ApiException(500, {
      error: 'Commit Error',
      message: 'Failed to finalize file upload. Please try again.'
    })
  }
}

export async function createJob(input: { originalAssetId: string; style: string; options?: any }) {
  try {
    const res = await fetch(`${API}/api/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    })
    
    return await handleApiResponse<{ jobId: string; status: string; outputAssetId?: string }>(res)
  } catch (error) {
    if (error instanceof ApiException) {
      throw error
    }
    throw new ApiException(500, {
      error: 'Job Creation Error',
      message: 'Failed to create processing job. Please try again.'
    })
  }
}

export async function getJob(id: string) {
  try {
    const res = await fetch(`${API}/api/jobs/${id}`)
    return await handleApiResponse<{ job: any }>(res)
  } catch (error) {
    if (error instanceof ApiException) {
      throw error
    }
    throw new ApiException(500, {
      error: 'Job Retrieval Error',
      message: 'Failed to retrieve job information. Please try again.'
    })
  }
}

export async function runJob(id: string) {
  try {
    const res = await fetch(`${API}/api/staging/${id}/run`, { method: 'POST' })
    return await handleApiResponse<any>(res)
  } catch (error) {
    if (error instanceof ApiException) {
      throw error
    }
    throw new ApiException(500, {
      error: 'Job Execution Error',
      message: 'Failed to execute job. Please try again.'
    })
  }
}

// Helper function to get user-friendly error messages
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiException) {
    return error.userMessage
  }
  
  if (error instanceof Error) {
    return error.message
  }
  
  return 'An unexpected error occurred. Please try again.'
}

// Helper function to check if error is retryable
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiException) {
    // Server errors and some client errors are retryable
    return error.isServerError || error.status === 408 || error.status === 429
  }
  
  return true // Network errors are generally retryable
}
