from app.services.repository import repository_service
from app.services.file_processor import file_processor
from app.services.vector_store import vector_store_service
from app.services.chat import chat_service
from app.services.background_tasks import background_task_service

async def get_repository_service():
    """Get repository service instance."""
    return repository_service

async def get_file_processor():
    """Get file processor service instance."""
    return file_processor

async def get_vector_store_service():
    """Get vector store service instance."""
    return vector_store_service

async def get_chat_service():
    """Get chat service instance."""
    return chat_service

async def get_background_task_service():
    """Get background task service instance."""
    return background_task_service