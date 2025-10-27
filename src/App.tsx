import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { DiffEntry, DiffResult } from './lib/diff'
import { analyzeJson } from './lib/diff'
import { exampleConfiguration, examplePayload } from './data/examplePayload'

const typeLabels: Record<DiffEntry['type'], string> = {
  missing: 'Missing in actual',
  extra: 'Extra in actual',
  mismatch: 'Value mismatch',
}

const typeStyles: Record<DiffEntry['type'], string> = {
  missing:
    'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-200',
  extra:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200',
  mismatch:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-200',
}

const stringifyValue = (value: unknown): string => {
  if (value === undefined) {
    return '—'
  }

  if (typeof value === 'string') {
    return value
  }

  return JSON.stringify(value, null, 2)
}

const DiffSummary = ({ result }: { result: DiffResult }) => {
  if (!result.differences.length) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-100">
        <p className="text-lg font-semibold">No differences detected</p>
        <p className="text-sm text-emerald-700 dark:text-emerald-200/90">
          The <code className="font-mono">expected</code> and <code className="font-mono">actual</code> JSON blocks match.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-100">
      <p className="text-lg font-semibold">
        {result.differences.length}{' '}
        difference{result.differences.length === 1 ? '' : 's'} found
      </p>
      <p className="text-sm text-amber-700 dark:text-amber-200/90">
        Inspect the list below to see the precise paths and values that diverge.
      </p>
    </div>
  )
}

const DiffList = ({ differences }: { differences: DiffEntry[] }) => (
  <div className="space-y-4">
    {differences.map((diff, index) => (
      <div
        key={`${index}-${diff.path}-${diff.type}`}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="font-mono text-sm text-slate-600 dark:text-slate-300">
            {diff.path || 'root'}
          </p>
          <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${typeStyles[diff.type]}`}>
            {typeLabels[diff.type]}
          </span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Expected</p>
            <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-100 p-3 text-sm text-slate-900 dark:bg-slate-950/60 dark:text-slate-100">
              {stringifyValue(diff.expected)}
            </pre>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Actual</p>
            <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-100 p-3 text-sm text-slate-900 dark:bg-slate-950/60 dark:text-slate-100">
              {stringifyValue(diff.actual)}
            </pre>
          </div>
        </div>
      </div>
    ))}
  </div>
)

const JsonPreview = ({ title, value }: { title: string; value: unknown }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/70">
    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{title}</h3>
    <pre className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-900 dark:text-slate-100">
      {JSON.stringify(value, null, 2)}
    </pre>
  </div>
)

const UnifiedDiffView = ({ diff }: { diff: string }) => {
  if (!diff.trim()) {
    return null
  }

  const lines = diff.trimEnd().split('\n')

  const resolveLineClass = (line: string) => {
    if (line.startsWith('@@')) {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200'
    }
    if (line.startsWith('-') && !line.startsWith('---')) {
      return 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200'
    }
    if (line.startsWith('---') || line.startsWith('+++')) {
      return 'text-slate-500 dark:text-slate-400'
    }

    return 'text-slate-700 dark:text-slate-200'
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/70">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Unified Diff</h3>
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-100 font-mono text-sm dark:border-slate-800/60 dark:bg-slate-950/60">
        {lines.map((line, index) => (
          <div
            key={`${index}-${line}`}
            data-testid="unified-diff-line"
            className={`whitespace-pre-wrap break-words px-4 py-1 ${resolveLineClass(line)}`}
          >
            {line || ' '}
          </div>
        ))}
      </div>
    </div>
  )
}

function App() {
  const [jsonInput, setJsonInput] = useState('')
  const [configInput, setConfigInput] = useState('')

  const diffMutation = useMutation<DiffResult, Error, { payload: string; config: string }>({
    mutationFn: async ({ payload, config }) => analyzeJson(payload, config),
  })

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    diffMutation.mutate({ payload: jsonInput, config: configInput })
  }

  const handleReset = () => {
    setJsonInput('')
    setConfigInput('')
    diffMutation.reset()
  }

  const handleLoadExample = () => {
    setJsonInput(examplePayload)
    setConfigInput(exampleConfiguration)
    diffMutation.reset()
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-10 px-4 py-12 md:px-12">
        <header className="space-y-4">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">JSON Comparator</h1>
          <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Paste a JSON payload that includes <code className="font-mono">expected</code> and <code className="font-mono">actual</code> sections (either at the root level or inside <code className="font-mono">compare_item</code>). Optionally provide the channel configuration JSON to ignore specific paths during comparison. The app will parse the document, compute the diff, and highlight each divergence.
          </p>
        </header>

        <section className="flex flex-col gap-10">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-3">
              <span className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                JSON Payload
              </span>
              <textarea
                value={jsonInput}
                onChange={(event) => setJsonInput(event.target.value)}
                placeholder="Paste JSON here..."
                className="min-h-[420px] rounded-xl border border-slate-300 bg-white p-4 font-mono text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </label>

            <label className="flex flex-col gap-3">
              <span className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Channel Configuration JSON (optional)
              </span>
              <textarea
                value={configInput}
                onChange={(event) => setConfigInput(event.target.value)}
                placeholder={"Paste configuration JSON (e.g. with \"ignore_paths\") here..."}
                className="min-h-[180px] rounded-xl border border-slate-300 bg-white p-4 font-mono text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
              >
                Analyze JSON
              </button>
              <button
                type="button"
                onClick={handleLoadExample}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400/60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white dark:focus:ring-slate-500/60"
              >
                Load example
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-transparent px-4 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400/50 dark:text-slate-400 dark:hover:text-slate-200 dark:focus:ring-slate-500/40"
              >
                Clear
              </button>
            </div>

            {diffMutation.isError && diffMutation.error instanceof Error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-100">
                {diffMutation.error.message}
              </p>
            )}
          </form>

          <div className="flex flex-col gap-6">
            {diffMutation.isPending ? (
              <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-blue-200 bg-blue-50 p-6 text-center text-sm text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200">
                Analyzing JSON diff…
              </div>
            ) : diffMutation.data ? (
              <>
                <DiffSummary result={diffMutation.data} />

                {diffMutation.data.unifiedDiff && (
                  <UnifiedDiffView diff={diffMutation.data.unifiedDiff} />
                )}

                {diffMutation.data.differences.length > 0 && (
                  <section className="space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Differences</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Each item lists the JSON path, the expected value, and the actual value encountered at runtime.
                      </p>
                    </div>
                    <DiffList differences={diffMutation.data.differences} />
                  </section>
                )}

                <section className="grid gap-4 md:grid-cols-2">
                  <JsonPreview title="Expected" value={diffMutation.data.expected} />
                  <JsonPreview title="Actual" value={diffMutation.data.actual} />
                </section>
              </>
            ) : (
              <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-100 p-6 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-500">
                Paste JSON and run the analysis to see the diff here.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
