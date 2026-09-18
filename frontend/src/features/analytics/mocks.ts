import type { AnalyticsSummary, CategoryDrilldown } from './types'

// Offline fallback — mirrors the real aggregation over the 12 seed
// interviews, so the dashboard looks identical whether the backend is up
// or not.
export const mockAnalyticsSummary: AnalyticsSummary = {
  total_interviews: 12,
  category_breakdown: [
    { category: 'Карьерный рост', count: 5, percent: 41.7 },
    { category: 'Компенсация', count: 3, percent: 25.0 },
    { category: 'Проблемы с руководством', count: 2, percent: 16.7 },
    { category: 'Процессы и согласования', count: 1, percent: 8.3 },
    { category: 'Перегрузка и выгорание', count: 1, percent: 8.3 },
  ],
  department_risk: [
    { department: 'Продажи', total: 3, low: 0, medium: 1, high: 2, high_percent: 66.7 },
    { department: 'Поддержка', total: 2, low: 0, medium: 1, high: 1, high_percent: 50.0 },
    { department: 'Разработка', total: 4, low: 2, medium: 2, high: 0, high_percent: 0.0 },
    { department: 'HR', total: 1, low: 1, medium: 0, high: 0, high_percent: 0.0 },
    { department: 'Маркетинг', total: 2, low: 0, medium: 2, high: 0, high_percent: 0.0 },
  ],
}

