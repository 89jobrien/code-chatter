"""
Vector store service for managing embeddings and similarity search.
"""
import os
from typing import List, Optional, Dict, Any
from functools import lru_cache
import asyncio
from loguru import logger
from pydantic import SecretStr

from langchain_community.vectorstores import Chroma
from langchain_openai import AzureOpenAIEmbeddings
from langchain.schema import Document
from langchain_core.retrievers import BaseRetriever

from app.config.settings import settings


class VectorStoreService:
    """Service for managing vector store operations with connection pooling."""
    
    def __init__(self):
        self._embeddings: Optional[AzureOpenAIEmbeddings] = None
        self._vector_store: Optional[Chroma] = None
        self._lock = asyncio.Lock()
        self._retriever_cache: Dict[str, BaseRetriever] = {}
    
    @property
    def embeddings(self) -> AzureOpenAIEmbeddings:
        """Get or create embeddings instance."""
        # The lock is not needed here if only called from within get_vector_store's lock
        if self._embeddings is None:
            try:
                self._embeddings = AzureOpenAIEmbeddings(
                    azure_deployment=settings.azure_openai_embedding_deployment,
                    azure_endpoint=settings.azure_openai_endpoint,
                    api_key=SecretStr(settings.azure_openai_api_key),
                    api_version=settings.azure_openai_api_version,
                )
                logger.info("Initialized Azure OpenAI embeddings")
            except Exception as e:
                logger.error(f"Failed to initialize embeddings: {e}")
                raise
        return self._embeddings
    
    async def get_vector_store(self, create_if_not_exists: bool = False) -> Optional[Chroma]:
        """
        Get or create vector store instance.
        """
        if self._vector_store is None:
            async with self._lock:
                if self._vector_store is None:
                    try:
                        # --- MODIFICATION START: Remove 'await' ---
                        embeddings = self.embeddings
                        # --- MODIFICATION END ---

                        if not os.path.exists(settings.chroma_persist_dir):
                            if create_if_not_exists:
                                os.makedirs(settings.chroma_persist_dir, exist_ok=True)
                                logger.info(f"Created Chroma directory: {settings.chroma_persist_dir}")
                            else:
                                logger.warning("Chroma persist directory does not exist")
                                return None

                        self._vector_store = Chroma(
                            persist_directory=settings.chroma_persist_dir,
                            embedding_function=embeddings,
                            collection_name=settings.chroma_collection_name
                        )
                        logger.info("Initialized Chroma vector store")
                    except Exception as e:
                        logger.error(f"Failed to initialize vector store: {e}")
                        raise

        return self._vector_store
    
    async def store_documents(self, documents: List[Document]) -> bool:
        """
        Store documents in the vector store.
        
        Args:
            documents: List of documents to store
            
        Returns:
            True if successful, False otherwise
        """
        if not documents:
            logger.warning("No documents provided for storage")
            return False
        
        try:
            embeddings = self.embeddings
            
            # Create vector store with documents
            vector_store = Chroma.from_documents(
                documents=documents,
                embedding=embeddings,
                persist_directory=settings.chroma_persist_dir,
                collection_name=settings.chroma_collection_name
            )
            
            # Update our instance
            async with self._lock:
                self._vector_store = vector_store
                # Clear retriever cache when new documents are added
                self._retriever_cache.clear()
            
            logger.success(f"Successfully stored {len(documents)} documents in vector store")
            return True
            
        except Exception as e:
            logger.error(f"Failed to store documents: {e}")
            return False
    
    @lru_cache(maxsize=10)
    def _get_cached_retriever(self, search_type: str, k: int) -> Optional[BaseRetriever]:
        """Get cached retriever instance."""
        cache_key = f"{search_type}_{k}"
        return self._retriever_cache.get(cache_key)
    
    async def get_retriever(
        self, 
        search_type: str, 
        k: int = 5
    ) -> Optional[BaseRetriever]:
        """
        Get retriever with caching.
        
        Args:
            search_type: Type of search ('mmr', 'similarity', etc.)
            k: Number of documents to retrieve
            
        Returns:
            Configured retriever or None if vector store not available
        """
        search_type = search_type or settings.search_type
        k = k or settings.retrieval_k
        
        cache_key = f"{search_type}_{k}"
        
        # Check cache first
        if cache_key in self._retriever_cache:
            return self._retriever_cache[cache_key]
        
        vector_store = await self.get_vector_store()
        if vector_store is None:
            logger.warning("Vector store not available for retriever")
            return None
        
        try:
            retriever = vector_store.as_retriever(
                search_type=search_type,
                search_kwargs={"k": k}
            )
            
            # Cache the retriever
            self._retriever_cache[cache_key] = retriever
            logger.debug(f"Created and cached retriever: {search_type}, k={k}")
            return retriever
            
        except Exception as e:
            logger.error(f"Failed to create retriever: {e}")
            return None
    
    async def similarity_search(
        self, 
        query: str, 
        k: int = 5
    ) -> List[Document]:
        """
        Perform similarity search.
        
        Args:
            query: Search query
            k: Number of results to return
            
        Returns:
            List of relevant documents
        """
        k = k or settings.retrieval_k
        vector_store = await self.get_vector_store()
        
        if vector_store is None:
            logger.warning("Vector store not available for similarity search")
            return []
        
        try:
            results = vector_store.similarity_search(query, k=k)
            logger.debug(f"Found {len(results)} similar documents for query")
            return results
            
        except Exception as e:
            logger.error(f"Similarity search failed: {e}")
            return []
    
    async def check_database_status(self) -> Dict[str, Any]:
        """
        Check the status of the vector database.
        
        Returns:
            Dictionary with database status information
        """
        try:
            vector_store = await self.get_vector_store()
            
            if vector_store is None:
                return {
                    "status": "not_available",
                    "message": "Vector store not initialized",
                    "document_count": 0
                }
            
            # Try to get collection info
            try:
                collection = vector_store._collection
                doc_count = collection.count()
                
                return {
                    "status": "healthy",
                    "message": "Vector store is operational",
                    "document_count": doc_count,
                    "collection_name": settings.chroma_collection_name
                }
            except Exception as e:
                logger.warning(f"Could not get collection info: {e}")
                return {
                    "status": "available",
                    "message": "Vector store exists but collection info unavailable",
                    "document_count": "unknown"
                }
                
        except Exception as e:
            logger.error(f"Database status check failed: {e}")
            return {
                "status": "error",
                "message": f"Database check failed: {str(e)}",
                "document_count": 0
            }
    
    async def reset_database(self) -> bool:
        """
        Reset the vector database by removing all data.
        
        Returns:
            True if successful, False otherwise
        """
        try:
            if os.path.exists(settings.chroma_persist_dir):
                import shutil
                shutil.rmtree(settings.chroma_persist_dir)
                logger.info("Removed existing vector database")
            
            # Reset instance variables
            async with self._lock:
                self._vector_store = None
                self._retriever_cache.clear()
            
            logger.success("Vector database reset successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to reset database: {e}")
            return False


# Global vector store service instance
vector_store_service = VectorStoreService()
