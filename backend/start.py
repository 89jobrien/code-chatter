#!/usr/bin/env python3
"""
Startup script for the Code Chatter API server.
"""
import os
import sys
from pathlib import Path

# Add the current directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Set environment variables if not already set
if not os.getenv("PYTHONPATH"):
    os.environ["PYTHONPATH"] = str(backend_dir)


def main():
    """Main entry point for the application."""
    import uvicorn
    from app.config.settings import settings
    
    # Run the application
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
        access_log=True,
    )


if __name__ == "__main__":
    main()
