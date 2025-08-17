# Code Chatter Backend

A modern, high-performance AI-powered code analysis and chat API built with FastAPI, featuring:

- **Service-based architecture** with dependency injection
- **Concurrent file processing** with async/await  
- **Vector database integration** with ChromaDB
- **Azure OpenAI integration** for intelligent code analysis
- **Streaming responses** for real-time chat
- **Background task processing** for heavy operations
- **Comprehensive logging** and error handling

## Quick Start

1. Install dependencies: `pip install -e .`
2. Set up `.env` file with your Azure OpenAI credentials
3. Run: `python start.py`

## Architecture

The backend is organized into modular services:
- `vector_store.py` - Vector database operations with caching
- `document_processor.py` - Concurrent file processing
- `file_processor.py` - File upload handling with validation
- `repository.py` - Git repository operations  
- `chat.py` - Q&A functionality with streaming
- `background_tasks.py` - Background processing

Each service handles specific concerns with proper error handling, logging, and resource management.