const mockDrilldowns: Record<string, CategoryDrilldown> = {
  'Карьерный рост': {
    category: 'Карьерный рост',
    total_mentions: 9,
    interview_count: 6,
    subtypes: [
      { subtype: 'однообразные задачи без развития', count: 1 },
      { subtype: 'нет ротации и обучения', count: 1 },
      { subtype: 'нет трека до lead-роли', count: 1 },
      { subtype: 'нет обратной связи по развитию', count: 1 },
      { subtype: 'нет перехода SDR → AE', count: 1 },
      { subtype: 'AE-позиции закрываются извне', count: 1 },
      { subtype: 'роль без управленческих полномочий', count: 1 },
      { subtype: 'обещания без изменений', count: 1 },
      { subtype: 'нет управленческой HR-позиции', count: 1 },
    ],
    quotes: [
      {
        quote: 'Полгода тестирую одну и ту же форму регистрации',
        department: 'Разработка',
        position: 'QA-инженер',
      },
      {
        quote: 'позиции senior/lead DevOps тут просто нет',
        department: 'Разработка',
        position: 'DevOps-инженер',
      },
      {
        quote: 'хотел вырасти в Account Executive, но позиции не освобождаются',
        department: 'Продажи',
        position: 'Sales Development Rep',
      },
      {
        quote: 'по факту всё ещё разбираю тикеты наравне со всеми',
        department: 'Поддержка',
        position: 'Тимлид поддержки',
      },
      {
        quote: 'следующий шаг, которого здесь пока нет',
        department: 'HR',
        position: 'HR-бизнес-партнёр',
      },
    ],
    summary:
      '«Карьерный рост» встречается в 6 из 12 интервью (9 упоминаний). Основные подтипы: ' +
      'однообразные задачи без развития, нет ротации и обучения, нет трека до lead-роли. ' +
      'Частое предложение по улучшению: «Ввести ротацию задач между сотрудниками раз в квартал».',
    generated_by: 'heuristic',
  },
  Компенсация: {
    category: 'Компенсация',
    total_mentions: 4,
    interview_count: 3,
    subtypes: [
      { subtype: 'нет ежегодного пересмотра зарплаты', count: 1 },
      { subtype: 'непрозрачные грейды', count: 1 },
      { subtype: 'снижение бонусного процента', count: 1 },
      { subtype: 'ставка не растёт с нагрузкой', count: 1 },
    ],
    quotes: [
      {
        quote: 'зарплату не пересматривали два года, хотя я просил на каждом ревью',
        department: 'Разработка',
        position: 'Frontend-разработчик',
      },
      {
        quote: 'процент с продажи наоборот срезают',
        department: 'Продажи',
        position: 'Менеджер по продажам',
      },
      {
        quote: 'Ставка не менялась полтора года, хотя объём задач вырос',
        department: 'Маркетинг',
        position: 'Контент-специалист',
      },
    ],
    summary:
      '«Компенсация» встречается в 3 из 12 интервью (4 упоминаний). Основные подтипы: нет ' +
      'ежегодного пересмотра зарплаты, непрозрачные грейды, снижение бонусного процента. ' +
      'Частое предложение по улучшению: «Ввести ежегодный пересмотр зарплаты по рынку».',
    generated_by: 'heuristic',
  },
  'Проблемы с руководством': {
    category: 'Проблемы с руководством',
    total_mentions: 4,
    interview_count: 3,
    subtypes: [
      { subtype: 'микроменеджмент', count: 1 },
      { subtype: 'критерии не фиксируются заранее', count: 1 },
      { subtype: 'руководитель на связи только в авралах', count: 1 },
      { subtype: 'частая смена приоритетов без объяснений', count: 1 },
    ],
    quotes: [
      {
        quote: 'Постоянно переделывает мои сделки по-своему',
        department: 'Продажи',
        position: 'Account Executive',
      },
      {
        quote: 'руководитель обычно на связи только когда что-то горит',
        department: 'Поддержка',
        position: 'Специалист поддержки',
      },
      {
        quote: 'В понедельник говорят делать одно, в среду — уже совсем другое',
        department: 'Маркетинг',
        position: 'Growth-аналитик',
      },
    ],
    summary:
      '«Проблемы с руководством» встречается в 3 из 12 интервью (4 упоминаний). Основные ' +
      'подтипы: микроменеджмент, критерии не фиксируются заранее, руководитель на связи ' +
      'только в авралах. Частое предложение по улучшению: «Фиксировать ожидания и критерии ' +
      'по сделке до начала работы».',
    generated_by: 'heuristic',
  },
  'Процессы и согласования': {
    category: 'Процессы и согласования',
    total_mentions: 3,
    interview_count: 2,
    subtypes: [
      { subtype: 'долгое согласование ТЗ', count: 1 },
      { subtype: 'переделки после старта работ', count: 1 },
      { subtype: 'план меняется в середине периода', count: 1 },
    ],
    quotes: [
      {
        quote: 'мы полгода обсуждаем ТЗ, а потом переделываем за неделю',
        department: 'Разработка',
        position: 'Backend-разработчик',
      },
      {
        quote: 'не менять план в середине квартала',
        department: 'Продажи',
        position: 'Менеджер по продажам',
      },
    ],
    summary:
      '«Процессы и согласования» встречается в 2 из 12 интервью (3 упоминаний). Основные ' +
      'подтипы: долгое согласование ТЗ, переделки после старта работ, план меняется в ' +
      'середине периода. Частое предложение по улучшению: «Сократить цепочку согласования ' +
      'ТЗ до 1-2 ответственных».',
    generated_by: 'heuristic',
  },
  'Перегрузка и выгорание': {
    category: 'Перегрузка и выгорание',
    total_mentions: 1,
    interview_count: 1,
    subtypes: [{ subtype: 'хроническая перегрузка без роста штата', count: 1 }],
    quotes: [
      {
        quote: 'Нагрузка выросла в два раза, а людей не добавили',
        department: 'Поддержка',
        position: 'Специалист поддержки',
      },
    ],
    summary:
      '«Перегрузка и выгорание» встречается в 1 из 12 интервью (1 упоминаний). Основные ' +
      'подтипы: хроническая перегрузка без роста штата. Частое предложение по улучшению: ' +
      '«Пересмотреть KPI по нагрузке на одного специалиста».',
    generated_by: 'heuristic',
  },
}

export function mockCategoryDrilldown(category: string): CategoryDrilldown {
  return (
    mockDrilldowns[category] ?? {
      category,
      total_mentions: 0,
      interview_count: 0,
      subtypes: [],
      quotes: [],
      summary: `Нет данных по категории «${category}» (офлайн-режим).`,
      generated_by: 'heuristic',
    }
  )
}
