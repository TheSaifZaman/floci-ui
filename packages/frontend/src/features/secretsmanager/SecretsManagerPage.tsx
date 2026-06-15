import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import type { SecretSummary } from '@/api/aws/secretsmanager.api'
import {
  secretsManagerQueryKeys,
  useSecretDetailQuery,
  useSecretsQuery,
  useSecretValueQuery,
} from '@/api/aws/secretsmanager.queries'
import {
  useCreateSecretMutation,
  useDeleteSecretMutation,
  usePutSecretValueMutation,
} from '@/api/aws/secretsmanager.mutations'
import { timeAgo } from '@/lib/utils'

// ─── Create secret form ─────────────────────────────────────────────────────────

function CreateSecretForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [secretString, setSecretString] = useState('')
  const [err, setErr] = useState('')

  const createMut = useCreateSecretMutation({
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['resources', 'secretsmanager'] })
      onClose()
    },
    onError: (e) => setErr(e instanceof Error ? e.message : 'Create failed'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setErr('Secret name is required')
    if (!secretString) return setErr('Secret value is required')
    setErr('')
    createMut.mutate({ name: name.trim(), secretString, description: description.trim() || undefined })
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, background: 'var(--raised)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <KeyRound size={14} style={{ color: 'var(--accent)' }} />
        <strong style={{ fontSize: 13 }}>Create secret</strong>
        <button type="button" className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      <input
        className="input"
        placeholder="Secret name (e.g. prod/db/password)"
        value={name}
        onChange={(e) => { setName(e.target.value); setErr('') }}
        autoFocus
      />
      <input
        className="input"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <textarea
        className="json-editor"
        style={{ minHeight: 100 }}
        placeholder={'Secret value — plaintext or JSON, e.g.\n{\n  "username": "admin",\n  "password": "…"\n}'}
        value={secretString}
        onChange={(e) => { setSecretString(e.target.value); setErr('') }}
        spellCheck={false}
      />
      {err && <span style={{ fontSize: 12, color: '#f87171' }}>{err}</span>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="button" onClick={onClose}>Cancel</button>
        <button type="submit" className="button primary" disabled={createMut.isPending}>
          {createMut.isPending ? <Loader2 size={13} className="spin" /> : <Plus size={13} />}
          Create
        </button>
      </div>
    </form>
  )
}

// ─── Secret detail drawer ─────────────────────────────────────────────────────────

