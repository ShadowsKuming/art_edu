# ArtBloom

An AI-powered art education platform that helps teachers create interactive lesson slide decks. Teachers can upload artwork, generate interactive stories, animate images, and apply AI style transfer to student sketches — all within a single workspace.

## Project structure

```
art_edu/
├── backend/        FastAPI proxy server (Python)
└── frontend/       Vue 3 + Vite + TypeScript UI
```

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Node.js | 18+ |
| npm | 9+ |
| Conda (Miniconda / Anaconda) | any recent |

You also need a **Volcengine Ark API key**. Create one at [https://console.volcengine.com/ark](https://console.volcengine.com/ark).

---

## Backend setup

### 1. Create the conda environment

```bash
cd backend
conda env create -f environment.yml
conda activate artbloom
```

> To update an existing environment after dependency changes:
> ```bash
> conda env update -f environment.yml --prune
> ```

### 2. Configure credentials

```bash
cp .env.example .env
```

Open `backend/.env` and fill in your Ark API key:

```
ARK_API_KEY=your_actual_key_here
```

The models are pre-configured and do not need to be changed:

| Variable | Default | Purpose |
|----------|---------|---------|
| `ARK_STORY_MODEL` | `doubao-seed-2-0-lite-260215` | Vision LLM — story & style generation |
| `ARK_CHAT_MODEL` | `doubao-seed-2-0-lite-260215` | Slide-design chatbot |
| `ARK_VIDEO_MODEL` | `doubao-seedance-2-0-260128` | Image-to-video animation |
| `ARK_IMAGE_MODEL` | `doubao-seedream-5-0-260128` | Image style transfer |

### 3. Start the backend

```bash
conda activate artbloom
cd backend
uvicorn main:app --port 8001 --reload
```

Verify it is running:

```bash
curl http://localhost:8001/health
# {"ok":true,"api_key_set":true,...}
```

---

## Frontend setup

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Configure the API base URL

The file `frontend/.env` already points to the backend:

```
VITE_API_BASE=http://localhost:8001
```

Change the port here if you started the backend on a different port.

### 3. Start the dev server

```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Running both together

Open two terminal tabs:

```bash
# Terminal 1 — backend
conda activate artbloom
cd backend
uvicorn main:app --port 8001 --reload

# Terminal 2 — frontend
cd frontend
npm run dev
```

---

## Key features by part

| Part | Feature | AI used |
|------|---------|---------|
| 1–2 | Slide editor (text, images, backgrounds) | — |
| 3 | Interactive story generation | Doubao vision LLM |
| 3 | Image-to-video animation (3 attempts) | Doubao Seedance video |
| 6 | Sketch style transfer | Doubao Seedream image |
| All | Slide-design chatbot (right panel) | Doubao vision LLM |

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Check server and config |
| POST | `/api/story/generate` | Generate interactive story from image |
| POST | `/api/animation/submit` | Submit image-to-video task |
| GET | `/api/animation/status/{task_id}` | Poll animation task status |
| POST | `/api/chat` | Slide-design chatbot |
| POST | `/api/part6/generate-styles` | Generate 3 style transfer prompts |
| POST | `/api/part6/transfer` | Apply style transfer to sketch |

---

## Production build

```bash
cd frontend
npm run build
# Output is in frontend/dist/
```

Serve `dist/` with any static file host (Nginx, Vercel, etc.) and point `VITE_API_BASE` to your deployed backend URL before building.
