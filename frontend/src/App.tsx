import { useEffect, useState, type FormEvent } from 'react'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

type Status = 'open' | 'acknowledged' | 'resolved'

type Occurrence = {
  _id: string
  siteId: string
  type: string
  severity: number
  detectedAt: string
  status: Status
  count: number
  note?: string
  priority: number
}

const typeLabels: Record<string, string> = {
  intrusion: 'Intrusion',
  perimeter_breach: 'Perimeter breach',
  low_battery: 'Low battery',
  signal_loss: 'Signal loss',
}

const statusLabels: Record<Status, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
}

function App() {
  const [status, setStatus] = useState<Status | ''>('')
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false
    const query = status ? `?status=${status}` : ''

    setLoading(true)
    fetch(`${apiUrl}/occurrences${query}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        return response.json()
      })
      .then((data: Occurrence[]) => {
        if (ignore) return
        setOccurrences(data)
        setError(null)
      })
      .catch(() => {
        if (ignore) return
        setOccurrences([])
        setError('Não foi possível carregar as ocorrências.')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [status, reloadKey])

  return (
    <main className="page">
      <header className="header">
        <h1>Triagem de ocorrências</h1>
        <label className="filter">
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value as Status | '')}>
            <option value="">Todos</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </header>

      {error && <p className="message error">{error}</p>}
      {!error && loading && occurrences.length === 0 && <p className="message">Carregando...</p>}
      {!error && !loading && occurrences.length === 0 && <p className="message">Nenhuma ocorrência encontrada.</p>}

      <ul className="list">
        {occurrences.map((occurrence) => (
          <OccurrenceCard
            key={occurrence._id}
            occurrence={occurrence}
            onUpdated={() => setReloadKey((key) => key + 1)}
          />
        ))}
      </ul>
    </main>
  )
}

function OccurrenceCard({ occurrence, onUpdated }: { occurrence: Occurrence; onUpdated: () => void }) {
  const [resolving, setResolving] = useState(false)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function updateStatus(body: { status: Status; note?: string }) {
    setSending(true)
    setError(null)

    try {
      const response = await fetch(`${apiUrl}/occurrences/${occurrence._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const { message } = await response.json()
        setError(message)
        return
      }

      setResolving(false)
      setNote('')
      onUpdated()
    } catch {
      setError('Não foi possível atualizar a ocorrência.')
    } finally {
      setSending(false)
    }
  }

  function handleResolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateStatus({ status: 'resolved', note })
  }

  function cancelResolve() {
    setResolving(false)
    setNote('')
    setError(null)
  }

  return (
    <li className="card">
      <div className="card-header">
        <span className={`badge severity-${occurrence.severity}`}>Severidade {occurrence.severity}</span>
        <strong className="type">{typeLabels[occurrence.type] ?? occurrence.type}</strong>
        <span className={`badge status-${occurrence.status}`}>{statusLabels[occurrence.status]}</span>
      </div>

      <dl className="details">
        <div>
          <dt>Site</dt>
          <dd>{occurrence.siteId}</dd>
        </div>
        <div>
          <dt>Última detecção</dt>
          <dd>{new Date(occurrence.detectedAt).toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>Prioridade</dt>
          <dd>{occurrence.priority}</dd>
        </div>
        {occurrence.count > 1 && (
          <div>
            <dt>Detecções</dt>
            <dd>{occurrence.count}</dd>
          </div>
        )}
      </dl>

      {occurrence.note && (
        <p className="note">
          <strong>Nota:</strong> {occurrence.note}
        </p>
      )}

      {occurrence.status === 'open' && (
        <div className="actions">
          <button onClick={() => updateStatus({ status: 'acknowledged' })} disabled={sending}>
            {sending ? 'Enviando...' : 'Reconhecer'}
          </button>
        </div>
      )}

      {occurrence.status === 'acknowledged' && !resolving && (
        <div className="actions">
          <button onClick={() => setResolving(true)}>Resolver</button>
        </div>
      )}

      {resolving && (
        <form className="resolve-form" onSubmit={handleResolve}>
          <textarea
            aria-label="Nota de resolução"
            placeholder="Descreva como a ocorrência foi resolvida"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            autoFocus
          />
          <div className="actions">
            <button type="submit" disabled={sending || note.trim() === ''}>
              {sending ? 'Enviando...' : 'Confirmar'}
            </button>
            <button type="button" className="secondary" onClick={cancelResolve} disabled={sending}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error && <p className="message error">{error}</p>}
    </li>
  )
}

export default App
