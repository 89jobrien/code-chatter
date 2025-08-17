from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.models.schemas import Question
from app.api.v1.deps import get_chat_service

router = APIRouter()

@router.post("/ask", tags=["Chat"])
async def ask_question_streaming(
    question: Question,
    chat_svc=Depends(get_chat_service)
):
    return StreamingResponse(
        chat_svc.ask_question_streaming(question.text),
        media_type="text/plain",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )

@router.post("/ask-sync", tags=["Chat"])
async def ask_question_sync(
    question: Question,
    chat_svc=Depends(get_chat_service)
):
    return await chat_svc.ask_question_sync(question.text)

@router.get("/suggested-questions", tags=["Chat"])
async def get_suggested_questions(chat_svc=Depends(get_chat_service)):
    return await chat_svc.get_suggested_questions()