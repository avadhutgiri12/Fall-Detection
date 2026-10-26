# Deployment Guide: Next.js Frontend (Vercel) + FastAPI Backend (Render)

This guide covers deploying the Fall Detection System as a **split architecture**:
- **Frontend (Next.js)** → Vercel
- **Backend (FastAPI + YOLOv8)** → **Render**

---

## Architecture Overview

```
┌─────────────────┐         HTTPS/WSS          ┌──────────────────┐
│   Vercel        │ ─────────────────────────► │    Render        │
│   (Next.js)     │                            │   (FastAPI)      │
│                 │ ◄───────────────────────── │                  │
└─────────────────┘                            └──────────────────┘
       │                                              │
       │  Static Assets                               │  YOLOv8 Model
       │  Server-Side Rendering                       │  WebSocket (/ws/detect)
       │  API Routes (if any)                         │  Video Processing
       └──────────────────────────────────────────────┘
```

**Why this split?**
- Vercel: Optimized for Next.js (SSR, static assets, edge functions)
- Render: Supports Python, WebSockets, long-running jobs, ML models, native Python runtime

---

## Prerequisites

- GitHub account
- Vercel account (free tier works)
- Render account (free tier available)
- Git installed locally

---

## Part 1: Deploy Backend to Render

### Step 1: Push Code to GitHub

```bash
cd /path/to/falldetection
git init
git add .
git commit -m "Initial commit: Fall Detection System"
# Create GitHub repo and push
git remote add origin https://github.com/YOUR_USERNAME/fall-detection-system.git
git push -u origin main
```

### Step 2: Create Render Service (Using Blueprint)

**Option A: Using render.yaml (Recommended - Blueprint)**

