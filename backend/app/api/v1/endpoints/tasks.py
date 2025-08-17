from fastapi import APIRouter, Depends, HTTPException
from app.services.background_tasks import BackgroundTask
from app.api.v1.deps import get_background_task_service

router = APIRouter()

@router.get("/tasks/{task_id}", response_model=BackgroundTask, tags=["Tasks"])
async def get_task_status(
    task_id: str,
    bg_service=Depends(get_background_task_service)
):
    task = bg_service.get_task_status(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.get("/tasks", tags=["Tasks"])
async def get_all_tasks(bg_service=Depends(get_background_task_service)):
    return bg_service.get_all_tasks()