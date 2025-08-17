from fastapi import APIRouter
from app.api.v1.endpoints import (
    management, 
    tasks, 
    data_processing, 
    chat,
    chatbot,
    health
    )

api_router = APIRouter()

# Include all the individual routers
api_router.include_router(management.router)
api_router.include_router(tasks.router)
api_router.include_router(data_processing.router)
api_router.include_router(chat.router)
api_router.include_router(chatbot.router)
api_router.include_router(health.router)
