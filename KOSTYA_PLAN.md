# План Кости — `features/interviews` (Exit Intelligence)

Рабочий документ для себя/следующей сессии, если текущая прервётся. Не часть
согласованного шва — можно удалить перед финальным коммитом или оставить,
конфликтов с `features/analytics` нет. Источники: `HACKATHON.md`,
`hackathon-vibecoding-guide.md`, `ЭКЗИТ ИНТЕРВЬЮ (1).docx`, `backend/app/models.py`
(заморожено), `backend/scripts/seed.py` (заморожено).

## Ветка
`feature/interviews` (уже создана, чистая).

## Что делаю
Живое AI-интервью на `/interviews`: 3 фиксированных вопроса → до 3 уточняющих от
LLM (OpenRouter, ключ уже в `.env`) → «паспорт проблемы» (`ExitAnalysis`), с
heuristic-fallback при пустом ключе/сбое LLM. Не трогаю `features/analytics/*`,
`models.py`, `seed.py`, `main.py`, `router.tsx`, `config.py`, `docker-compose.yaml`,
`Makefile`.

## Backend — `backend/app/features/interviews/`
- [x] `schemas.py` — `ChatTurn`, `ChatRequest`, `ChatResponse` (`question, done, step,
      kind: base|followup, generated_by`), `AnalyzeRequest` (`turns` или `transcript`
      + `department`/`position`), `PassportOut`, `InterviewListItem`.
- [x] `questions.py` — 3 фиксированных вопроса (отдел / должность / главная проблема
      своими словами) + резервные уточняющие по ключевым словам ответа.
- [x] `llm.py` — тонкий httpx-клиент OpenRouter, таймаут ~15с, любая ошибка → `None`
      (никогда не бросает).
- [x] `heuristic.py` — словарь маркеров → `categories` (цитаты — реальные предложения
      из транскрипта), `risk_zone`, `best_practices`, `improvement_suggestions` (≥3),
      `sentiment_arc` по лексикону.
- [x] `service.py` — пайплайн: LLM → валидация схемой → проверка, что каждая цитата
      реально есть в транскрипте (анти-галлюцинация из кейса) → иначе heuristic;
      сохранение `ExitInterview(source="chat")` + `ExitAnalysis`. Категории по
      возможности сопоставлять с уже существующими в seed (см. список ниже), чтобы
      дашборд Алисы агрегировал, а не плодил дубли.
- [x] `router.py` — `POST /api/interviews/chat` (stateless, история от клиента),
      `POST /api/interviews/analyze` (сохраняет), `GET /api/interviews` (seed+chat),
      `GET /api/interviews/{id}`. `/api/interviews/ping` оставить — его дергает
      `backend/tests/test_health.py`.
- [x] `backend/tests/test_interviews.py` — шаги чата, fallback без ключа, эвристика на
      транскрипте из seed. Без реальной БД/сети. 10/10 зелёные, lint чист.
