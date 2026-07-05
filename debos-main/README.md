# debos — Nova AI Workspace

Full-stack AI chat application with React + Vite frontend, Express + TypeScript backend, MongoDB, JWT auth, and Sarvam AI / Grok providers.

## Stack

- **Frontend:** React, Vite (`Debosmita-project/`)
- **Backend:** Express, TypeScript, MongoDB (`ai_backend/`)
- **Auth:** JWT (httpOnly cookies)
- **AI:** Sarvam AI, Grok (xAI / Groq key auto-detect)

## Quick start

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000

## Environment

Copy example env files and add your keys:

```bash
cp ai_backend/.env.example ai_backend/.env
cp Debosmita-project/.env.example Debosmita-project/.env
```

**Backend** (`ai_backend/.env`):

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default `8000`) |
| `MONGODB_URI` | MongoDB connection string |
| `CLIENT_URL` | Frontend URL (`http://localhost:5173`) |
| `JWT_SECRET` | JWT signing secret |
| `JWT_EXPIRES_IN` | Token expiry (e.g. `7d`) |
| `SARVAM_API_KEY` | Sarvam AI API key |
| `SARVAM_BASE_URL` | `https://api.sarvam.ai` |
| `GROK_API_KEY` | xAI or Groq API key |
| `GROK_BASE_URL` | `https://api.x.ai/v1` |

**Frontend** (`Debosmita-project/.env`):

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:8000` |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend + frontend |
| `npm run build` | Build both packages |
| `npm run start` | Run production backend |

## API routes

- `GET /health`
- `POST /api/auth/register` · `login` · `logout`
- `GET /api/auth/me`
- `PATCH /api/auth/change-password`
- `POST /api/ai/chat`
- `GET /api/ai/status`
