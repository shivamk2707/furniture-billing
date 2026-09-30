'use client'

import { useState } from 'react'
import { uploadCompanyAsset } from '@/actions/uploads'

interface Props {
  initialLogoUrl: string | null
}

export function LogoUpload({ initialLogoUrl }: Props) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    const result = await uploadCompanyAsset(formData, 'logo')
    setUploading(false)

    if (result.success && result.data) {
      setLogoUrl(result.data)
    } else {
      setError(result.error ?? 'Failed to upload logo')
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Company Logo</label>
      <div className="flex items-center gap-4">
        <div className="w-24 h-24 border border-gray-200 rounded flex items-center justify-center bg-gray-50 overflow-hidden">
          {logoUrl ? (
            <img src={logoUrl} alt="Company Logo" className="object-contain w-full h-full p-1" />
          ) : (
            <span className="text-xs text-gray-400">No Logo</span>
          )}
        </div>
        <div>
          <input
            type="file"
            accept="image/jpeg, image/png, image/webp, image/svg+xml"
            onChange={handleFileChange}
            disabled={uploading}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100 disabled:opacity-50"
          />
          <p className="text-xs text-gray-500 mt-1">PNG, JPG, WebP up to 2MB</p>
          {uploading && <p className="text-xs text-blue-600 mt-1">Uploading...</p>}
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
      </div>
    </div>
  )
}
