import aiosqlite
from fastapi import APIRouter
from database import get_action_logs, init_db, get_stats
from config import settings

router = APIRouter()


@router.get("/actions")
async def list_actions():
    async with aiosqlite.connect(settings.db_path) as db:
        await init_db(db)
        return await get_action_logs(db)


@router.get("/actions/alert/{alert_id}")
async def list_actions_for_alert(alert_id: str):
    async with aiosqlite.connect(settings.db_path) as db:
        await init_db(db)
        return await get_action_logs(db, alert_id=alert_id)


@router.get("/stats")
async def get_dashboard_stats():
    async with aiosqlite.connect(settings.db_path) as db:
        await init_db(db)
        return await get_stats(db)
