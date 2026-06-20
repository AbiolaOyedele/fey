'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Project detail now lives at the canonical top-level route /projects/[id]
 * (one detail page for personal + client-assigned projects). This old
 * client-scoped path redirects there so existing links/bookmarks keep working.
 */
export default function LegacyProjectDetailRedirect({ params }: { params: Promise<{ id: string; projectId: string }> }) {
  const { projectId } = use(params)
  const router = useRouter()
  useEffect(() => { router.replace(`/projects/${projectId}`) }, [projectId, router])
  return null
}