function SecretDrawer({
  secretId,
  onClose,
  onDeleted,
}: {
  secretId: string | null
  onClose: () => void
  onDeleted: () => void
}) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'details' | 'value'>('details')
  const [revealed, setRevealed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftValue, setDraftValue] = useState('')
  const [copied, setCopied] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [forceDelete, setForceDelete] = useState(false)

  // Reset transient state when the selected secret changes (via key prop), and
  // evict any fetched plaintext from the cache so it never outlives this view.
  useEffect(() => {
    setTab('details')
    setRevealed(false)
    setEditing(false)
    setDraftValue('')
    setCopied(false)
    setDeleteConfirm(false)
    setForceDelete(false)
    return () => {
      qc.removeQueries({ queryKey: secretsManagerQueryKeys.value(secretId) })
    }
  }, [secretId, qc])

  // Auto-hide when the user leaves the Value tab. Flipping `revealed` is not
  // enough — the fetched plaintext stays in the React Query cache (readable via
  // DevTools/other components) until its entry is evicted, so drop it here and
  // discard any in-progress edit as well.
  useEffect(() => {
    if (tab === 'value') return
    setRevealed(false)
    setEditing(false)
    setDraftValue('')
    qc.removeQueries({ queryKey: secretsManagerQueryKeys.value(secretId) })
  }, [tab, secretId, qc])

  const detailQuery = useSecretDetailQuery(secretId)

  // The plaintext value is only fetched once the user explicitly reveals it.
  const valueQuery = useSecretValueQuery(secretId, revealed && tab === 'value')

  const putMut = usePutSecretValueMutation({
    onSuccess: () => {
      setEditing(false)
      setDraftValue('')
    },
    onError: (e) => alert(`Update failed: ${e instanceof Error ? e.message : e}`),
  })

  const deleteMut = useDeleteSecretMutation({
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['resources', 'secretsmanager'] })
      onDeleted()
    },
    onError: (e) => alert(`Delete failed: ${e instanceof Error ? e.message : e}`),
  })

  const detail = detailQuery.data
  const value = valueQuery.data
  // A binary secret has no SecretString. The API only writes SecretString, so
  // editing one here would overwrite the binary value with text — block it.
  const isBinary = Boolean(value && value.secretString === undefined && value.secretBinary !== undefined)

  // Hiding must evict the fetched plaintext from the cache, not merely flip the
  // reveal flag — otherwise the value lingers in memory (DevTools, extensions,
  // other components) after the user hides it.
  function hideValue() {
    setRevealed(false)
    qc.removeQueries({ queryKey: secretsManagerQueryKeys.value(secretId) })
  }

  function cancelEditing() {
    setEditing(false)
    setDraftValue('')
  }

  function startEditing() {
    if (isBinary) return
    setDraftValue(value?.secretString ?? '')
    setEditing(true)
  }

  async function copyValue() {
    const text = value?.secretString ?? value?.secretBinary
    if (text === undefined || text === null) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be denied; silently ignore.
    }
  }

  return (
    <div className={`tag-drawer ${secretId ? 'open' : ''}`} style={{ width: 440 }}>
      <div className="tag-drawer-header">
        <KeyRound size={14} style={{ color: 'var(--accent)' }} />
        <h3 title={detail?.name ?? secretId ?? ''}>{detail?.name ?? secretId}</h3>
        <button className="icon-btn" onClick={onClose}><X size={14} /></button>
      </div>

      <div className="drawer-tabs">
        <button className={`drawer-tab ${tab === 'details' ? 'active' : ''}`} onClick={() => setTab('details')}>
          Details
        </button>
        <button className={`drawer-tab ${tab === 'value' ? 'active' : ''}`} onClick={() => setTab('value')}>
          Value
        </button>
      </div>

      <div className="tag-drawer-body">
        {/* ── Details tab ── */}
        {tab === 'details' && (
          detailQuery.isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5f7080', fontSize: 13 }}>
              <Loader2 size={14} className="spin" /> Loading details…
            </div>
          ) : detailQuery.isError ? (
            <p style={{ color: '#f87171', fontSize: 13 }}>Failed to load secret details.</p>
          ) : detail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: 'rgba(34,197,94,0.14)', color: '#4ade80' }}>
                  {detail.rotationEnabled ? 'Rotation enabled' : 'Active'}
                </span>
                {detail.versionIds.length > 0 && (
                  <span className="badge" style={{ background: 'rgba(107,114,128,0.14)', color: '#9ca3af' }}>
                    {detail.versionIds.length} version{detail.versionIds.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="meta-grid">
                {detail.arn && (
                  <div className="meta-row">
                    <span className="meta-label">ARN</span>
                    <span className="meta-value" style={{ fontSize: 11 }}>{detail.arn}</span>
                  </div>
                )}
                {detail.description && (
                  <div className="meta-row">
                    <span className="meta-label">Description</span>
                    <span className="meta-value" style={{ fontFamily: 'inherit', color: '#8d9cad' }}>{detail.description}</span>
                  </div>
                )}
                {detail.kmsKeyId && (
                  <div className="meta-row">
                    <span className="meta-label">KMS key</span>
                    <span className="meta-value" style={{ fontSize: 11 }}>{detail.kmsKeyId}</span>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {detail.createdDate && (
                    <div className="meta-row">
                      <span className="meta-label">Created</span>
                      <span className="meta-value" style={{ color: '#8d9cad' }}>{timeAgo(detail.createdDate)}</span>
                    </div>
                  )}
                  {detail.lastChangedDate && (
                    <div className="meta-row">
                      <span className="meta-label">Last changed</span>
                      <span className="meta-value" style={{ color: '#8d9cad' }}>{timeAgo(detail.lastChangedDate)}</span>
                    </div>
                  )}
                  {detail.lastAccessedDate && (
                    <div className="meta-row">
                      <span className="meta-label">Last accessed</span>
                      <span className="meta-value" style={{ color: '#8d9cad' }}>{timeAgo(detail.lastAccessedDate)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              {detail.tags.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, color: '#5f7080', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>
                    Tags ({detail.tags.length})
                  </p>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    {detail.tags.map((tag, i) => (
                      <div
                        key={tag.key}
                        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: i < detail.tags.length - 1 ? '1px solid var(--border)' : undefined }}
                      >
                        <div style={{ padding: '6px 8px', borderRight: '1px solid var(--border)', fontSize: 12, fontFamily: 'monospace', color: '#fbbf24' }}>{tag.key}</div>
                        <div style={{ padding: '6px 8px', fontSize: 12, fontFamily: 'monospace', color: '#d1d1d1' }} title={tag.value}>{tag.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null
        )}

        {/* ── Value tab ── */}
        {tab === 'value' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!revealed && !editing ? (
              <button className="button" onClick={() => setRevealed(true)} style={{ alignSelf: 'flex-start' }}>
                <Eye size={13} />
                Reveal secret value
              </button>
            ) : editing ? (
              <>
                <p style={{ fontSize: 11, color: '#5f7080', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                  New secret value
                </p>
                <textarea
                  className="json-editor"
                  style={{ minHeight: 140 }}
                  value={draftValue}
                  onChange={(e) => setDraftValue(e.target.value)}
                  spellCheck={false}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="button primary" disabled={putMut.isPending || !draftValue} onClick={() => putMut.mutate({ id: secretId!, secretString: draftValue })}>
                    {putMut.isPending ? <Loader2 size={13} className="spin" /> : <Save size={13} />}
                    Save new version
                  </button>
                  <button className="button" onClick={cancelEditing}>Cancel</button>
                </div>
              </>
            ) : valueQuery.isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5f7080', fontSize: 13 }}>
                <Loader2 size={14} className="spin" /> Loading value…
              </div>
            ) : valueQuery.isError ? (
              <p style={{ color: '#f87171', fontSize: 13 }}>Failed to load secret value.</p>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#5f7080', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {value?.secretBinary ? 'Binary value (base64)' : 'Secret value'}
                  </span>
                  <button className="icon-btn" style={{ marginLeft: 'auto' }} title="Hide" onClick={hideValue}>
                    <EyeOff size={13} />
                  </button>
                  <button className="icon-btn" title="Copy" onClick={copyValue}>
                    {copied ? <Check size={13} color="#4ade80" /> : <Copy size={13} />}
                  </button>
                </div>
                <pre className="json-editor" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
                  {value?.secretString ?? value?.secretBinary ?? '(empty)'}
                </pre>
                {value?.versionId && (
                  <span style={{ fontSize: 11, color: '#5f7080' }}>Version: {value.versionId}</span>
                )}
                {isBinary ? (
                  <span style={{ fontSize: 12, color: '#8d9cad' }}>
                    Binary secrets are read-only here; editing would overwrite the binary value with text.
                  </span>
                ) : (
                  <button className="button" onClick={startEditing} style={{ alignSelf: 'flex-start' }}>
                    <Save size={13} />
                    Edit value
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="tag-drawer-footer">
        {deleteConfirm ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', padding: '8px', background: 'rgba(239,68,68,0.08)', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)' }}>
            <span style={{ fontSize: 12, color: '#f87171' }}>Delete this secret?</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-2)' }}>
              <input type="checkbox" checked={forceDelete} onChange={(e) => setForceDelete(e.target.checked)} />
              Force delete (no 7-day recovery window)
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="button danger" onClick={() => deleteMut.mutate({ id: secretId!, force: forceDelete })} disabled={deleteMut.isPending}>
                {deleteMut.isPending ? <Loader2 size={12} className="spin" /> : 'Yes, delete'}
              </button>
              <button className="button" onClick={() => setDeleteConfirm(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="button danger" style={{ marginLeft: 'auto' }} onClick={() => setDeleteConfirm(true)}>
            <Trash2 size={13} />
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SecretsManagerPage() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const query = useSecretsQuery()

  const secrets = useMemo(() => {
    const all = query.data ?? []
    if (!search) return all
    const q = search.toLowerCase()
    return all.filter((s) => s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q))
  }, [query.data, search])

  function selectionId(secret: SecretSummary): string {
    return secret.arn ?? secret.name
  }

  return (
    <>
      <SecretDrawer
        key={selected}
        secretId={selected}
        onClose={() => setSelected(null)}
        onDeleted={() => setSelected(null)}
      />

      <div className="page-header">
        <div className="page-title">
          <h2>Secrets Manager</h2>
          <span className="info-link">
            <Info size={11} />
            {query.data ? `${query.data.length} secrets` : 'Encrypted secrets'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="button" onClick={() => void query.refetch()}>
            <RefreshCw size={13} />
            Refresh
          </button>
          <button className="button primary" onClick={() => setCreating((v) => !v)}>
            <Plus size={13} />
            Create secret
          </button>
        </div>
      </div>

      <div className="input-row">
        <Search size={14} color="#8d9cad" />
        <input
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or description…"
        />
      </div>

      <div className="content">
        {creating && <CreateSecretForm onClose={() => setCreating(false)} />}

        <div className="table-panel">
          <div className="widget-header">
            <h3>Secrets</h3>
          </div>
          {query.isError ? (
            <EmptyState icon={KeyRound} title="Cannot load secrets" description="Secrets Manager did not respond from the Floci endpoint." />
          ) : query.isLoading ? (
            <div className="empty"><p>Loading secrets…</p></div>
          ) : secrets.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title={search ? 'No secrets match your search' : 'No secrets'}
              description={search ? 'Try a different name or description filter.' : 'Create a secret to get started.'}
            />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Last changed</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {secrets.map((secret) => {
                  const id = selectionId(secret)
                  return (
                    <tr
                      key={id}
                      style={{ cursor: 'pointer', background: selected === id ? 'var(--raised)' : undefined }}
                      onClick={() => setSelected(selected === id ? null : id)}
                    >
                      <td className="mono" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <KeyRound size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        {secret.name}
                      </td>
                      <td style={{ color: '#8d9cad' }}>{secret.description ?? '—'}</td>
                      <td style={{ color: '#8d9cad' }}>{secret.lastChangedDate ? timeAgo(secret.lastChangedDate) : '—'}</td>
                      <td>{secret.tags.length || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
