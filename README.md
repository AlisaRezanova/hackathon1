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
| `make prod`         | прод локально: поднимает db+backend+frontend из `infra/docker-compose.prod.yml` (фронт собирается внутри docker build), накатывает схему |
| `make prod-down`    | останавливает прод-контейнеры (данные БД сохраняются)             |
| `make prod-logs`    | логи прод-backend                                                |
| `make deploy`       | выкатить весь проект на сервер (`DEPLOY_HOST`) по rsync + поднять там прод-стек (+ deploy-оверлей) |
| `make deploy-logs`  | логи прод-backend на сервере                                     |
| `make test`         | тесты backend (pytest) + frontend (vitest)                       |
| `make lint`         | линт backend (ruff) + frontend (oxlint)                          |
| `make fmt`          | автоформат backend (ruff) + frontend (prettier)                  |
| `make check`        | `test` + `lint` — гонять после каждой фичи                       |

## Деплой (prod)

Compose-файлы и конфиг nginx лежат в [`infra/`](./infra):
- `docker-compose.yaml` — dev;
- `docker-compose.prod.yml` — прод (db + backend + `frontend` = свой образ nginx,
  собранный из `infra/Dockerfile.frontend`: фронт собирается внутри docker build,
  локальный npm не нужен); самодостаточен, годится и для локальной проверки;
- `docker-compose.deploy.yml` — оверлей поверх прод-файла, только для реального
  сервера (подключает `frontend` к сети внешнего reverse-proxy, см. ниже);
- `nginx/hackathon.conf` — конфиг nginx, встраивается в образ фронта при сборке.

### Локально (просто поднять прод-стек рядом с dev)

```bash
cp infra/.env.prod.example infra/.env.prod   # заполнить POSTGRES_PASSWORD, CORS_ORIGINS и т.д.
make prod                                    # db+backend+frontend в Docker, схема+демоданные
# фронт на http://localhost:18080
```

### На сервер (уже настроено, `make deploy` обновляет существующий стек)

Сервер (`DEPLOY_HOST=hr.ec9.ru`, каталог `/opt/hackathon1`) уже держит свой
reverse-proxy (Caddy) под другой проект на 80/443 — свой nginx/certbot туда не
встанет, порт физически занят. Поэтому наш `frontend`-контейнер порт наружу не
публикует, а декларативно (через `infra/docker-compose.deploy.yml`) подключается
ко внутренней docker-сети того Caddy под именем `hackathon-frontend`. В Caddyfile
на сервере уже настроен (один раз, вручную) site-блок:

```
hr.ec9.ru {
    reverse_proxy hackathon-frontend:80
}
```

Обновить прод после изменений — из репозитория:

```bash
make deploy          # rsync проекта на DEPLOY_HOST + docker compose up --build + seed
```

`infra/.env.prod` на сервере создан вручную один раз и никогда не перезаписывается
rsync'ом (исключён явно). Имя compose-проекта (`hackathon1`, задано в
`infra/docker-compose.prod.yml`) и путь (`/opt/hackathon1`) совпадают с тем, что уже
реально поднято на сервере — `make deploy` обновляет существующие контейнеры, а не
поднимает рядом второй параллельный стек. `make deploy` идемпотентен: повторный
запуск пересобирает и передеплоивает только изменившиеся образы, сетевой алиас
переустанавливается декларативно при каждом `up` (никакой ручной команды после
пересоздания контейнера не требуется).

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
