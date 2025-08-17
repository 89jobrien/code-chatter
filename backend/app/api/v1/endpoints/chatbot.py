from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.models.schemas import Question
from app.services.chatbot import chatbot_service

router = APIRouter()

@router.post("/chatbot", tags=["Chatbot"])
async def chatbot_streaming(
    question: Question
):
    """Stream chatbot responses for general AI assistance."""
    return StreamingResponse(
        chatbot_service.chat_streaming(question.text),
        media_type="text/plain",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )

@router.post("/chatbot-sync", tags=["Chatbot"])
async def chatbot_sync(
    question: Question
):
    """Get complete chatbot response for general AI assistance."""
    return await chatbot_service.chat_sync(question.text)

@router.get("/chatbot-health", tags=["Chatbot"])
async def chatbot_health():
    """Check chatbot service health."""
    return await chatbot_service.health_check()
