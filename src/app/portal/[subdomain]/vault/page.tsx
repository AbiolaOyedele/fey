'use client'

import { use } from 'react'
import { Vault as VaultIcon, Search } from 'lucide-react'
import { usePortalAccent } from '@/hooks/usePortalBranding'
import { useVault } from '@/hooks/useVault'
import { FadeIn } from '@/components/ui/motion'
import VaultList from '@/components/vault/VaultList'
import { VAULT_CATEGORIES, VAULT_CATEGORY_LABEL, type VaultCategory } from '@/types/vault'

/**
 * The client's side of the Vault — read-only, and only ever their own things.
 *
 * Their invoices, their contracts, documents shared with them by name, and
 * anything the agency shares with every client. No upload and no controls: the
 * Vault is the agency's filing cabinet, and this is the drawer they're allowed
 * to open. Files they send the agency still go through Files, where it's clear
 * whose they are.
 */
export default function PortalVaultPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const accent = usePortalAccent(subdomain)

  const { visible, entries, loading, error, filter, setFilter } = useVault({ subdomain })

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter">
      <FadeIn>
        <div className="flex items-center gap-2 mb-1">
          <VaultIcon size={18} style={{ color: accent }} />
          <h1 className="font-display text-xl font-normal text-gray-800">Vault</h1>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          Your invoices, contracts and shared documents, all in one place.
        </p>
      </FadeIn>

      <div className="max-w-3xl space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
          <input
            value={filter.search ?? ''}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            placeholder="Search your documents"
            aria-label="Search your documents"
            className="w-full pl-9 pr-3 py-2.5 min-h-[44px] rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-gray-400 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
          <button
            onClick={() => setFilter({ ...filter, category: 'all' })}
            className="flex-shrink-0 px-3 min-h-[40px] rounded-xl text-2xs font-medium border transition-colors"
            style={(filter.category ?? 'all') === 'all'
              ? { borderColor: accent, backgroundColor: `${accent}12`, color: accent }
              : { borderColor: '#E5E7EB', color: '#6B7280' }}
          >
            All
          </button>
          {VAULT_CATEGORIES.map((c: VaultCategory) => {
            const active = filter.category === c
            return (
              <button
                key={c}
                onClick={() => setFilter({ ...filter, category: c })}
                className="flex-shrink-0 px-3 min-h-[40px] rounded-xl text-2xs font-medium border transition-colors"
                style={active
                  ? { borderColor: accent, backgroundColor: `${accent}12`, color: accent }
                  : { borderColor: '#E5E7EB', color: '#6B7280' }}
              >
                {VAULT_CATEGORY_LABEL[c]}
              </button>
            )
          })}
        </div>

        <VaultList
          entries={visible}
          loading={loading}
          error={error}
          accent={accent}
          emptyMessage={
            entries.length > 0
              ? 'Nothing matches that. Try a different search.'
              : 'Once your team shares a document — or sends an invoice or contract — it’ll appear here.'
          }
        />
      </div>
    </div>
  )
}