1. Go to [Render Dashboard](https://dashboard.render.com) and sign in with GitHub
2. Click **"New"** → **"Blueprint"**
3. Select your `fall-detection-system` repository
4. Render will detect `backend/render.yaml` and show the service configuration
5. Click **"Apply"** to create the service

**Option B: Manual Service Creation**

1. Go to [Render Dashboard](https://dashboard.render.com) and sign in with GitHub
2. Click **"New"** → **"Web Service"**
3. Select your `fall-detection-system` repository
4. Configure:
   - **Name**: `fall-detection-api`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install --upgrade pip && pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: `Free`

### Step 3: Configure Render Environment Variables

In Render dashboard → Your Service (`fall-detection-api`) → **Environment** tab, add:

| Variable | Value | Description |
|----------|-------|-------------|
| `PYTHON_VERSION` | `3.11` | Python version for build |
| `MODEL_PATH` | `yolov8n-pose.pt` | Model file in backend/ |
| `CONF_THRESHOLD` | `0.6` | Detection confidence |
| `TARGET_EMAIL` | `your-email@example.com` | Alert recipient |
| `SMTP_SERVER` | `smtp.gmail.com` | Gmail SMTP |
| `SMTP_PORT` | `465` | SSL port |
| `SMTP_USE_SSL` | `true` | Use SSL |
| `SMTP_USERNAME` | `your-email@gmail.com` | Your Gmail |
| `SMTP_PASSWORD` | `your-app-password` | Gmail App Password |
| `CORS_ORIGINS` | `https://your-frontend.vercel.app,http://localhost:3000` | Update after Vercel deploy |

> **Gmail App Password**: Enable 2FA on Google Account → Security → App Passwords → Create for "Mail"

> **Note**: Variables marked as "Secret" in Render dashboard (TARGET_EMAIL, SMTP_USERNAME, SMTP_PASSWORD, CORS_ORIGINS) should be added as secret environment variables.

### Step 4: Verify Backend Deployment

1. Wait for build to complete (3-5 minutes for PyTorch/Ultralytics install)
2. Check **Logs** tab for: `✓ FallDetector initialized with model: yolov8n-pose.pt`
3. Copy your **Service URL**: `https://fall-detection-api.onrender.com`
4. Test health endpoint: `https://fall-detection-api.onrender.com/health`

```json
// Expected response
{
  "status": "healthy",
  "model_loaded": true,
  "active_jobs": 0
}
```

---

## Part 2: Deploy Frontend to Vercel

### Step 1: Import Project to Vercel

1. Go to [Vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New..."** → **"Project"**
3. Import your `fall-detection-system` repository
4. **Framework Preset**: Next.js (auto-detected)
5. **Root Directory**: `./` (repo root, NOT backend/)
6. Click **Deploy**

### Step 2: Configure Vercel Environment Variables

In Vercel dashboard → Your Project → **Settings** → **Environment Variables**, add:

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://fall-detection-api.onrender.com` | Production, Preview |
| `NEXT_PUBLIC_WS_URL` | `wss://fall-detection-api.onrender.com` | Production, Preview |

### Step 3: vercel.json is Pre-configured

The `vercel.json` in your repo root is already configured for Render:

```json
{
  "rewrites": [
    {
      "source": "/api/backend/:path*",
      "destination": "https://fall-detection-api.onrender.com/:path*"
    }
  ],
  "env": {
    "NEXT_PUBLIC_API_URL": "https://fall-detection-api.onrender.com",
    "NEXT_PUBLIC_WS_URL": "wss://fall-detection-api.onrender.com"
  }
}
```

Commit and push - Vercel will auto-redeploy.

### Step 4: Update Render CORS with Vercel Domain

Once Vercel gives you a domain (e.g., `fall-detection.vercel.app`), go back to Render **Environment** and update:

```
CORS_ORIGINS=https://fall-detection.vercel.app,http://localhost:3000
```

Render will auto-restart the service.

---

## Part 3: Connect Frontend to Backend

### Using the API in Frontend Components

The `vercel.json` rewrites allow calling backend via `/api/backend/*` from frontend:

```typescript
// Example: components/ui/ApiClient.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/backend';

// REST API calls
export async function detectFrame(imageBase64: string) {
  const res = await fetch(`${API_BASE}/api/detect/frame`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageBase64, conf_threshold: 0.6 })
  });
  return res.json();
}

// WebSocket connection
export function createDetectionSocket(onMessage: (data: any) => void) {
  const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/ws/detect`);
  ws.onmessage = (event) => onMessage(JSON.parse(event.data));
  return ws;
}
```

### Update Canvas Page for Real-time Detection

In `app/canvas/page.tsx`, use the WebSocket URL from environment:

```typescript
"use client";

import { useEffect, useRef, useState } from "react";

export default function CanvasPage() {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  // ... use wsUrl for WebSocket connection
}
```

---

## Part 4: Local Development Setup

### Backend (Terminal 1)

```bash
cd backend
cp .env.example .env
# Edit .env with your local values
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
python main.py
# Runs on http://localhost:8000
```

### Frontend (Terminal 2)

```bash
cd ..
cp .env.example .env.local  # Create this file
# Add to .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:8000
# NEXT_PUBLIC_WS_URL=ws://localhost:8000

npm install
npm run dev
# Runs on http://localhost:3000
```

---

## Part 5: Production Checklist

### Backend (Render)
- [ ] Model file (`yolov8n-pose.pt`) included in repo
- [ ] Health endpoint returns `model_loaded: true`
- [ ] WebSocket endpoint `/ws/detect` works
- [ ] Video upload/processing works
- [ ] Email alerts configured and tested
- [ ] CORS origins include Vercel domain
- [ ] Render service is running (free tier spins down after 15 min inactivity)

### Frontend (Vercel)
- [ ] Build succeeds without errors
- [ ] All 5 pages render: `/`, `/about`, `/canvas`, `/contact`, `/how-it-works`
- [ ] Navbar navigation works
- [ ] Canvas page connects to WebSocket
- [ ] Environment variables set in Vercel dashboard
- [ ] `vercel.json` rewrites point to correct Render domain
- [ ] Custom domain configured (optional)

### Integration
- [ ] Frontend can call `/api/backend/health` → returns backend health
- [ ] WebSocket connection from Canvas page works
- [ ] Video upload from Contact/Canvas works end-to-end
- [ ] Fall detection alerts send emails

---

## Troubleshooting

### Backend Issues

| Issue | Solution |
|-------|----------|
| Build fails on PyTorch | Ensure `PYTHON_VERSION=3.11` in Render env vars; PyTorch 2.7+ supports Python 3.11 |
| Model not found | Ensure `yolov8n-pose.pt` is in `backend/` and committed to git |
| WebSocket fails | Render supports WebSockets natively; check logs for connection errors |
| Email not sending | Verify Gmail App Password, check SMTP settings (SSL port 465) |
| CORS errors | Update `CORS_ORIGINS` in Render with exact Vercel domain |
| Cold start timeout | Free tier spins down after 15 min; first request takes 30-60s |

### Frontend Issues

| Issue | Solution |
|-------|----------|
| Build fails | Run `npm run build` locally first |
| API calls fail | Check `NEXT_PUBLIC_API_URL` in Vercel env vars |
| WebSocket fails | Check `NEXT_PUBLIC_WS_URL` uses `wss://` not `ws://` |
| Styles missing | Ensure `@tailwindcss/turbopack` in devDependencies |

### Render Free Tier Limits
- **Spin down after 15 min inactivity** (cold start ~30-60s)
- **750 hours/month** free
- **No persistent storage** (uploads lost on restart - ephemeral filesystem)
- **Solution**: Upgrade to Starter plan ($7/mo) for always-on, or Standard for persistent disks

---

## File Structure Summary

```
falldetection/
├── vercel.json                 # Vercel config (pre-configured for Render)
├── next.config.ts              # Next.js config
├── package.json
├── backend/
│   ├── main.py                 # FastAPI app
│   ├── detector.py             # YOLOv8 detection
│   ├── fall_detection.py       # Fall logic
│   ├── requirements.txt        # Python deps
│   ├── yolov8n-pose.pt         # Model (6.5MB) - MUST COMMIT
│   ├── render.yaml             # Render Blueprint config
│   └── .env.example            # Backend env template
├── app/                        # Next.js pages
├── components/                 # React components
├── data/                       # Content & animations
└── DEPLOYMENT_GUIDE.md         # This file
```

---

## Useful Commands

```bash
# Local backend
cd backend && python main.py

# Local frontend
npm run dev

# Production build test
npm run build

# Check Render logs (via CLI)
# npm i -g @render/cli && render login
# render logs fall-detection-api

# Check Vercel logs
# npm i -g vercel && vercel login
# vercel logs
```

---

## Cost Estimate

| Service | Free Tier | Paid Tier |
|---------|-----------|-----------|
| **Vercel** | Unlimited personal | $20/mo Pro |
| **Render** | 750 hrs/mo, spins down | $7/mo Starter (always-on) |
| **Total** | **$0** (with spin-down) | **$7/mo** (production) |

---

## Support

- Render Docs: [render.com/docs](https://render.com/docs)
- Vercel Docs: [vercel.com/docs](https://vercel.com/docs)
- FastAPI Docs: [fastapi.tiangolo.com](https://fastapi.tiangolo.com)
- Next.js Docs: [nextjs.org/docs](https://nextjs.org/docs)