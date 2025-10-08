
import React, { useEffect, useState } from 'react'
import Uploader from './components/Uploader'
import BeforeAfter from './components/BeforeAfter'
import { createJob, getJob, runJob, getErrorMessage, isRetryableError, ApiException } from './lib/api'

const styles = ['scandinavian','japandi','luxury','industrial']

interface JobState {
  status: 'idle' | 'creating' | 'processing' | 'completed' | 'error'
  error?: string
  retryCount: number
}

export default function App(){
  const [asset, setAsset] = useState<{assetId: string, r2Key: string} | null>(null)
  const [style, setStyle] = useState('scandinavian')
  const [jobId, setJobId] = useState<string>('')
  const [job, setJob] = useState<any>(null)
  const [outUrl, setOutUrl] = useState<string>('')
  const [jobState, setJobState] = useState<JobState>({ status: 'idle', retryCount: 0 })
  const [pollingError, setPollingError] = useState<string>('')

  useEffect(() => {
    if (!jobId) return
    
    let retryCount = 0
    const maxRetries = 5
    
    const pollJob = async () => {
      try {
        const j = await getJob(jobId)
        setJob(j.job)
        setPollingError('') // Clear any previous polling errors
        retryCount = 0 // Reset retry count on success
        
        // Stop polling if job is completed or failed
        if (j.job.status === 'succeeded' || j.job.status === 'failed') {
          setJobState(prev => ({ 
            ...prev, 
            status: j.job.status === 'succeeded' ? 'completed' : 'error',
            error: j.job.status === 'failed' ? 'Job processing failed' : undefined
          }))
        }
      } catch (error) {
        console.error('Error polling job:', error)
        retryCount++
        
        if (retryCount >= maxRetries) {
          setPollingError('Failed to check job status. Please refresh the page.')
          setJobState(prev => ({ ...prev, status: 'error', error: 'Connection lost' }))
        } else {
          setPollingError(`Connection issue (retry ${retryCount}/${maxRetries})`)
        }
      }
    }
    
    const t = setInterval(pollJob, 1500)
    return () => clearInterval(t)
  }, [jobId])

  const startWithRetry = async (attempt = 1): Promise<void> => {
    const maxRetries = 3
    
    try {
      setJobState({ status: 'creating', retryCount: attempt - 1 })
      
      // Create job
      const { jobId: newJobId } = await createJob({ originalAssetId: asset!.assetId, style })
      setJobId(newJobId)
      
      setJobState(prev => ({ ...prev, status: 'processing' }))
      
      // Start job execution
      await runJob(newJobId)
      
    } catch (error) {
      console.error(`Job creation attempt ${attempt} failed:`, error)
      
      if (attempt < maxRetries && isRetryableError(error)) {
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
        return startWithRetry(attempt + 1)
      }
      
      // Final failure
      const errorMessage = getErrorMessage(error)
      setJobState({ 
        status: 'error', 
        error: errorMessage,
        retryCount: attempt - 1
      })
    }
  }

  const start = async () => {
    if (!asset) return
    setJob(null) // Clear previous job
    setPollingError('')
    await startWithRetry()
  }

  const resetJob = () => {
    setJobId('')
    setJob(null)
    setJobState({ status: 'idle', retryCount: 0 })
    setPollingError('')
  }

  const getJobStatusDisplay = () => {
    if (jobState.status === 'creating') {
      return (
        <div className="flex items-center space-x-2 text-blue-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span>Creating job...</span>
          {jobState.retryCount > 0 && (
            <span className="text-xs text-gray-500">(retry {jobState.retryCount}/3)</span>
          )}
        </div>
      )
    }
    
    if (jobState.status === 'processing') {
      return (
        <div className="flex items-center space-x-2 text-blue-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span>Processing with AI...</span>
        </div>
      )
    }
    
    if (jobState.status === 'error') {
      return (
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-red-600">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{jobState.error}</span>
          </div>
          <button 
            onClick={resetJob}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Try again
          </button>
        </div>
      )
    }
    
    return null
  }

  const isProcessing = jobState.status === 'creating' || jobState.status === 'processing'

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Virtual Staging (Cloudflare)</h1>
      <p className="text-slate-600">Auth via Cloudflare Access. Upload → pick style → run staging with Workers AI.</p>

      <Uploader onUploaded={setAsset} />

      <div className="p-4 border rounded-xl bg-white shadow-sm">
        <label className="block text-sm font-medium mb-2">Style</label>
        <div className="flex gap-2 mb-4">
          {styles.map(s => (
            <button key={s}
              onClick={() => setStyle(s)}
              disabled={isProcessing}
              className={"px-3 py-1 rounded-full border transition-colors " + 
                (style === s ? "bg-black text-white" : "bg-white hover:bg-gray-50") +
                (isProcessing ? " opacity-50 cursor-not-allowed" : "")
              }>
              {s}
            </button>
          ))}
        </div>
        
        <button 
          onClick={start} 
          disabled={!asset || isProcessing} 
          className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
        >
          {isProcessing ? 'Processing...' : 'Run staging'}
        </button>
        
        {/* Job Status Display */}
        {jobState.status !== 'idle' && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            {getJobStatusDisplay()}
          </div>
        )}
      </div>

      {/* Polling Error Display */}
      {pollingError && (
        <div className="p-4 border border-yellow-200 rounded-xl bg-yellow-50">
          <div className="flex items-center space-x-2 text-yellow-800">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{pollingError}</span>
          </div>
        </div>
      )}

      {/* Job Results */}
      {job && (
        <div className="p-4 border rounded-xl bg-white shadow-sm space-y-2">
          <div className="text-sm flex items-center justify-between">
            <div>
              <span className="font-semibold">Job:</span> {job.id} • 
              <span className={`capitalize ml-1 px-2 py-1 rounded-full text-xs ${
                job.status === 'succeeded' ? 'bg-green-100 text-green-800' :
                job.status === 'failed' ? 'bg-red-100 text-red-800' :
                job.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {job.status}
              </span>
            </div>
            {job.status !== 'processing' && (
              <button 
                onClick={resetJob}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Start new job
              </button>
            )}
          </div>
          
          {job.status === 'succeeded' && asset && (
            <div>
              <p className="text-sm text-slate-600 mb-2">Output saved to R2: <code className="bg-gray-100 px-1 rounded">{job.output_r2_key}</code></p>
              <BeforeAfter 
                beforeUrl={`https://begins-design-ai-bucket.alphaxmar.workers.dev/${asset.r2Key}`} 
                afterUrl={`https://begins-design-ai-bucket.alphaxmar.workers.dev/${job.output_r2_key}`} 
              />
            </div>
          )}
          
          {job.status === 'failed' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2 text-red-800">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Job processing failed. Please try again with a different image or style.</span>
              </div>
            </div>
          )}
          
          {job.status === 'processing' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2 text-blue-800">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>AI is processing your image. This may take 1-2 minutes...</span>
              </div>
            </div>
          )}
        </div>
      )}

      <footer className="text-xs text-slate-500">© 2025 Virtual Staging — Cloudflare Stack</footer>
    </div>
  )
}
