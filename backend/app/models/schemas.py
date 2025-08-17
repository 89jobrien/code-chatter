"""
Pydantic models for API requests and responses.
"""
from typing import List, Optional
from pydantic import BaseModel, HttpUrl, Field


class RepoURL(BaseModel):
    """Model for repository URL request."""
    url: HttpUrl = Field(..., description="Git repository URL to process")


class Question(BaseModel):
    """Model for question request."""
    text: str = Field(..., min_length=1, max_length=5000, description="Question to ask about the code or general inquiry")


class ProcessingResponse(BaseModel):
    """Model for processing response."""
    message: str = Field(..., description="Success message")
    documents_processed: int = Field(..., description="Number of documents processed")
    processing_time_seconds: Optional[float] = Field(None, description="Processing time in seconds")


class ErrorResponse(BaseModel):
    """Model for error responses."""
    detail: str = Field(..., description="Error message")
    error_code: Optional[str] = Field(None, description="Error code for client handling")


class HealthResponse(BaseModel):
    """Model for health check response."""
    status: str = Field(..., description="Health status")
    version: str = Field(..., description="API version")
    database_status: str = Field(..., description="Vector database status")
    uptime_seconds: float = Field(..., description="Application uptime in seconds")


class FileProcessingStats(BaseModel):
    """Statistics for file processing."""
    total_files: int = Field(..., description="Total number of files submitted")
    processed_files: int = Field(..., description="Number of successfully processed files")
    skipped_files: int = Field(..., description="Number of skipped files")
    failed_files: int = Field(..., description="Number of failed files")
    processing_time_seconds: float = Field(..., description="Total processing time")


class DocumentChunk(BaseModel):
    """Model for document chunks."""
    content: str = Field(..., description="Chunk content")
    metadata: dict = Field(default_factory=dict, description="Chunk metadata")
    chunk_id: Optional[str] = Field(None, description="Unique chunk identifier")
