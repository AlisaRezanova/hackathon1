// Local fallback used only when the backend itself is unreachable (Docker
// down, dev-time UI polishing offline) — see shared/http.ts. This is
// deliberately much simpler than the backend's real heuristic
// (backend/app/features/interviews/heuristic.py): the backend's own
// heuristic-fallback (no LLM key/call failure) is the one that has to look
// good for the actual demo scenario, this one only keeps the screen from
// breaking when there's no API at all.

import type { ChatResponse, ChatTurn, InterviewListItem, Passport } from './types'

export const DEPARTMENT_OPTIONS = ['Разработка', 'Продажи', 'Поддержка', 'HR', 'Маркетинг']

const BASE_QUESTIONS = [
  'В каком отделе вы работали?',
  'Какая у вас была должность?',
  'Опишите своими словами главную причину, по которой вы уходите.',
]

const FALLBACK_FOLLOWUPS = [
  'Что конкретно произошло в последний раз, когда эта проблема стала особенно заметна?',
  'Вы пытались как-то решить это сами или обсудить с кем-то? Что именно вы делали?',
  'Как на это отреагировали — руководитель или компания что-то предприняли, или ситуация ' +
    'осталась без изменений?',
]

const MAX_FOLLOWUPS = FALLBACK_FOLLOWUPS.length

export function localNextChatStep(turns: ChatTurn[]): ChatResponse {
  const step = turns.length + 1
  if (step <= BASE_QUESTIONS.length) {
    return {
      question: BASE_QUESTIONS[step - 1],
      done: false,
      step,
      kind: 'base',
      generated_by: 'heuristic',
      department_options: step === 1 ? DEPARTMENT_OPTIONS : null,
    }
  }
  const followupIndex = step - BASE_QUESTIONS.length
  if (followupIndex > MAX_FOLLOWUPS) {
    return {
      question: null,
      done: true,
      step: step - 1,
      kind: 'followup',
      generated_by: 'heuristic',
    }
  }
  return {
    question: FALLBACK_FOLLOWUPS[followupIndex - 1],
    done: false,
    step,
    kind: 'followup',
    generated_by: 'heuristic',
  }
}

// Small keyword set — just enough that the offline path still produces a
// plausible, non-empty passport instead of a wall of "Другое".
const CATEGORY_KEYWORDS: [string, string][] = [
  ['зарплат', 'Компенсация'],
  ['деньг', 'Компенсация'],
  ['оклад', 'Компенсация'],
  ['руководител', 'Проблемы с руководством'],
  ['начальник', 'Проблемы с руководством'],
  ['рост', 'Карьерный рост'],
  ['карьер', 'Карьерный рост'],
  ['развит', 'Карьерный рост'],
  ['выгор', 'Перегрузка и выгорание'],
  ['нагрузк', 'Перегрузка и выгорание'],
  ['процесс', 'Процессы и согласования'],
  ['согласован', 'Процессы и согласования'],
  ['бюрократ', 'Процессы и согласования'],
]

function splitSentences(text: string): string[] {
  return text
    .replace(/\n/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(/^[—–-]+\s*/, ''))
    .filter(Boolean)
}

export function localAnalyze(transcript: string): Passport {
  const sentences = splitSentences(transcript)
  const counts: Record<string, number> = {}
  const categories: Passport['categories'] = []

  for (const sentence of sentences) {
    const lowered = sentence.toLowerCase()
    for (const [kw, category] of CATEGORY_KEYWORDS) {
      if (lowered.includes(kw)) {
        counts[category] = (counts[category] ?? 0) + 1
        categories.push({
          category,
          subtype: 'офлайн-режим (backend недоступен)',
          quote: sentence,
          mentions: 1,
        })
        break
      }
    }
  }

  const primary =
    Object.keys(counts).length > 0
      ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
      : 'Другое'

  return {
    primary_category: primary,
    risk_zone: categories.length >= 2 ? 'medium' : 'low',
    categories:
      categories.length > 0
        ? categories
        : [
            {
              category: 'Другое',
              subtype: 'не удалось классифицировать офлайн',
              quote: sentences[0] ?? transcript.slice(0, 120),
              mentions: 1,
            },
          ],
    best_practices: [],
    improvement_suggestions: [
      'Backend недоступен — это упрощённый офлайн-разбор. Поднимите backend (`make dev`) для полного анализа.',
      'Соберите похожую обратную связь ещё с нескольких сотрудников для проверки гипотезы.',
      'Назначьте ответственного за проверку этой проблемы в течение месяца.',
    ],
    sentiment_arc: [0, 0, 0],
    preventability: 'medium',
    preventability_reason: 'Офлайн-режим: точная оценка предотвратимости требует backend.',
    generated_by: 'heuristic',
  }
}

export const mockInterviewList: InterviewListItem[] = [
  {
    id: -1,
    employee_alias: 'Демо (мок, backend недоступен)',
    position: 'Backend-разработчик',
    department: 'Разработка',
    interview_date: new Date().toISOString().slice(0, 10),
    source: 'seed',
    primary_category: 'Процессы и согласования',
    risk_zone: 'medium',
    generated_by: 'heuristic',
  },
]
