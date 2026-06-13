'use client'

import { use, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCrmFiles } from '@/hooks/useCrm'
import { useWorkspace } from '@/hooks/useWorkspace'
import FileList from '@/components/crm/FileList'

async function uploadToCloudinary(file: File): Promise<{ url: string; publicId: string }> {
  const cloudName    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ''
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? ''
  const form = new FormData()
  form.append('file', file)
  form.append('upload_preset', uploadPreset)
  const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: 'POST', body: form })
  const data = await res.json() as { secure_url: string; public_id: string }
  return { url: data.secure_url, publicId: data.public_id }
}

export default function FilesTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user }  = useAuth()
  const { canManage } = useWorkspace()
  const { files, loading, addFile, removeFile } = useCrmFiles(id)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const { url, publicId } = await uploadToCloudinary(file)
      await addFile({
        contact_id:    id,
        uploader_type: 'owner',
        file_name:     file.name,
        file_url:      url,
        public_id:     publicId,
        file_size:     file.size,
        file_type:     file.type || null,
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <FileList
      files={files}
      loading={loading}
      ownerId={user?.id ?? ''}
      contactId={id}
      onUpload={handleUpload}
      onDelete={(fileId) => removeFile(fileId)}
      uploading={uploading}
      canDelete={canManage}
    />
  )
}
