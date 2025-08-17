import time
from fastapi import APIRouter, Depends, HTTPException
from app.config.settings import settings
from app.models.schemas import HealthResponse
from app.api.v1.deps import get_vector_store_service, get_chat_service

router = APIRouter()
APP_START_TIME = time.time()

@router.get("/health", response_model=HealthResponse, tags=["Management"])
async def health_check(
    vector_service=Depends(get_vector_store_service),
    chat_svc=Depends(get_chat_service)
):
    db_status = await vector_service.check_database_status()
    chat_status = await chat_svc.health_check()
    uptime_seconds = time.time() - APP_START_TIME
    overall_status = "healthy"
    if db_status["status"] == "error" or chat_status.get("llm_status") == "error":
        overall_status = "degraded"
    return HealthResponse(
        status=overall_status,
        version=settings.api_version,
        database_status=db_status["status"],
        uptime_seconds=uptime_seconds
    )

@router.post("/reset-database", tags=["Management"])
async def reset_knowledge_base(vector_service=Depends(get_vector_store_service)):
    success = await vector_service.reset_database()
    if success:
        return {"message": "Knowledge base reset successfully"}
    raise HTTPException(status_code=500, detail="Failed to reset knowledge base")

@router.get("/database-status", tags=["Management"])
async def get_database_status(vector_service=Depends(get_vector_store_service)):
    return await vector_service.check_database_status()