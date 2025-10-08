
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

type Mode = 'text-to-image' | 'image-to-image'

export default function App(){
  // Mode state
  const [mode, setMode] = useState<Mode>('text-to-image')
  
  // Text-to-image states
  const [customPrompt, setCustomPrompt] = useState('')
  
  // Image-to-image states
  const [asset, setAsset] = useState<{assetId: string, r2Key: string} | null>(null)
  const [style, setStyle] = useState('scandinavian')
  
  // Advanced controls for image-to-image (similar to AUTOMATIC1111)
  const [denoisingStrength, setDenoisingStrength] = useState(0.6)
  const [cfgScale, setCfgScale] = useState(7.5)
  const [samplingSteps, setSamplingSteps] = useState(25)
  const [samplingMethod, setSamplingMethod] = useState('DPM++ 2M Karras')
  const [seed, setSeed] = useState(-1)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // FLUX specific controls
  const [aspectRatio, setAspectRatio] = useState('1:1')
  
  // Common states
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
      
      // Create job based on mode with advanced parameters
      let jobData
      if (mode === 'text-to-image') {
        // For text-to-image, we don't need originalAssetId, just pass the custom prompt
        jobData = { 
          style: customPrompt,
          mode: 'text-to-image',
          options: {
            prompt: customPrompt,
            mode: 'text-to-image',
            cfg_scale: cfgScale,
            steps: samplingSteps,
            seed: seed !== -1 ? seed : undefined,
            sampler: samplingMethod,
            aspect_ratio: aspectRatio
          }
        }
      } else {
        // For image-to-image, use the uploaded asset
        jobData = { 
          originalAssetId: asset!.assetId, 
          style,
          mode: 'image-to-image',
          options: {
            prompt: style,
            mode: 'image-to-image',
            strength: denoisingStrength,
            cfg_scale: cfgScale,
            steps: samplingSteps,
            seed: seed !== -1 ? seed : undefined,
            sampler: samplingMethod
          }
        }
      }
      
      const { jobId: newJobId } = await createJob(jobData)
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
    // Validation based on mode
    if (mode === 'text-to-image' && !customPrompt.trim()) {
      alert('กรุณาใส่ prompt สำหรับสร้างภาพ')
      return
    }
    if (mode === 'image-to-image' && !asset) {
      alert('กรุณาอัปโหลดภาพก่อน')
      return
    }
    
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

  const resetAll = () => {
    resetJob()
    setAsset(null)
    setCustomPrompt('')
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
      <h1 className="text-2xl font-bold">Virtual Staging AI</h1>
      <p className="text-slate-600">เลือกโหมดการใช้งาน: สร้างภาพใหม่จาก prompt หรือแปลงภาพที่มีอยู่</p>

      {/* Mode Selector */}
      <div className="p-4 border rounded-xl bg-white shadow-sm">
        <label className="block text-sm font-medium mb-3">เลือกโหมด</label>
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setMode('text-to-image')}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              mode === 'text-to-image' 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            📝 Text-to-Image (FLUX)
          </button>
          <button
            onClick={() => setMode('image-to-image')}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              mode === 'image-to-image' 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            🖼️ Image-to-Image
          </button>
        </div>
        
        <div className="text-xs text-gray-500">
          {mode === 'text-to-image' 
            ? '💡 สร้างภาพใหม่ทั้งหมดจาก prompt ที่คุณพิมพ์' 
            : '🎨 แปลงภาพที่อัปโหลดเป็นสไตล์ใหม่'
          }
        </div>
      </div>

      {/* Text-to-Image Mode */}
      {mode === 'text-to-image' && (
        <>
          <div className="p-4 border rounded-xl bg-white shadow-sm">
            <label className="block text-sm font-medium mb-2">Custom Prompt</label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              disabled={isProcessing}
              placeholder="เช่น: modern living room with large windows, scandinavian style, bright natural lighting"
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              rows={3}
            />
            <div className="text-xs text-gray-500 mt-1">
              💡 เขียน prompt ภาษาอังกฤษเพื่อผลลัพธ์ที่ดีที่สุด
            </div>
          </div>

          {/* FLUX Controls */}
          <div className="p-4 border rounded-xl bg-white shadow-sm">
            <label className="block text-sm font-medium mb-4">FLUX Settings</label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Steps */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Steps: {samplingSteps}
                </label>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={samplingSteps}
                  onChange={(e) => setSamplingSteps(parseInt(e.target.value))}
                  disabled={isProcessing}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                />
                <div className="text-xs text-gray-500 mt-1">
                  จำนวนขั้นตอนการสร้างภาพ (1-8, แนะนำ 4)
                </div>
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Aspect Ratio
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  disabled={isProcessing}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                >
                  <option value="1:1">1:1 (Square)</option>
                  <option value="16:9">16:9 (Landscape)</option>
                  <option value="9:16">9:16 (Portrait)</option>
                  <option value="4:3">4:3 (Standard)</option>
                  <option value="3:4">3:4 (Portrait)</option>
                  <option value="21:9">21:9 (Ultra Wide)</option>
                </select>
                <div className="text-xs text-gray-500 mt-1">
                  อัตราส่วนของภาพที่จะสร้าง
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Image-to-Image Mode */}
      {mode === 'image-to-image' && (
        <>
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
          </div>

          {/* Advanced Controls */}
          <div className="p-4 border rounded-xl bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium">Advanced Controls</label>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                disabled={isProcessing}
                className="text-xs text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
              >
                {showAdvanced ? 'ซ่อน' : 'แสดง'} Advanced Settings
              </button>
            </div>

            {showAdvanced && (
              <div className="space-y-4 border-t pt-4">
                {/* Denoising Strength */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Denoising Strength: {denoisingStrength.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={denoisingStrength}
                    onChange={(e) => setDenoisingStrength(parseFloat(e.target.value))}
                    disabled={isProcessing}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0.0 (เหมือนเดิม)</span>
                    <span>1.0 (เปลี่ยนมาก)</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    ควบคุมระดับการเปลี่ยนแปลงภาพ - ค่าต่ำจะคงรูปแบบเดิม, ค่าสูงจะเปลี่ยนแปลงมากขึ้น
                  </p>
                </div>

                {/* CFG Scale */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    CFG Scale: {cfgScale.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    step="0.5"
                    value={cfgScale}
                    onChange={(e) => setCfgScale(parseFloat(e.target.value))}
                    disabled={isProcessing}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1.0 (อิสระ)</span>
                    <span>30.0 (ตาม prompt เคร่งครัด)</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    ควบคุมการทำตาม prompt - ค่าต่ำจะสร้างสรรค์มากขึ้น, ค่าสูงจะตาม prompt เคร่งครัด
                  </p>
                </div>

                {/* Sampling Steps */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Sampling Steps: {samplingSteps}
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="150"
                    step="5"
                    value={samplingSteps}
                    onChange={(e) => setSamplingSteps(parseInt(e.target.value))}
                    disabled={isProcessing}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>10 (เร็ว)</span>
                    <span>150 (คุณภาพสูง)</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    จำนวนขั้นตอนการสร้างภาพ - มากขึ้นจะได้คุณภาพดีขึ้นแต่ใช้เวลานานขึ้น
                  </p>
                </div>

                {/* Sampling Method */}
                <div>
                  <label className="block text-sm font-medium mb-2">Sampling Method</label>
                  <select
                    value={samplingMethod}
                    onChange={(e) => setSamplingMethod(e.target.value)}
                    disabled={isProcessing}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  >
                    <option value="DPM++ 2M Karras">DPM++ 2M Karras (แนะนำ)</option>
                    <option value="Euler a">Euler a</option>
                    <option value="Euler">Euler</option>
                    <option value="LMS">LMS</option>
                    <option value="Heun">Heun</option>
                    <option value="DPM2">DPM2</option>
                    <option value="DPM2 a">DPM2 a</option>
                    <option value="DPM++ 2S a">DPM++ 2S a</option>
                    <option value="DPM++ 2M">DPM++ 2M</option>
                    <option value="DDIM">DDIM</option>
                    <option value="PLMS">PLMS</option>
                  </select>
                  <p className="text-xs text-gray-600 mt-1">
                    วิธีการสุ่มตัวอย่าง - DPM++ 2M Karras ให้ผลลัพธ์ที่ดีที่สุดในส่วนใหญ่
                  </p>
                </div>

                {/* Seed Control */}
                <div>
                  <label className="block text-sm font-medium mb-2">Seed</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={seed}
                      onChange={(e) => setSeed(parseInt(e.target.value) || -1)}
                      disabled={isProcessing}
                      placeholder="-1 (random)"
                      className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                    />
                    <button
                      onClick={() => setSeed(Math.floor(Math.random() * 2147483647))}
                      disabled={isProcessing}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      🎲 Random
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    เป้า seed สำหรับควบคุมการสุ่ม - ใช้ seed เดียวกันจะได้ผลลัพธ์คล้ายกัน
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Action Buttons */}
      <div className="p-4 border rounded-xl bg-white shadow-sm">
        <div className="flex gap-3">
          <button 
            onClick={start} 
            disabled={
              isProcessing || 
              (mode === 'text-to-image' && !customPrompt.trim()) ||
              (mode === 'image-to-image' && !asset)
            }
            className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
          >
            {isProcessing ? 'Processing...' : 
             mode === 'text-to-image' ? '🎨 สร้างภาพ' : '✨ แปลงภาพ'}
          </button>
          
          {(asset || customPrompt || job) && (
            <button 
              onClick={resetAll}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              🔄 เริ่มใหม่
            </button>
          )}
        </div>
        
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
          
          {job.status === 'succeeded' && (
            <div>
              <p className="text-sm text-slate-600 mb-2">Output saved to R2: <code className="bg-gray-100 px-1 rounded">{job.output_r2_key}</code></p>
              
              {mode === 'image-to-image' && asset ? (
                <BeforeAfter 
                  beforeUrl={`https://begins-design-ai-bucket.alphaxmar.workers.dev/${asset.r2Key}`} 
                  afterUrl={`https://begins-design-ai-bucket.alphaxmar.workers.dev/${job.output_r2_key}`} 
                />
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Generated Image:</p>
                  <img 
                    src={`https://begins-design-ai-bucket.alphaxmar.workers.dev/${job.output_r2_key}`}
                    alt="Generated result"
                    className="max-w-full h-auto rounded-lg border"
                  />
                </div>
              )}
            </div>
          )}
          
          {job.status === 'failed' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2 text-red-800">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Job processing failed. Please try again.</span>
              </div>
            </div>
          )}
          
          {job.status === 'processing' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2 text-blue-800">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>AI is processing. This may take 1-2 minutes...</span>
              </div>
            </div>
          )}
        </div>
      )}

      <footer className="text-xs text-slate-500">© 2025 Virtual Staging AI — รองรับทั้ง Text-to-Image และ Image-to-Image</footer>
    </div>
  )
}
