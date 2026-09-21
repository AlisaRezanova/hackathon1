# Exit Intelligence — HR-прототип хакатона

Прототип для двухчасового хакатона по вайбкодингу: AI сам проводит exit-интервью с
уходящим сотрудником (чат с уточняющими вопросами), превращает его в структурированный
"паспорт проблемы", а из всех интервью — в кластеризованный дашборд топ-причин ухода по
компании с drill-down до конкретных цитат. Стек: React + TypeScript + Vite (frontend,
локально), FastAPI + SQLAlchemy 2.0 + PostgreSQL (backend, в Docker), OpenRouter для LLM с
эвристическим fallback. Сценарий демо и разделение работы — в
[`HACKATHON.md`](./HACKATHON.md); общие правила — в [`CLAUDE.md`](./CLAUDE.md), контекст
подготовки — в [`hackathon-vibecoding-guide.md`](./hackathon-vibecoding-guide.md).

## Быстрый старт

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
make install   # зависимости backend + frontend
make dev       # db + backend в Docker, frontend локально (vite)
```

Frontend: http://localhost:5173 · Backend: http://localhost:8000 · Swagger:
http://localhost:8000/docs

Без ключа `OPENROUTER_API_KEY` в `.env` всё продолжает работать на эвристическом fallback
(и чат-интервью, и LLM-саммари в аналитике) — на UI в этом случае видна метка `heuristic`
вместо `llm`.

## Сценарий использования

- `/app` (HR-приложение, сайдбар Обзор / Exit-интервью / Аналитика):
  - **Обзор** (`/app`) — сводка: агрегаты по компании + таблица последних интервью с
    причиной ухода и уровнем риска.
  - **Exit-интервью** (`/app/interviews`) — HR либо сам проходит чат-интервью, либо
    генерирует персональную ссылку `/interview/:token` для сотрудника (страница без
    сайдбара, только чат) — либо вставляет готовый транскрипт как быстрый fallback-путь.
    Бот задаёт 3 фиксированных вопроса (отдел, должность, главная проблема своими
    словами), затем до 3 уточняющих вопросов через LLM, и в конце показывает "паспорт
    проблемы": `primary_category`, `risk_zone`, кластеризованные `categories`
    (категория → подтип → цитата), `best_practices`, `improvement_suggestions`,
    `sentiment_arc`. Видно, кто это построил — `llm` или `heuristic`.
  - **Аналитика** (`/app/analytics`) — % интервью по категориям, risk по отделам,
    drill-down по категории (AI-саммари кластера, подтипы, цитаты, рекомендации по
    исправлению) и по отделу.
- `/interview/:token` — отдельная точка входа для сотрудника: только чат-интервью, без
  доступа к остальному приложению (см. `router.tsx`).

## Команды (Makefile)

| Команда             | Что делает                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `make install`      | ставит зависимости backend + frontend                            |
| `make dev`          | поднимает db+backend в Docker и запускает frontend (`npm run dev`) |
| `make db-up`        | поднимает только Postgres                                        |
| `make back-up`      | поднимает db+backend и накатывает демоданные                     |
| `make seed`         | создаёт таблицы (если их нет) и засеивает демоданные, идемпотентно |
| `make reset-data`   | сбрасывает БД (volume) и поднимает стек заново с демоданными      |
| `make down`         | останавливает все контейнеры                                     |
| `make prod`         | прод: поднимает db+backend из `infra/docker-compose.prod.yml`, накатывает схему, собирает фронт в `frontend/dist` |
| `make prod-down`    | останавливает прод-контейнеры (данные БД сохраняются)             |
| `make prod-logs`    | логи прод-backend                                                |
| `make test`         | тесты backend (pytest) + frontend (vitest)                       |
| `make lint`         | линт backend (ruff) + frontend (oxlint)                          |
| `make fmt`          | автоформат backend (ruff) + frontend (prettier)                  |
| `make check`        | `test` + `lint` — гонять после каждой фичи                       |

## Деплой (prod)

Compose-файлы и конфиг nginx лежат в [`infra/`](./infra): `docker-compose.yaml` — dev,
`docker-compose.prod.yml` — прод, `nginx/hackathon.conf` — шаблон конфига nginx.

```bash
cp infra/.env.prod.example infra/.env.prod   # заполнить POSTGRES_PASSWORD, CORS_ORIGINS и т.д.
make prod                                    # backend+db в Docker, фронт -> frontend/dist
```

Затем скопировать `frontend/dist` в root nginx (например `/var/www/hackathon`) и подключить
`infra/nginx/hackathon.conf` — инструкции в самом файле. `make prod` заливает и демоданные
(`scripts.seed` — единственное, что создаёт таблицы).

## Структура

```
backend/app/
  main.py, db.py, config.py       заморожено — шов: include_router для обеих фич
  models.py                       заморожено — Department/ExitInterview/ExitAnalysis
  features/interviews/            router.py, service.py, questions.py — чат + анализ,
                                   llm.py + heuristic.py — LLM-пайплайн с fallback
  features/analytics/             router.py — summary/drill-down, llm.py — саммари кластеров
backend/scripts/seed.py           заморожено — 5 отделов + 12 демо-транскриптов с анализом

frontend/src/
  App.tsx, router.tsx             заморожено — /app/* (HR) и /interview/:token (сотрудник)
  pages/Home.tsx                  Обзор — агрегаты + таблица последних интервью
  shared/ui/                      готовый набор компонентов (см. ниже)
  shared/http.ts                  заморожено — fetch + переключатель моков
  features/interviews/            ui.tsx (чат + паспорт + генерация ссылки), api.ts, types.ts
  features/analytics/             ui.tsx (дашборд + drill-down), api.ts, types.ts
```

Разделение работы, сценарий демо и критерии готовности — в [`HACKATHON.md`](./HACKATHON.md).

## Готовые UI-компоненты (`frontend/src/shared/ui`)

Layout/Sidebar/Header, Card/StatCard, DataTable, Field/Input/Select/TextArea, Modal, Drawer,
Toast, LoadingState/EmptyState/ErrorState, Button, Badge.

## Известные ограничения

- Без авторизации, миграций (Alembic) и CI — сознательно, см. `CLAUDE.md`.
- Ссылка `/interview/:token` не проверяется на backend — это чисто клиентская маршрутизация
  для демо, а не защищённый доступ.
- Frontend-фичи используют мок-fallback (`shared/http.ts::withMockFallback`), если backend
  недоступен — полезно при офлайн-полировке UI.
- Чат жёстко ограничен 3 базовыми + до 3 уточняющих вопроса — предсказуемое по времени и
  стоимости демо, не свободный диалог.
