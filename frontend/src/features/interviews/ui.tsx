import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { analyzeInterview, fetchInterviewDetail, fetchInterviews, fetchNextChatStep } from './api'
import './interviews.css'
import { SAMPLE_TRANSCRIPTS } from './sampleTranscripts'
import { Badge } from '../../shared/ui/Badge'
import { Button } from '../../shared/ui/Button'
import { Card } from '../../shared/ui/Card'
import { Drawer } from '../../shared/ui/Drawer'
import { Field, Input, Select, TextArea } from '../../shared/ui/Form'
import { Header } from '../../shared/ui/Header'
import { Modal } from '../../shared/ui/Modal'
import { EmptyState, ErrorState, LoadingState } from '../../shared/ui/States'
import { useToast } from '../../shared/ui/toastContext'
import type {
  ChatResponse,
  ChatTurn,
  GeneratedBy,
  InterviewDetail,
  InterviewListItem,
  Passport,
  Preventability,
  RiskZone,
} from './types'

const TOTAL_QUESTIONS_HINT = 6 // 3 base + up to 3 follow-ups — for the progress dots only

const riskTone: Record<RiskZone, 'default' | 'amber' | 'danger'> = {
  low: 'default',
  medium: 'amber',
  high: 'danger',
}
const riskLabel: Record<RiskZone, string> = {
  low: 'Низкий риск',
  medium: 'Средний риск',
  high: 'Высокий риск',
}

const preventabilityTone: Record<Preventability, 'neutral' | 'amber' | 'danger'> = {
  low: 'neutral',
  medium: 'amber',
  high: 'danger',
}
const preventabilityLabel: Record<Preventability, string> = {
  low: 'Предотвратимость: низкая',
  medium: 'Предотвратимость: средняя',
  high: 'Предотвратимость: высокая',
}

const generatedByTone: Record<GeneratedBy, 'default' | 'neutral'> = {
  llm: 'default',
  heuristic: 'neutral',
}
const generatedByLabel: Record<GeneratedBy, string> = {
  llm: 'Построено LLM',
  heuristic: 'Резервная эвристика',
}

type Phase = 'chat' | 'analyzing' | 'result'

interface AnsweredTurn extends ChatTurn {
  kind: ChatResponse['kind']
  generated_by: GeneratedBy
}

/**
 * Main screen: an AI-driven exit-interview chat that ends in a "problem
 * passport" (see HACKATHON.md). A quick "paste transcript" path and a
 * history drawer of past interviews (seed + chat) are offered alongside —
 * but only for HR (`/app/interviews`). When opened as `/interview/:token`
 * (`employeeMode`), those are hidden: the link goes to one employee, so it
 * must not expose the company-wide interview history or a link into the
 * analytics dashboard. See router.tsx.
 */
