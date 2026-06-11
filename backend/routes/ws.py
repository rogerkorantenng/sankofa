import asyncio
import json
import aiosqlite
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from database import get_alerts, init_db
from config import settings

router = APIRouter()


@router.websocket("/ws/alerts")
async def alerts_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            async with aiosqlite.connect(settings.db_path) as db:
                await init_db(db)
                alerts = await get_alerts(db)
            await websocket.send_text(json.dumps(alerts))
            await asyncio.sleep(3)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
