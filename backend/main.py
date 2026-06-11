from contextlib import asynccontextmanager
import aiosqlite
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from config import settings
from poller import start_scheduler, stop_scheduler
from routes.alerts import router as alerts_router
from routes.ws import router as ws_router
from chat import router as chat_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with aiosqlite.connect(settings.db_path) as db:
        await init_db(db)
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="Sankofa — SOC Triage", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(alerts_router)
app.include_router(ws_router)
app.include_router(chat_router)
