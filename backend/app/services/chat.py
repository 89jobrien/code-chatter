"""
Chat service for handling Q&A with streaming responses.
"""
import asyncio
from typing import AsyncGenerator, Optional
from loguru import logger
from pydantic import SecretStr

from langchain.callbacks import AsyncIteratorCallbackHandler
from langchain_openai import AzureChatOpenAI
from langchain.chains.retrieval_qa.base import RetrievalQA
from fastapi import HTTPException

from app.config.settings import settings
from app.services.vector_store import vector_store_service


class ChatService:
    """Service for handling chat/Q&A functionality."""
    
    def __init__(self):
        self._llm: Optional[AzureChatOpenAI] = None
        self._lock = asyncio.Lock()
    
    async def get_llm(
        self, 
        streaming: bool = True, 
        callbacks: Optional[list] = None
    ) -> AzureChatOpenAI:
        """
        Get or create LLM instance with connection pooling.
        
        Args:
            streaming: Whether to enable streaming
            callbacks: List of callbacks to use
            
        Returns:
            AzureChatOpenAI instance
        """
        try:
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
            logger.error(f"Failed to initialize LLM: {e}")
            raise HTTPException(
                status_code=500,
                detail="Failed to initialize AI service"
            )
    
    async def ask_question_streaming(self, question: str) -> AsyncGenerator[str, None]:
        """
        Ask a question and stream the response.
        
        Args:
            question: Question to ask
            
        Yields:
            Response tokens as they are generated
        """
        if not question.strip():
            raise HTTPException(
                status_code=400,
                detail="Question cannot be empty"
            )
        
        logger.info(f"Processing streaming question: '{question[:100]}...'")
        
        # Check if vector store is available
        vector_store = await vector_store_service.get_vector_store()
        if vector_store is None:
            raise HTTPException(
                status_code=400,
                detail="Knowledge base not found. Please process some files or repositories first."
            )
        
        # Create callback handler for streaming
        callback = AsyncIteratorCallbackHandler()
        
        try:
            # Get LLM with streaming enabled
            llm = await self.get_llm(streaming=True, callbacks=[callback])
            
            # Get retriever
            retriever = await vector_store_service.get_retriever(search_type=settings.search_type, k=settings.retrieval_k)
            if retriever is None:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to initialize document retriever"
                )
            
            # Create QA chain
            qa_chain = RetrievalQA.from_chain_type(
                llm=llm,
                chain_type="stuff",
                retriever=retriever,
                return_source_documents=False,  # Don't return sources in streaming
                verbose=False
            )
            
            # Start the QA chain in background
            task = asyncio.create_task(
                qa_chain.ainvoke({"query": question})
            )
            
            logger.info("Starting response stream...")
            
            try:
                # Stream response tokens
                async for token in callback.aiter():
                    yield token
                
                # Wait for the task to complete
                result = await task
                logger.success("Question answered successfully")
                
            except Exception as stream_error:
                logger.error(f"Streaming error: {stream_error}")
                task.cancel()
                raise HTTPException(
                    status_code=500,
                    detail=f"Error during response generation: {str(stream_error)}"
                )
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Question processing failed: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to process question: {str(e)}"
            )
    
    async def ask_question_sync(self, question: str) -> dict:
        """
        Ask a question and get a complete response (non-streaming).
        
        Args:
            question: Question to ask
            
        Returns:
            Dictionary with answer and source information
        """
        if not question.strip():
            raise HTTPException(
                status_code=400,
                detail="Question cannot be empty"
            )
        
        logger.info(f"Processing sync question: '{question[:100]}...'")
        
        # Check if vector store is available
        vector_store = await vector_store_service.get_vector_store()
        if vector_store is None:
            raise HTTPException(
                status_code=400,
                detail="Knowledge base not found. Please process some files or repositories first."
            )
        
        try:
            # Get non-streaming LLM
            llm = await self.get_llm(streaming=False)
            
            # Get retriever
            retriever = await vector_store_service.get_retriever(search_type=settings.search_type, k=settings.retrieval_k)
            if retriever is None:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to initialize document retriever"
                )
            
            # Create QA chain with source documents
            qa_chain = RetrievalQA.from_chain_type(
                llm=llm,
                chain_type="stuff",
                retriever=retriever,
                return_source_documents=True,
                verbose=False
            )
            
            # Process question
            result = await qa_chain.ainvoke({"query": question})
            
            # Format response
            response = {
                "answer": result.get("result", ""),
                "sources": []
            }
            
            # Add source information if available
            if "source_documents" in result:
                for doc in result["source_documents"]:
                    source_info = {
                        "content": doc.page_content[:200] + "..." if len(doc.page_content) > 200 else doc.page_content,
                        "metadata": doc.metadata
                    }
                    response["sources"].append(source_info)
            
            logger.success("Question answered successfully with sources")
            return response
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Question processing failed: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to process question: {str(e)}"
            )
    
    async def get_suggested_questions(self) -> list[str]:
        """
        Get suggested questions based on the current knowledge base.
        
        Returns:
            List of suggested questions
        """
        # This could be enhanced to analyze the knowledge base content
        # and generate context-specific suggestions
        default_suggestions = [
            "What is the main purpose of this codebase?",
            "How is the code organized and what are the main components?",
            "What are the key dependencies and technologies used?",
            "Are there any notable patterns or architectural decisions?",
            "What functionality does the main application provide?",
            "How can I get started with this code?",
            "What are the configuration options available?",
            "Are there any known issues or limitations?"
        ]
        
        # Check if we have a knowledge base
        db_status = await vector_store_service.check_database_status()
        if db_status["status"] not in ["healthy", "available"]:
            return [
                "Please upload some files or process a repository first to get started.",
                "What types of files can I upload for analysis?",
                "How do I process a Git repository?",
            ]
        
        return default_suggestions
    
    async def health_check(self) -> dict:
        """
        Check the health of the chat service.
        
        Returns:
            Dictionary with health status
        """
        try:
            # Test LLM connection
            llm = await self.get_llm(streaming=False)
            
            # Test vector store
            db_status = await vector_store_service.check_database_status()
            
            return {
                "llm_status": "healthy",
                "vector_store_status": db_status["status"],
                "ready_for_questions": db_status["status"] in ["healthy", "available"],
                "document_count": db_status.get("document_count", 0)
            }
            
        except Exception as e:
            logger.error(f"Chat service health check failed: {e}")
            return {
                "llm_status": "error",
                "vector_store_status": "error",
                "ready_for_questions": False,
                "error": str(e)
            }


# Global chat service instance
chat_service = ChatService()