- [x] Ручная проверка через реальный Docker backend (образ был закеширован локально,
      `docker compose up -d --wait db backend`, код монтируется volume'ом): полный
      чат (3 базовых + 3 LLM-уточняющих через реальный OpenRouter-ключ) → `analyze`
      с `generated_by: "llm"` и валидными цитатами → `GET /api/interviews` видит и
      seed, и chat-интервью вперемешку. Heuristic-путь тоже проверен (без ключа).
      Нашёл и исправил баг: без точки в конце ответа эвристика склеивала цитату со
      следующим вопросом (`_transcript_from_turns` теперь всегда завершает ответ
      точкой) — добавлен regression-тест.

Существующие категории в seed (сопоставлять новые ответы с ними, где уместно):
`Процессы и согласования`, `Компенсация`, `Карьерный рост`, `Проблемы с
руководством`, `Перегрузка и выгорание`.

## Frontend — `frontend/src/features/interviews/`
- [ ] `types.ts`, `api.ts` (реальные вызовы через `withMockFallback` из
      `shared/http.ts`), `mocks.ts` (офлайн: локальные вопросы + мок-паспорт с
      пометкой mock).
- [ ] `ui.tsx` + `ChatPanel`, `PassportCard`, `SentimentArc` (inline SVG, без новых
      npm-зависимостей), `TranscriptModal`, свой `interviews.css`.
- [ ] Чат: пузыри вопрос/ответ, прогресс "Вопрос N · уточняющий", бейдж LLM/резерв,
      быстрые кнопки-отделы на вопросе про отдел.
- [ ] Паспорт: `primary_category` + `risk_zone` бейдж, категории →
      подтип → цитата (с частотой), best practices с цитатами, ≥3 гипотезы, график
      sentiment_arc, бейдж `llm`/`heuristic`, кнопки "На дашборд →" и "Новое интервью".
- [ ] Модалка "вставить готовый транскрипт" (TextArea + отдел/должность + кнопка
      "подставить пример") — fallback-путь для демо.
- [ ] История интервью (`GET /api/interviews`) в Drawer.

## Порядок (вертикальные срезы)
1. Backend `chat`(фикс.+резервные вопросы) + `analyze` на эвристике + `list` →
   минимальный чат и паспорт на фронте, весь путь работает офлайн. **Коммит.**
2. Подключить OpenRouter (уточняющие вопросы + анализ), валидация цитат, fallback.
3. Полировка: sentiment-график, история, модалка вставки, ссылка на аналитику.
4. Тесты backend.
5. За 15–20 мин до конца: `make check`, ручной прогон `/interviews` → `/analytics`,
   финальный коммит (свести оба маршрута через Sidebar — уже сделано в `router.tsx`).

## Известные ограничения (проговорить на презентации)
- В `ExitAnalysis` нет отдельных полей `exit_reason`/`pain_points` из текста кейса —
  их роль играют `primary_category`/`categories` (freeform, с кластеризацией).
- Реплики чата построчно не хранятся, только итоговый транскрипт-транскрипция.

## Заметка от пользователя (важно для value proposition) — реализовано
1. **Нормализация категорий**: перед сохранением LLM получает список уже известных
   категорий (из БД + базовые 5) и явную инструкцию — выбирать существующую, если
   подходит по смыслу, и заводить новую только когда действительно нет подходящей.
   См. `llm.py::_ANALYZE_SYSTEM_PROMPT_TEMPLATE`, `service.py` (query distinct
   `primary_category` + `heuristic.KNOWN_CATEGORIES`).
2. **Уточняющие вопросы — добыча доказательств, а не просто разговор**: вместо
   "задай ещё вопрос" модель должна закрывать слоты WHAT/WHY/DURATION/ACTION/
   REACTION и сама выбирает самый информативный незакрытый слот (промпт с
   хорошим/плохим примером — см. `llm.py::_FOLLOWUP_SYSTEM_PROMPT`). Резервные
   (без LLM) вопросы тоже переписаны как "лестницы" WHAT→ACTION→REACTION на
   категорию, а не общие "расскажите подробнее" — `questions.py`.
3. **Preventability**: не трогая заморозку `models.py`, добавлено вычисляемое поле
   в `PassportOut` (`preventability` + `preventability_reason`), которое либо
   приходит от LLM вместе с анализом, либо детерминированно выводится из
   `risk_zone`/`categories`/`best_practices` (`heuristic.derive_preventability`) —
   пересчитывается даже для старых/seed-записей при чтении, так что поле есть
   везде без миграций.

## Баги, найденные и исправленные при live-тестировании
- **Зависание `/api/interviews/analyze` на десятки секунд без ответа**: reasoning-
  модель через OpenRouter шлёт keep-alive байты во время "размышления", из-за чего
  таймер чтения httpx (`timeout=15.0`) не срабатывал — реальный wall-clock лимит
  теперь через `ThreadPoolExecutor` + `future.result(timeout=...)` в `llm.py`
  (`_FOLLOWUP_TIMEOUT=12s`, `_ANALYZE_TIMEOUT=20s`).
- **`UniqueViolation` на второй "безотдельный" анализ**: `_resolve_department`
  искал существующий отдел по имени только когда имя было передано явно, поэтому
  дефолтное "Другое" каждый раз пыталось вставиться заново. Починено — лукап
  всегда идёт по финальному кандидату.

## Кейсы для демо-примеров (от пользователя, 10 шт.)
Не идут в `seed.py` (заморожен, общий с Алисой) — использую как примеры в модалке
"вставить готовый транскрипт" на фронте (`frontend/src/features/interviews/`),
чтобы демо показывало разнообразные причины (бюрократия, потолок роста, токсичный
конфликт/здоровье, контроффер и медленный HR, накопленное выгорание, отсутствие
смысла/апатия, плохой руководитель, декрет, автономия/регламенты, нет фидбэка).

## Статус
Backend полностью реализован и закоммичен (первый коммит), плюс раунд улучшений
по заметке выше — ещё не закоммичен на момент записи. Дальше: фронтенд.
