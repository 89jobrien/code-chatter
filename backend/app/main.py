"""
Main application file for the FastAPI service.
"""
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.config.settings import settings
from app.core.logging import setup_logging
from app.services.vector_store import vector_store_service
from app.services.document_processor import document_processor
from app.services.background_tasks import background_task_service
from app.api.v1.api import api_router # Import the main v1 router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown."""
    logger.info("Starting Code Chatter API...")
    setup_logging()
    logger.info(f"Application configured with settings: {settings.api_title} v{settings.api_version}")

    try:
        # await vector_store_service.get_vector_store(create_if_not_exists=True)
        logger.info("Services initialized successfully")
    except Exception as e:
        logger.warning(f"Service initialization warning: {e}")

    yield

    logger.info("Shutting down Code Chatter API...")
    try:
        document_processor.cleanup()
        background_task_service.cleanup_completed_tasks()
        logger.info("Services shutdown completed")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description="AI-powered code analysis and chat API",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the v1 API router with a prefix
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def root():
    """Root endpoint with link to the API docs."""
    return {
        "message": "Welcome to Code Chatter API",
        "api_docs": "/docs",
        "api_v1_docs": "/api/v1/docs"
    }

# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(
#         "app.main:app",
#         host="0.0.0.0",
#         port=8000,
#         reload=settings.debug,
#         log_level=settings.log_level.lower()
#     )