export function InterviewsPage({ employeeMode = false }: { employeeMode?: boolean } = {}) {
  const toast = useToast()
  const [phase, setPhase] = useState<Phase>('chat')
  const [turns, setTurns] = useState<AnsweredTurn[]>([])
  const [currentStep, setCurrentStep] = useState<ChatResponse | null>(null)
  const [draft, setDraft] = useState('')
  const [loadingStep, setLoadingStep] = useState(true)
  const [result, setResult] = useState<{ transcript: string; passport: Passport } | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  // Guards two race conditions that both showed up as "the same question
  // reappears after being answered": (1) a genuine double-submit (e.g. a
  // held Enter key firing keydown twice) launches two identical in-flight
  // requests; (2) an older, slower request (the LLM call timing out before
  // the heuristic fallback kicks in takes ~12s) can resolve AFTER a newer
  // request that already advanced the chat, clobbering it with a stale
  // answer. `requestSeqRef` is bumped synchronously before every request;
  // a response is only applied if it's still the most recent one issued.
  const requestSeqRef = useRef(0)
  function nextRequestToken() {
    requestSeqRef.current += 1
    return requestSeqRef.current
  }

  function startChat() {
    const token = nextRequestToken()
    setPhase('chat')
    setTurns([])
    setResult(null)
    setDraft('')
    setLoadingStep(true)
    fetchNextChatStep([]).then(({ data, usedMock }) => {
      if (token !== requestSeqRef.current) return
      setCurrentStep(data)
      setLoadingStep(false)
      if (usedMock) toast.show('Backend недоступен — интервью идёт офлайн', 'default')
    })
  }

  useEffect(() => {
    startChat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, currentStep])

  async function finishAndAnalyze(finishedTurns: ChatTurn[], token: number) {
    setPhase('analyzing')
    const { data, usedMock } = await analyzeInterview({ turns: finishedTurns })
    if (token !== requestSeqRef.current) return
    if (usedMock) toast.show('Backend недоступен — показан упрощённый офлайн-разбор', 'default')
    setResult({ transcript: data.transcript, passport: data.passport })
    setPhase('result')
  }

  async function submitAnswer(answer: string) {
    const trimmed = answer.trim()
    // `loadingStep` alone isn't a reliable re-entrancy guard: it's React
    // state, so a second call fired before this render commits (e.g. a
    // held Enter key repeating) would still read the old `false` value.
    // Bumping the token synchronously, before anything async, means a
    // same-tick duplicate call gets a *different* token and its eventual
    // response is recognized as stale and ignored below.
    if (!trimmed || !currentStep?.question || loadingStep) return
    const token = nextRequestToken()
    const newTurn: AnsweredTurn = {
      question: currentStep.question,
      answer: trimmed,
      kind: currentStep.kind,
      generated_by: currentStep.generated_by,
    }
    const nextTurns = [...turns, newTurn]
    setTurns(nextTurns)
    setDraft('')
    setLoadingStep(true)
    const { data, usedMock } = await fetchNextChatStep(nextTurns)
    if (token !== requestSeqRef.current) return // a newer request has since started — discard
    if (usedMock) toast.show('Backend недоступен — дальше вопросы офлайн', 'default')
    if (data.done) {
      await finishAndAnalyze(nextTurns, token)
      return
    }
    setCurrentStep(data)
    setLoadingStep(false)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    submitAnswer(draft)
  }

  function handlePasteSubmit(payload: {
    department: string
    position: string
    transcript: string
  }) {
    const token = nextRequestToken()
    setPasteOpen(false)
    setPhase('analyzing')
    analyzeInterview(payload).then(({ data, usedMock }) => {
      if (token !== requestSeqRef.current) return
      if (usedMock) toast.show('Backend недоступен — показан упрощённый офлайн-разбор', 'default')
      setResult({ transcript: data.transcript, passport: data.passport })
      setPhase('result')
    })
  }

  const answeredCount = turns.length
  const progressCurrent = Math.max(
    1,
    currentStep && !currentStep.done ? answeredCount + 1 : answeredCount,
  )

  return (
    <>
      <Header
        eyebrow={employeeMode ? undefined : 'Фича: interviews'}
        title="Exit-интервью → паспорт проблемы"
        actions={
          employeeMode ? undefined : phase === 'chat' ? (
            <>
              <Button variant="secondary" onClick={() => setHistoryOpen(true)}>
                История интервью
              </Button>
              <Button variant="ghost" onClick={() => setPasteOpen(true)}>
                Вставить готовый транскрипт
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setHistoryOpen(true)}>
              История интервью
            </Button>
          )
        }
      />
      <div className="ui-content iv-layout">
        {phase !== 'result' && (
          <Card>
            {phase === 'chat' && (
              <>
                <div className="iv-progress">
                  <span>
                    Вопрос {Math.min(progressCurrent, TOTAL_QUESTIONS_HINT)} · до{' '}
                    {TOTAL_QUESTIONS_HINT} вопросов
                  </span>
                  <div className="iv-progress__dots" aria-hidden="true">
                    {Array.from({ length: TOTAL_QUESTIONS_HINT }, (_, i) => (
                      <span
                        key={i}
                        className={`iv-progress__dot${
                          i < answeredCount
                            ? ' iv-progress__dot--done'
                            : i === answeredCount
                              ? ' iv-progress__dot--current'
                              : ''
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="iv-chat__log" ref={logRef}>
                  {turns.map((t, i) => (
                    <ChatTurnBubbles key={i} turn={t} />
                  ))}
                  {/* Only while NOT loading — the just-answered question is
                      already rendered above as part of `turns`. Without this
                      guard, the same text briefly shows twice (once as
                      history, once as a stale "current" bubble) for the
                      2-3s it takes the next question to arrive. */}
                  {currentStep?.question && !loadingStep && (
                    <div className="iv-bubble iv-bubble--question">
                      {currentStep.question}
                      <span className="iv-bubble__meta">
                        {currentStep.kind === 'followup'
                          ? currentStep.generated_by === 'llm'
                            ? 'уточняющий · LLM'
                            : 'уточняющий · резерв'
                          : 'базовый вопрос'}
                      </span>
                    </div>
                  )}
                  {loadingStep && (
                    <div className="iv-typing" aria-label="Печатает">
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                </div>

                {currentStep?.department_options && !loadingStep && (
                  <div className="iv-quick-replies">
                    {currentStep.department_options.map((dept) => (
                      <Button key={dept} variant="secondary" onClick={() => submitAnswer(dept)}>
                        {dept}
                      </Button>
                    ))}
                  </div>
                )}

                <form className="iv-composer" onSubmit={handleSubmit}>
                  <TextArea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Ваш ответ…"
                    disabled={loadingStep}
                    onKeyDown={(e) => {
                      // `e.repeat` is true for OS key-auto-repeat while a key
                      // is held — without this check, holding Enter even
                      // briefly could fire submitAnswer twice for one answer.
                      if (e.key === 'Enter' && !e.shiftKey && !e.repeat) {
                        e.preventDefault()
                        submitAnswer(draft)
                      }
                    }}
                  />
                  <Button type="submit" disabled={loadingStep || !draft.trim()}>
                    Отправить
                  </Button>
                </form>
              </>
            )}
            {phase === 'analyzing' && <LoadingState label="Строим паспорт проблемы…" />}
          </Card>
        )}

        {phase === 'result' && result && (
          <Card>
            <PassportCard
              transcript={result.transcript}
              passport={result.passport}
              onReset={startChat}
              showDashboardLink={!employeeMode}
            />
          </Card>
        )}
      </div>

      {!employeeMode && pasteOpen && (
        <PasteTranscriptModal onClose={() => setPasteOpen(false)} onSubmit={handlePasteSubmit} />
      )}
      {!employeeMode && historyOpen && <HistoryDrawer onClose={() => setHistoryOpen(false)} />}
    </>
  )
}

function ChatTurnBubbles({ turn }: { turn: AnsweredTurn }) {
  return (
    <>
      <div className="iv-bubble iv-bubble--question">
        {turn.question}
        <span className="iv-bubble__meta">
          {turn.kind === 'followup'
            ? turn.generated_by === 'llm'
              ? 'уточняющий · LLM'
              : 'уточняющий · резерв'
            : 'базовый вопрос'}
        </span>
      </div>
      <div className="iv-bubble iv-bubble--answer">{turn.answer}</div>
    </>
  )
}

function PassportCard({
  transcript,
  passport,
  onReset,
  showDashboardLink = true,
}: {
  transcript: string
  passport: Passport
  onReset: () => void
  showDashboardLink?: boolean
}) {
  const [showTranscript, setShowTranscript] = useState(false)
  const grouped = new Map<string, Passport['categories']>()
  for (const item of passport.categories) {
    grouped.set(item.category, [...(grouped.get(item.category) ?? []), item])
  }

  return (
    <div>
      <div className="iv-passport__head">
        <span className="iv-passport__title">{passport.primary_category}</span>
      </div>
      <div className="iv-passport__badges">
        <Badge tone={riskTone[passport.risk_zone]}>{riskLabel[passport.risk_zone]}</Badge>
        <Badge tone={preventabilityTone[passport.preventability]}>
          {preventabilityLabel[passport.preventability]}
        </Badge>
        <Badge tone={generatedByTone[passport.generated_by]}>
          {generatedByLabel[passport.generated_by]}
        </Badge>
      </div>
      <p className="iv-passport__reason">{passport.preventability_reason}</p>

      {grouped.size > 0 && (
        <div className="iv-section">
          <div className="iv-section__title">Причины ({passport.categories.length})</div>
          {[...grouped.entries()].map(([category, items]) => (
            <div key={category} className="iv-category-group">
              <div className="iv-category-group__name">{category}</div>
              {items.map((item, i) => (
                <div key={i} className="iv-quote-item">
                  <div className="iv-quote-item__body">
                    <div className="iv-quote-item__subtype">{item.subtype}</div>
                    <div className="iv-quote-item__quote">{item.quote}</div>
                  </div>
                  <span className="iv-quote-item__mentions">×{item.mentions}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {passport.best_practices.length > 0 && (
        <div className="iv-section">
          <div className="iv-section__title">Что работает хорошо</div>
          {passport.best_practices.map((item, i) => (
            <div key={i} className="iv-quote-item">
              <div className="iv-quote-item__body">
                <div className="iv-quote-item__subtype">{item.label}</div>
                <div className="iv-quote-item__quote">{item.quote}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="iv-section">
        <div className="iv-section__title">Гипотезы по решению</div>
        <ol className="iv-suggestions">
          {passport.improvement_suggestions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </div>

      <div className="iv-section">
        <div className="iv-section__title">Динамика тона разговора</div>
        <SentimentArc values={passport.sentiment_arc} />
      </div>

      <div className="iv-actions">
        <Button onClick={onReset}>Новое интервью</Button>
        <Button variant="secondary" onClick={() => setShowTranscript((v) => !v)}>
          {showTranscript ? 'Скрыть транскрипт' : 'Показать транскрипт'}
        </Button>
        {showDashboardLink && (
          <Link to="/app/analytics" style={{ textDecoration: 'none' }}>
            <Button variant="ghost">Смотреть на дашборде →</Button>
          </Link>
        )}
      </div>

      {showTranscript && (
        <p
          style={{
            marginTop: 16,
            fontSize: 13.5,
            color: 'var(--ink-soft)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {transcript}
        </p>
      )}
    </div>
  )
}

function SentimentArc({ values }: { values: number[] }) {
  if (values.length === 0) return null
  const width = 320
  const height = 84
  const padY = 8
  const step = values.length > 1 ? width / (values.length - 1) : 0
  const points = values.map((v, i) => {
    const x = values.length > 1 ? i * step : width / 2
    const y = padY + ((1 - v) / 2) * (height - padY * 2)
    return [x, y] as const
  })
  const path = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')
  const midline = padY + (height - padY * 2) / 2

  return (
    <svg
      className="iv-sentiment"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Динамика тона: от ${values[0].toFixed(1)} до ${values[values.length - 1].toFixed(1)}`}
    >
      <line
        x1={0}
        y1={midline}
        x2={width}
        y2={midline}
        stroke="var(--line)"
        strokeDasharray="3 4"
      />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} />
      {points.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={3}
          fill={values[i] < 0 ? 'var(--danger)' : 'var(--accent)'}
        />
      ))}
    </svg>
  )
}

function PasteTranscriptModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (payload: { department: string; position: string; transcript: string }) => void
}) {
  const [department, setDepartment] = useState('Разработка')
  const [position, setPosition] = useState('')
  const [transcript, setTranscript] = useState('')

  function applyExample(index: number) {
    const example = SAMPLE_TRANSCRIPTS[index]
    if (!example) return
    setDepartment(example.department)
    setPosition(example.position)
    setTranscript(example.transcript)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!transcript.trim()) return
    onSubmit({ department, position, transcript: transcript.trim() })
  }

  return (
    <Modal
      title="Вставить готовый транскрипт"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" form="iv-paste-form" disabled={!transcript.trim()}>
            Построить паспорт
          </Button>
        </>
      }
    >
      <div className="iv-example-picker">
        {SAMPLE_TRANSCRIPTS.map((ex, i) => (
          <Button key={ex.label} variant="ghost" onClick={() => applyExample(i)} type="button">
            {ex.label}
          </Button>
        ))}
      </div>
      <form id="iv-paste-form" onSubmit={handleSubmit}>
        <Field label="Отдел" htmlFor="paste-department">
          <Select
            id="paste-department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            {['Разработка', 'Продажи', 'Поддержка', 'HR', 'Маркетинг'].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </Field>
        <Field label="Должность" htmlFor="paste-position">
          <Input
            id="paste-position"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="Например, Backend-разработчик"
          />
        </Field>
        <Field
          label="Транскрипт"
          htmlFor="paste-transcript"
          hint="Текст беседы на увольнении, свободный формат"
        >
          <TextArea
            id="paste-transcript"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            style={{ minHeight: 160 }}
            required
          />
        </Field>
      </form>
    </Modal>
  )
}

