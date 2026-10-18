# Журнал сделок

Личный журнал: фиксированный риск **1%** от доступного депозита, частичные тейки, касса, график капитала.

Вход через **Google** или почту. Данные хранятся в **Postgres** (Supabase) — один аккаунт на всех устройствах. Есть выгрузка и загрузка `.txt`.

История договорённостей и статусы работ — в папке [`реестр/`](реестр/журнал.md).

## Что нужно

- аккаунт [Vercel](https://vercel.com)
- проект [Supabase](https://supabase.com) (бесплатный план подходит)
- OAuth-клиент Google

## 1. База (Supabase)

1. Создай проект.
2. **Project Settings → Database → Connection string → URI**.
3. Возьми **Transaction pooler** (порт `6543`) и добавь `?pgbouncer=true`.
4. Таблицы создадутся сами при деплое (`npm run build` запускает миграции).

## 2. Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 Client ID → Web application.
2. Authorized JavaScript origins:
   - `https://твой-проект.vercel.app`
3. Authorized redirect URIs:
   - `https://твой-проект.vercel.app/api/auth/callback/google`
4. Скопируй Client ID и Client Secret.

После первого деплоя подставь реальный домен Vercel в эти поля.

## 3. Залить на Vercel

1. Залей папку в GitHub / GitLab / Bitbucket.
2. New Project на Vercel → Import.
3. Framework: **TanStack Start** (или Vite). Build Command: `npm run build`.
4. Environment Variables:

| Имя | Значение |
|---|---|
| `DATABASE_URL` | строка из Supabase |
| `BETTER_AUTH_SECRET` | длинная случайная строка |
| `BETTER_AUTH_URL` | `https://твой-проект.vercel.app` |
| `VITE_AUTH_ENABLED` | `true` |
| `GOOGLE_CLIENT_ID` | из Google Cloud |
| `GOOGLE_CLIENT_SECRET` | из Google Cloud |

5. Deploy.

После смены домена обнови `BETTER_AUTH_URL` и redirect URI в Google, затем Redeploy.

## Локально (по желанию)

```bash
cp .env.example .env
# заполни переменные
npm install
npm run dev
```

Открой http://localhost:3000

## TXT-бэкап

В шапке журнала: **Скачать .txt** / **Загрузить .txt**. Формат: строки `ЖУРНАЛ`, `СТАРТ`, `СДЕЛКА`, `ТЕЙК`, `КАССА` через табуляцию. Загрузка заменяет текущий журнал.

## Как считается

- риск новой сделки = 1% от доступного депозита (капитал минус риск открытых);
- частичный тейк на открытой сделке сразу в P&L, остаток риска остаётся;
- касса — отдельные движения, не сделки.
