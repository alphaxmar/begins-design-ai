
import React, { useState } from 'react'
import { presignUpload, commitUpload, uploadFile, getErrorMessage, isRetryableError, ApiException } from '../lib/api'

interface UploadState {
  status: 'idle' | 'uploading' | 'error' | 'success'
  progress: string
  error?: string
  warning?: string
}

export default function Uploader({ onUploaded }: { onUploaded: (asset: {assetId: string, r2Key: string}) => void }){
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle', progress: '' })
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 3

  const resetState = () => {
    setUploadState({ status: 'idle', progress: '' })
    setRetryCount(0)
  }

  const validateFile = (file: File): string | null => {
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return 'File size must be less than 10MB'
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return 'Please select a valid image file (JPEG, PNG, WebP, or GIF)'
    }

    return null
  }

  const uploadWithRetry = async (file: File, attempt = 1): Promise<void> => {
    try {
      setUploadState({ status: 'uploading', progress: 'Preparing upload...' })

      // Step 1: Get presigned URL
      const presignResult = await presignUpload(file.name, file.type)
      const { uploadUrl, r2Key, assetId, warning } = presignResult

      if (warning) {
        setUploadState(prev => ({ ...prev, warning }))
      }

      // Step 2: Upload file
      setUploadState(prev => ({ ...prev, progress: 'Uploading file...' }))
      await uploadFile(uploadUrl, file)

      // Step 3: Commit upload
      setUploadState(prev => ({ ...prev, progress: 'Finalizing upload...' }))
      await commitUpload({ 
        assetId, 
        width: 0, 
        height: 0, 
        bytes: file.size, 
        checksum: '', 
        meta: {} 
      })

      setUploadState({ status: 'success', progress: 'Upload completed!' })
      onUploaded({ assetId, r2Key })

    } catch (error) {
      console.error(`Upload attempt ${attempt} failed:`, error)

      if (attempt < maxRetries && isRetryableError(error)) {
        setRetryCount(attempt)
        setUploadState({ 
          status: 'uploading', 
          progress: `Upload failed, retrying... (${attempt}/${maxRetries})` 
        })
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
        return uploadWithRetry(file, attempt + 1)
      }

      // Final failure
      const errorMessage = getErrorMessage(error)
      setUploadState({ 
        status: 'error', 
        progress: '', 
        error: errorMessage 
      })
    }
  }

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset previous state
    resetState()

    // Validate file
    const validationError = validateFile(file)
    if (validationError) {
      setUploadState({ 
        status: 'error', 
        progress: '', 
        error: validationError 
      })
      return
    }

    await uploadWithRetry(file)
  }

  const isDisabled = uploadState.status === 'uploading'

  return (
    <div className="p-4 border rounded-xl bg-white shadow-sm">
      <label className="block text-sm font-medium mb-2">Upload room photo (JPG/PNG/WebP)</label>
      <input 
        type="file" 
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif" 
        onChange={onChange} 
        disabled={isDisabled}
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
      />
      
      {/* Progress/Status Messages */}
      {uploadState.status === 'uploading' && (
        <div className="mt-2 flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <p className="text-sm text-blue-600">{uploadState.progress}</p>
          {retryCount > 0 && (
            <span className="text-xs text-gray-500">({retryCount}/{maxRetries})</span>
          )}
        </div>
      )}

      {uploadState.status === 'success' && (
        <p className="text-sm text-green-600 mt-2 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          {uploadState.progress}
        </p>
      )}

      {uploadState.status === 'error' && (
        <div className="mt-2">
          <p className="text-sm text-red-600 flex items-center">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {uploadState.error}
          </p>
          <button 
            onClick={() => resetState()}
            className="mt-1 text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {uploadState.warning && (
        <p className="text-sm text-yellow-600 mt-2 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {uploadState.warning}
        </p>
      )}

      {/* File size and type hints */}
      <p className="text-xs text-gray-500 mt-2">
        Maximum file size: 10MB. Supported formats: JPEG, PNG, WebP, GIF
      </p>
    </div>
  )
}
