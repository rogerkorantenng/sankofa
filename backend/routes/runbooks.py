import uuid
import aiosqlite
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_runbooks, save_runbook, get_runbook, init_db
from models import Runbook, RunbookStep
from config import settings

router = APIRouter()


class RunbookCreateRequest(BaseModel):
    name: str
    trigger_conditions: dict
    steps: list[dict]


@router.get("/runbooks")
async def list_runbooks():
    async with aiosqlite.connect(settings.db_path) as db:
        await init_db(db)
        return await get_runbooks(db)


@router.post("/runbooks")
async def create_runbook(req: RunbookCreateRequest):
    rb = Runbook(
        id=str(uuid.uuid4()),
        name=req.name,
        trigger_conditions=req.trigger_conditions,
        steps=[RunbookStep(**s) for s in req.steps],
        created_at=datetime.utcnow(),
    )
    async with aiosqlite.connect(settings.db_path) as db:
        await init_db(db)
        await save_runbook(db, rb)
    return {"id": rb.id}


@router.get("/runbooks/{runbook_id}")
async def get_runbook_by_id(runbook_id: str):
    async with aiosqlite.connect(settings.db_path) as db:
        await init_db(db)
        rb = await get_runbook(db, runbook_id)
        if not rb:
            raise HTTPException(status_code=404, detail="Runbook not found")
        return rb


@router.delete("/runbooks/{runbook_id}")
async def delete_runbook(runbook_id: str):
    async with aiosqlite.connect(settings.db_path) as db:
        await init_db(db)
        await db.execute("DELETE FROM runbooks WHERE id = ?", (runbook_id,))
        await db.commit()
    return {"ok": True}
