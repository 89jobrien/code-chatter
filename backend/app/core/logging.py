"""
Centralized logging configuration.
"""
import sys
from loguru import logger
from app.config.settings import settings


def setup_logging() -> None:
    """Configure logging for the application."""
    # Remove default handler
    logger.remove()
    
    # Console handler
    logger.add(
        sys.stderr,
        level=settings.log_level,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"
    )
    
    # File handler
    logger.add(
        settings.log_file,
        level="DEBUG",
        rotation=settings.log_rotation,
        retention=settings.log_retention,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{function}:{line} - {message}",
        backtrace=True,
        diagnose=True,
    )
    
    logger.info(f"Logging configured with level: {settings.log_level}")
