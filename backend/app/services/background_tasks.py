"""
Background task service for handling long-running operations.
"""
import asyncio
import uuid
from enum import Enum
from typing import Dict, Optional, Any, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime
from loguru import logger


class TaskStatus(str, Enum):
    """Task status enumeration."""
    PENDING = "pending"
    RUNNING = "running" 
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class BackgroundTask:
    """Background task data structure."""
    id: str
    name: str
    status: TaskStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress: float = 0.0
    result: Any = None
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class BackgroundTaskService:
    """Service for managing background tasks."""
    
    def __init__(self, max_concurrent_tasks: int = 3):
        self._tasks: Dict[str, BackgroundTask] = {}
        self._running_tasks: Dict[str, asyncio.Task] = {}
        self._semaphore = asyncio.Semaphore(max_concurrent_tasks)
        self._cleanup_interval = 3600  # Clean up completed tasks after 1 hour
    
    def create_task(
        self, 
        name: str, 
        task_func: Callable[..., Awaitable[Any]], 
        *args, 
        **kwargs
    ) -> str:
        """
        Create a new background task.
        
        Args:
            name: Human-readable task name
            task_func: Async function to execute
            *args: Arguments for the task function
            **kwargs: Keyword arguments for the task function
            
        Returns:
            Task ID
        """
        task_id = str(uuid.uuid4())
        
        # Create task record
        bg_task = BackgroundTask(
            id=task_id,
            name=name,
            status=TaskStatus.PENDING,
            created_at=datetime.now()
        )
        
        self._tasks[task_id] = bg_task
        
        # Start the task
        asyncio_task = asyncio.create_task(
            self._execute_task(task_id, task_func, *args, **kwargs)
        )
        self._running_tasks[task_id] = asyncio_task
        
        logger.info(f"Created background task: {name} (ID: {task_id})")
        return task_id
    
    async def _execute_task(
        self, 
        task_id: str, 
        task_func: Callable[..., Awaitable[Any]], 
        *args, 
        **kwargs
    ) -> None:
        """
        Execute a background task with semaphore control.
        
        Args:
            task_id: Task identifier
            task_func: Function to execute
            *args: Arguments for the function
            **kwargs: Keyword arguments for the function
        """
        bg_task = self._tasks[task_id]
        
        try:
            async with self._semaphore:
                # Update task status
                bg_task.status = TaskStatus.RUNNING
                bg_task.started_at = datetime.now()
                
                logger.info(f"Starting background task: {bg_task.name}")
                
                # Execute the task
                result = await task_func(*args, **kwargs)
                
                # Update task with result
                bg_task.status = TaskStatus.COMPLETED
                bg_task.completed_at = datetime.now()
                bg_task.progress = 100.0
                bg_task.result = result
                
                logger.success(f"Background task completed: {bg_task.name}")
                
        except asyncio.CancelledError:
            bg_task.status = TaskStatus.CANCELLED
            bg_task.completed_at = datetime.now()
            logger.warning(f"Background task cancelled: {bg_task.name}")
            
        except Exception as e:
            bg_task.status = TaskStatus.FAILED
            bg_task.completed_at = datetime.now()
            bg_task.error_message = str(e)
            logger.error(f"Background task failed: {bg_task.name} - {e}")
            
        finally:
            # Clean up running task reference
            if task_id in self._running_tasks:
                del self._running_tasks[task_id]
    
    def get_task_status(self, task_id: str) -> Optional[BackgroundTask]:
        """
        Get the status of a background task.
        
        Args:
            task_id: Task identifier
            
        Returns:
            BackgroundTask object or None if not found
        """
        return self._tasks.get(task_id)
    
    def get_all_tasks(self, include_completed: bool = True) -> Dict[str, BackgroundTask]:
        """
        Get all background tasks.
        
        Args:
            include_completed: Whether to include completed tasks
            
        Returns:
            Dictionary of task ID to BackgroundTask
        """
        if include_completed:
            return self._tasks.copy()
        
        return {
            task_id: task 
            for task_id, task in self._tasks.items()
            if task.status not in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]
        }
    
    def cancel_task(self, task_id: str) -> bool:
        """
        Cancel a running background task.
        
        Args:
            task_id: Task identifier
            
        Returns:
            True if task was cancelled, False otherwise
        """
        if task_id not in self._running_tasks:
            return False
        
        asyncio_task = self._running_tasks[task_id]
        if not asyncio_task.done():
            asyncio_task.cancel()
            logger.info(f"Cancelled background task: {task_id}")
            return True
        
        return False
    
    def cleanup_completed_tasks(self) -> int:
        """
        Clean up old completed tasks.
        
        Returns:
            Number of tasks cleaned up
        """
        now = datetime.now()
        tasks_to_remove = []
        
        for task_id, task in self._tasks.items():
            if (task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED] and
                task.completed_at and 
                (now - task.completed_at).total_seconds() > self._cleanup_interval):
                tasks_to_remove.append(task_id)
        
        for task_id in tasks_to_remove:
            del self._tasks[task_id]
        
        if tasks_to_remove:
            logger.info(f"Cleaned up {len(tasks_to_remove)} completed background tasks")
        
        return len(tasks_to_remove)
    
    def get_service_stats(self) -> Dict[str, Any]:
        """
        Get background task service statistics.
        
        Returns:
            Dictionary with service statistics
        """
        status_counts = {}
        for task in self._tasks.values():
            status_counts[task.status] = status_counts.get(task.status, 0) + 1
        
        return {
            "total_tasks": len(self._tasks),
            "running_tasks": len(self._running_tasks),
            "status_counts": status_counts,
            "max_concurrent": self._semaphore._value + len(self._running_tasks),
            "available_slots": self._semaphore._value
        }


# Global background task service instance
background_task_service = BackgroundTaskService()
