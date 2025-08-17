"""
Core utility functions.
"""
import os
import fnmatch
import asyncio
import aiofiles
from typing import List, Callable, Any, Awaitable
from pathlib import Path
from loguru import logger


def is_path_ignored(path: str, patterns: List[str]) -> bool:
    """
    Check if a file path matches any of the ignore patterns.
    
    Args:
        path: File path to check
        patterns: List of glob patterns to match against
    
    Returns:
        True if path should be ignored, False otherwise
    """
    for pattern in patterns:
        if fnmatch.fnmatch(path, pattern):
            return True
    return False


def validate_file_size(file_path: str, max_size_mb: int) -> bool:
    """
    Validate that a file is within size limits.
    
    Args:
        file_path: Path to the file
        max_size_mb: Maximum allowed file size in MB
    
    Returns:
        True if file is within limits, False otherwise
    """
    try:
        file_size = os.path.getsize(file_path)
        max_size_bytes = max_size_mb * 1024 * 1024
        return file_size <= max_size_bytes
    except OSError:
        return False


def get_file_extension(file_path: str) -> str:
    """Get the file extension in lowercase."""
    return Path(file_path).suffix.lower()


def is_text_file(file_path: str) -> bool:
    """
    Check if a file is likely a text file based on extension.
    
    Args:
        file_path: Path to the file
    
    Returns:
        True if likely a text file, False otherwise
    """
    text_extensions = {
        '.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.cpp', '.c', '.h', '.hpp',
        '.cs', '.php', '.rb', '.go', '.rs', '.kt', '.swift', '.scala', '.clj',
        '.html', '.css', '.scss', '.sass', '.less', '.xml', '.yaml', '.yml',
        '.json', '.toml', '.ini', '.cfg', '.conf', '.txt', '.md', '.rst',
        '.sql', '.sh', '.bash', '.zsh', '.ps1', '.bat', '.dockerfile', '.r',
        '.matlab', '.m', '.pl', '.lua', '.vim', '.el', '.hs', '.ml', '.fs'
    }
    
    extension = get_file_extension(file_path)
    return extension in text_extensions


async def run_with_semaphore(
    semaphore: asyncio.Semaphore,
    coroutine_func: Callable[..., Awaitable[Any]],
    *args,
    **kwargs
) -> Any:
    """
    Run a coroutine with semaphore-based concurrency control.
    
    Args:
        semaphore: Semaphore to control concurrency
        coroutine_func: Async function to run
        *args: Arguments for the function
        **kwargs: Keyword arguments for the function
    
    Returns:
        Result of the coroutine function
    """
    async with semaphore:
        return await coroutine_func(*args, **kwargs)


async def ensure_directory(directory: str) -> None:
    """
    Ensure a directory exists, create it if it doesn't.
    
    Args:
        directory: Directory path to ensure exists
    """
    path = Path(directory)
    if not path.exists():
        path.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created directory: {directory}")


async def cleanup_directory(directory: str) -> None:
    """
    Safely remove a directory and all its contents.
    
    Args:
        directory: Directory path to remove
    """
    path = Path(directory)
    if path.exists():
        import shutil
        shutil.rmtree(directory)
        logger.info(f"Cleaned up directory: {directory}")


def safe_filename(filename: str) -> str:
    """
    Create a safe filename by removing/replacing problematic characters.
    
    Args:
        filename: Original filename
    
    Returns:
        Safe filename
    """
    import re
    # Remove or replace problematic characters
    safe_name = re.sub(r'[<>:"/\\|?*]', '_', filename)
    # Remove leading/trailing whitespace and dots
    safe_name = safe_name.strip('. ')
    # Ensure it's not empty
    return safe_name or 'unnamed_file'
