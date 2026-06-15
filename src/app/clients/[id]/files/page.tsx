'use client'

import { use, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useCrmFiles } from '@/hooks/useCrm'
import { useWorkspace } from '@/hooks/useWorkspace'
import { uploadToCloudinary } from '@/utils/cloudinary'
import FileList from '@/components/crm/FileList'

export default function FilesTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user }  = useAuth()
  const { showToast } = useSettings()
  const { canManage } = useWorkspace()
  const { files, loading, addFile, removeFile } = useCrmFiles(id)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const { url, publicId } = await uploadToCloudinary(file, 'files').promise
      await addFile({
        contact_id:    id,
        uploader_type: 'owner',
        file_name:     file.name,
        file_url:      url,
        public_id:     publicId,
        file_size:     file.size,
        file_type:     file.type || null,
      })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Couldn’t upload that file. Please try again.')
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