function HistoryDrawer({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [items, setItems] = useState<InterviewListItem[]>([])
  const [detail, setDetail] = useState<InterviewDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    fetchInterviews()
      .then(({ data }) => {
        setItems(data)
        setState('ready')
      })
      .catch(() => setState('error'))
  }, [])

  async function openDetail(id: number) {
    setDetailLoading(true)
    const { data } = await fetchInterviewDetail(id)
    setDetail(data)
    setDetailLoading(false)
  }

  return (
    <Drawer
      title={detail ? `${detail.employee_alias} · ${detail.position}` : 'История интервью'}
      onClose={onClose}
    >
      {detail ? (
        <>
          <Button variant="ghost" onClick={() => setDetail(null)} style={{ marginBottom: 12 }}>
            ← Ко всем интервью
          </Button>
          {detailLoading ? (
            <LoadingState />
          ) : detail.passport ? (
            <PassportCard
              transcript={detail.transcript}
              passport={detail.passport}
              onReset={() => setDetail(null)}
            />
          ) : (
            <EmptyState title="Нет анализа" body="У этого интервью ещё нет паспорта проблемы." />
          )}
        </>
      ) : state === 'loading' ? (
        <LoadingState />
      ) : state === 'error' ? (
        <ErrorState body="Не удалось загрузить историю интервью." />
      ) : items.length === 0 ? (
        <EmptyState title="Пока нет интервью" />
      ) : (
        <div>
          {items.map((item) => (
            <button key={item.id} className="iv-history-row" onClick={() => openDetail(item.id)}>
              <div className="iv-history-row__top">
                <span>
                  {item.employee_alias} · {item.position}
                </span>
                {item.risk_zone && (
                  <Badge tone={riskTone[item.risk_zone]}>{riskLabel[item.risk_zone]}</Badge>
                )}
              </div>
              <div className="iv-history-row__meta">
                <span>{item.department}</span>
                <span>·</span>
                <span>{item.interview_date}</span>
                <span>·</span>
                <span>{item.source === 'chat' ? 'из чата' : 'демо-данные'}</span>
                {item.primary_category && (
                  <>
                    <span>·</span>
                    <span>{item.primary_category}</span>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </Drawer>
  )
}
