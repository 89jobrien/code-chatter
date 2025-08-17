"""
Application configuration using Pydantic Settings.
"""
import os
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    model_config = {"extra": "allow"}
    # API Configuration
    api_title: str = "Code Chatter API"
    api_version: str = "0.1.0"
    debug: bool = Field(default=False)
    
    # CORS Settings
    cors_origins: List[str] = Field(default=[str(os.getenv("CORS_ORIGINS"))])
    
    # Azure OpenAI Configuration
    azure_openai_endpoint: str = Field(default=str(os.getenv("AZURE_OPENAI_ENDPOINT")))
    azure_openai_api_key: str = Field(default=str(os.getenv("AZURE_OPENAI_API_KEY")))
    azure_openai_api_version: str = Field(default=str(os.getenv("AZURE_OPENAI_API_VERSION")))
    azure_openai_chat_deployment: str = Field(default=str(os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT_NAME")))
    azure_openai_embedding_deployment: str = Field(default=str(os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME")))
    
    # Vector Database Configuration
    chroma_persist_dir: str = Field(default=str(os.getenv("CHROMA_PERSIST_DIR")))
    chroma_collection_name: str = Field(default=str(os.getenv("CHROMA_COLLECTION_NAME")))
    
    # Processing Configuration
    chunk_size: int = Field(default=2000)
    chunk_overlap: int = Field(default=200)
    max_concurrent_files: int = Field(default=5)
    max_file_size_mb: int = Field(default=100)
    
    # Search Configuration
    retrieval_k: int = Field(default=8)
    search_type: str = Field(default="mmr")
    
    # Logging Configuration
    log_level: str = Field(default="INFO")
    log_file: str = Field(default="backend.log")
    log_rotation: str = Field(default="10 MB")
    log_retention: str = Field(default="7 days")
    
    # File Processing Configuration
    ignore_patterns: List[str] = Field(default=[
        "*/.git/*", "*/.github/*", "*/node_modules/*", "*/.venv/*",
        "*/venv/*", "*/__pycache__/*", "*.pyc", "*.lock", "*.log", "*/.DS_Store",
        "*.min.js", "*.map", "*.pdf", "*.jpg", "*.jpeg", "*.png", "*.gif"
    ])
    
    # Temporary Directories
    temp_repo_dir: str = Field(default="./temp_repo")
    temp_files_dir: str = Field(default="./temp_files")



# Global settings instance
settings = Settings()
