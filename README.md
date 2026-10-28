# CareSight – AI Fall Detection System

Real-time fall detection for elderly care and safety monitoring. Upload a video or stream a webcam, and a YOLOv8 model flags falls as they happen.

🔗 **Live demo:** [caresightai.vercel.app](https://caresightai.vercel.app)

## Features
- Fall detection on uploaded videos and live webcam stream (WebSocket `/ws/detect`)
- YOLOv8-based person and posture detection
- Clean, animated Next.js dashboard
- Split deploy: frontend on Vercel, ML API on Render

## Tech Stack
| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4, GSAP |
| Backend | FastAPI, Python, WebSockets |
| ML | PyTorch (CPU), YOLOv8 (Ultralytics) |
| Deploy | Vercel (web), Render (API) |

## Architecture
```
Browser ──► Next.js (Vercel) ──HTTPS / WSS──► FastAPI + YOLOv8 (Render)
```

## Run Locally
**Frontend**
```bash
npm install
npm run dev        # http://localhost:3000
```
**Backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload   # http://localhost:8000
```

## Deployment
See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for the Vercel + Render setup. The backend is tuned for Render's 512 MB free plan (CPU-only Torch, single-thread inference, streamed uploads, automatic job cleanup).

## Author
**Avadhut Giri** · [avadhutgiri.in](https://avadhutgiri.in) · [@techie.addy](https://instagram.com/techie.addy)
