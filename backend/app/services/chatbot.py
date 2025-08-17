"""
Simple chatbot service for general AI assistance without vector store dependency.
"""
import asyncio
from typing import AsyncGenerator, Optional
from loguru import logger
from pydantic import SecretStr

from langchain.callbacks import AsyncIteratorCallbackHandler
from langchain_openai import AzureChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from fastapi import HTTPException

from app.config.settings import settings


class ChatbotService:
    """Service for handling general AI chatbot functionality."""
    
    def __init__(self):
        self._llm: Optional[AzureChatOpenAI] = None
        self._lock = asyncio.Lock()
        self.system_message = """You are a helpful AI assistant. You can help with a wide variety of topics including:
- Answering questions and providing explanations
- Helping with problem-solving and brainstorming
- Providing coding assistance and technical guidance. If the task involves writing code, your output should only contain markdown code blocks—no explanatory text, comments, or prose outside of the code blocks. 
- Creative writing and content generation
- General conversation and support

Be helpful, accurate, and engaging in your responses. If you're unsure about something, be honest about it.
"""
    
    async def get_llm(
        self, 
        streaming: bool = True, 
        callbacks: Optional[list] = None
    ) -> AzureChatOpenAI:
        """
        Get or create LLM instance for general chatbot use.
        
        Args:
            streaming: Whether to enable streaming
            callbacks: List of callbacks to use
            
        Returns:
            AzureChatOpenAI instance
        """
        try:
            # Log configuration for debugging
            logger.info(f"Initializing Azure OpenAI with:")
            logger.info(f"  Endpoint: {settings.azure_openai_endpoint}")
            logger.info(f"  Deployment: {settings.azure_openai_chat_deployment}")
            logger.info(f"  API Version: {settings.azure_openai_api_version}")
            logger.info(f"  Streaming: {streaming}")
            
            # Validate required settings
            if not settings.azure_openai_endpoint or settings.azure_openai_endpoint == "None":
                raise ValueError("AZURE_OPENAI_ENDPOINT environment variable is not set")
            if not settings.azure_openai_api_key or settings.azure_openai_api_key == "None":
                raise ValueError("AZURE_OPENAI_API_KEY environment variable is not set")
            if not settings.azure_openai_chat_deployment or settings.azure_openai_chat_deployment == "None":
                raise ValueError("AZURE_OPENAI_CHAT_DEPLOYMENT_NAME environment variable is not set")
            if not settings.azure_openai_api_version or settings.azure_openai_api_version == "None":
                raise ValueError("AZURE_OPENAI_API_VERSION environment variable is not set")
            
            # Create LLM without problematic parameters for GPT-4o-mini
            llm = AzureChatOpenAI(
                streaming=streaming,
                api_key=SecretStr(settings.azure_openai_api_key),
                azure_deployment=settings.azure_openai_chat_deployment,
                callbacks=callbacks or [],
                azure_endpoint=settings.azure_openai_endpoint,
                api_version=settings.azure_openai_api_version,
                # No temperature or max_tokens parameters for GPT-4o-mini compatibility
            )
            return llm
            
        except Exception as e:
            logger.error(f"Failed to initialize chatbot LLM: {e}")
            logger.error(f"Error type: {type(e).__name__}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to initialize AI chatbot service: {str(e)}"
            )
    
    async def chat_streaming(self, message: str) -> AsyncGenerator[str, None]:
        """
        Send a message to the chatbot and stream the response.
        
        Args:
            message: User message
            
        Yields:
            Response tokens as they are generated
        """
        if not message.strip():
            raise HTTPException(
                status_code=400,
                detail="Message cannot be empty"
            )
        
        logger.info(f"Processing chatbot streaming message: '{message[:100]}...'")
        
        # Create callback handler for streaming
        callback = AsyncIteratorCallbackHandler()
        
        try:
            # Get LLM with streaming enabled
            llm = await self.get_llm(streaming=True, callbacks=[callback])
            logger.info("LLM initialized successfully")
            
            # Prepare messages
            messages = [
                SystemMessage(content=self.system_message),
                HumanMessage(content=message)
            ]
            logger.info(f"Messages prepared: {len(messages)} messages")
            
            # Start the chat in background
            task = asyncio.create_task(
                llm.ainvoke(messages)
            )
            
            logger.info("Starting chatbot response stream...")
            
            try:
                # Stream response tokens
                token_count = 0
                async for token in callback.aiter():
                    token_count += 1
                    if token_count <= 5:  # Log first few tokens
                        logger.debug(f"Token {token_count}: {token}")
                    yield token
                
                # Wait for the task to complete
                await task
                logger.success(f"Chatbot message processed successfully with {token_count} tokens")
                
            except Exception as stream_error:
                logger.error(f"Chatbot streaming error: {stream_error}")
                logger.error(f"Error type: {type(stream_error).__name__}")
                task.cancel()
                raise HTTPException(
                    status_code=500,
                    detail=f"Error during chatbot response generation: {str(stream_error)}"
                )
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Chatbot message processing failed: {e}")
            logger.error(f"Error type: {type(e).__name__}")
            
            # Handle specific Azure OpenAI errors
            error_detail = str(e)
            if "404" in error_detail and "Resource not found" in error_detail:
                raise HTTPException(
                    status_code=500,
                    detail="Azure OpenAI deployment not found. Please check your AZURE_OPENAI_CHAT_DEPLOYMENT_NAME and endpoint configuration."
                )
            elif "401" in error_detail or "Unauthorized" in error_detail:
                raise HTTPException(
                    status_code=500,
                    detail="Azure OpenAI authentication failed. Please check your API key."
                )
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to process chatbot message: {error_detail}"
                )
    
    async def chat_sync(self, message: str) -> dict:
        """
        Send a message to the chatbot and get a complete response (non-streaming).
        
        Args:
            message: User message
            
        Returns:
            Dictionary with the chatbot response
        """
        if not message.strip():
            raise HTTPException(
                status_code=400,
                detail="Message cannot be empty"
            )
        
        logger.info(f"Processing chatbot sync message: '{message[:100]}...'")
        
        try:
            # Get non-streaming LLM
            llm = await self.get_llm(streaming=False)
            
            # Prepare messages
            messages = [
                SystemMessage(content=self.system_message),
                HumanMessage(content=message)
            ]
            
            # Process message
            result = await llm.ainvoke(messages)
            
            # Format response
            response = {
                "response": result.content,
                "type": "chatbot"
            }
            
            logger.success("Chatbot message processed successfully")
            return response
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Chatbot message processing failed: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to process chatbot message: {str(e)}"
            )
    
    async def health_check(self) -> dict:
        """
        Check the health of the chatbot service.
        
        Returns:
            Dictionary with health status
        """
        try:
            # Test LLM connection with a simple message
            llm = await self.get_llm(streaming=False)
            
            # Quick test
            test_message = [
                SystemMessage(content="You are a test assistant."),
                HumanMessage(content="Reply with 'OK' if you're working properly.")
            ]
            
            result = await llm.ainvoke(test_message)
            
            return {
                "chatbot_status": "healthy",
                "ready": True,
                "test_response": str(result.content)[:50] + "..." if len(str(result.content)) > 50 else str(result.content)
            }
            
        except Exception as e:
            logger.error(f"Chatbot service health check failed: {e}")
            return {
                "chatbot_status": "error",
                "ready": False,
                "error": str(e)
            }


# Global chatbot service instance
chatbot_service = ChatbotService()
