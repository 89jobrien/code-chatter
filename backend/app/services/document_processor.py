"""
Document processing service with async capabilities and optimizations.
"""
import asyncio
import time
from typing import List, Tuple, Optional
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from loguru import logger

from langchain.text_splitter import RecursiveCharacterTextSplitter, Language
from langchain.schema import Document
from langchain_community.document_loaders import UnstructuredFileLoader

from app.config.settings import settings
from app.core.utils import is_text_file, validate_file_size
from app.services.vector_store import vector_store_service


@dataclass
class ProcessingResult:
    """Result of document processing operation."""
    success: bool
    documents_processed: int
    documents_failed: int
    processing_time: float
    error_message: Optional[str] = None


@dataclass
class FileProcessingResult:
    """Result of individual file processing."""
    file_path: str
    success: bool
    documents: List[Document]
    error_message: Optional[str] = None

class DocumentProcessingError(Exception):
    """Custom exception for document processing with structured attributes."""
    def __init__(self, message: str, *, file_path: Optional[str] = None, documents: Optional[List[object]] = None):
        super().__init__(message)
        self.error_message = message
        self.file_path = file_path
        self.documents = documents or []
        self.success = False

class DocumentProcessingService:
    """Service for processing documents with async capabilities."""
    
    def __init__(self):
        self._text_splitter = None
        self._executor = ThreadPoolExecutor(max_workers=settings.max_concurrent_files)
    
    @property
    def text_splitter(self) -> RecursiveCharacterTextSplitter:
        """Get or create text splitter instance."""
        if self._text_splitter is None:
            self._text_splitter = RecursiveCharacterTextSplitter.from_language(
                language=Language.PYTHON,  # Default, can be made dynamic
                chunk_size=settings.chunk_size,
                chunk_overlap=settings.chunk_overlap,
            )
        return self._text_splitter
    
    def _get_language_from_extension(self, file_path: str) -> Language:
        """Determine the appropriate language for text splitting based on file extension."""
        extension = file_path.lower().split('.')[-1] if '.' in file_path else ''
        
        language_map = {
            'py': Language.PYTHON,
            'js': Language.JS,
            'ts': Language.JS,  # TypeScript uses JS splitter
            'jsx': Language.JS,
            'tsx': Language.JS,
            'java': Language.JAVA,
            'cpp': Language.CPP,
            'c': Language.CPP,
            'cs': Language.CSHARP,
            'php': Language.PHP,
            'rb': Language.RUBY,
            'go': Language.GO,
            'rs': Language.RUST,
            'kt': Language.KOTLIN,
            'swift': Language.SWIFT,
            'scala': Language.SCALA,
            'html': Language.HTML,
            'md': Language.MARKDOWN,
            'tex': Language.LATEX,
            'sol': Language.SOL,  # Solidity
        }
        
        return language_map.get(extension, Language.PYTHON)  # Default fallback
    
    def _create_text_splitter(self, file_path: str) -> RecursiveCharacterTextSplitter:
        """Create text splitter optimized for the file type."""
        language = self._get_language_from_extension(file_path)
        
        return RecursiveCharacterTextSplitter.from_language(
            language=language,
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )
    
    async def _process_single_file_async(self, file_path: str) -> FileProcessingResult:
        """
        Process a single file asynchronously.
        
        Args:
            file_path: Path to the file to process
            
        Returns:
            FileProcessingResult with processing outcome
        """
        try:
            # Validate file
            if not is_text_file(file_path):
                logger.debug(f"Skipping non-text file: {file_path}")
                return FileProcessingResult(
                    file_path=file_path,
                    success=False,
                    documents=[],
                    error_message="Not a text file"
                )
            
            if not validate_file_size(file_path, settings.max_file_size_mb):
                logger.warning(f"Skipping large file: {file_path}")
                return FileProcessingResult(
                    file_path=file_path,
                    success=False,
                    documents=[],
                    error_message=f"File exceeds {settings.max_file_size_mb}MB limit"
                )
            
            # Load document in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            documents = await loop.run_in_executor(
                self._executor,
                self._load_document,
                file_path
            )
            
            if not documents:
                return FileProcessingResult(
                    file_path=file_path,
                    success=False,
                    documents=[],
                    error_message="No content loaded from file"
                )
            
            # Split documents using appropriate text splitter
            text_splitter = self._create_text_splitter(file_path)
            split_documents = await loop.run_in_executor(
                self._executor,
                text_splitter.split_documents,
                documents
            )
            
            # Add file metadata to each chunk
            for doc in split_documents:
                if doc.metadata is None:
                    doc.metadata = {}
                doc.metadata.update({
                    'source_file': file_path,
                    'file_type': file_path.split('.')[-1] if '.' in file_path else 'unknown',
                    'processing_timestamp': time.time()
                })
            
            logger.debug(f"Processed {file_path}: {len(split_documents)} chunks")
            return FileProcessingResult(
                file_path=file_path,
                success=True,
                documents=split_documents,
            )
            
        except Exception as e:
            logger.error(f"Failed to process file {file_path}: {e}")
            return FileProcessingResult(
                file_path=file_path,
                success=False,
                documents=[],
                error_message=str(e)
            )
    
    def _load_document(self, file_path: str) -> List[Document]:
        """Load document using UnstructuredFileLoader (runs in thread pool)."""
        try:
            loader = UnstructuredFileLoader(file_path)
            return loader.load()
        except Exception as e:
            logger.warning(f"Failed to load document {file_path}: {e}")
            return []
    
    async def process_files_concurrent(
        self, 
        file_paths: List[str]
    ) -> ProcessingResult:
        """
        Process multiple files concurrently.
        
        Args:
            file_paths: List of file paths to process
            
        Returns:
            ProcessingResult with overall processing outcome
        """
        if not file_paths:
            return ProcessingResult(
                success=False,
                documents_processed=0,
                documents_failed=0,
                processing_time=0.0,
                error_message="No files provided"
            )
        
        start_time = time.time()
        logger.info(f"Starting concurrent processing of {len(file_paths)} files")
        
        # Create semaphore to limit concurrent file processing
        semaphore = asyncio.Semaphore(settings.max_concurrent_files)
        
        async def process_with_semaphore(file_path: str) -> FileProcessingResult:
            async with semaphore:
                return await self._process_single_file_async(file_path)
        
        # Process all files concurrently
        tasks = [process_with_semaphore(file_path) for file_path in file_paths]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Collect results
        all_documents = []
        successful_files = 0
        failed_files = 0
        
        for i, result in enumerate(results):
            if isinstance(result, DocumentProcessingError):
                logger.error(f"An unexpected exception occurred while processing {file_paths[i]}: {result}")
                failed_files += 1
            else:
                if isinstance(result, FileProcessingResult) and result.success:
                    all_documents.extend(result.documents)
                    successful_files += 1
                else:
                    failed_files += 1
                    if isinstance(result, FileProcessingResult) and result.error_message != "Not a text file":
                        logger.warning(f"Failed to process {result.file_path}: {result.error_message}")
        
        processing_time = time.time() - start_time
        
        # Store documents if any were processed successfully
        storage_success = True
        if all_documents:
            storage_success = await vector_store_service.store_documents(all_documents)
        
        logger.info(
            f"Processing completed: {successful_files} successful, {failed_files} failed, "
            f"{len(all_documents)} total chunks, {processing_time:.2f}s"
        )
        
        return ProcessingResult(
            success=storage_success and successful_files > 0,
            documents_processed=len(all_documents),
            documents_failed=failed_files,
            processing_time=processing_time,
            error_message=None if storage_success else "Failed to store documents in vector database"
        )
    
    async def process_documents_from_content(
        self, 
        documents: List[Document]
    ) -> ProcessingResult:
        """
        Process pre-loaded documents (for direct document input).
        
        Args:
            documents: List of documents to process
            
        Returns:
            ProcessingResult with processing outcome
        """
        if not documents:
            return ProcessingResult(
                success=False,
                documents_processed=0,
                documents_failed=0,
                processing_time=0.0,
                error_message="No documents provided"
            )
        
        start_time = time.time()
        logger.info(f"Processing {len(documents)} pre-loaded documents")
        
        try:
            # Split documents using default text splitter
            loop = asyncio.get_event_loop()
            split_documents = await loop.run_in_executor(
                self._executor,
                self.text_splitter.split_documents,
                documents
            )
            
            # Add processing metadata
            for doc in split_documents:
                if doc.metadata is None:
                    doc.metadata = {}
                doc.metadata['processing_timestamp'] = time.time()
            
            # Store in vector database
            storage_success = await vector_store_service.store_documents(split_documents)
            processing_time = time.time() - start_time
            
            logger.info(f"Document processing completed: {len(split_documents)} chunks in {processing_time:.2f}s")
            
            return ProcessingResult(
                success=storage_success,
                documents_processed=len(split_documents),
                documents_failed=0,
                processing_time=processing_time,
                error_message=None if storage_success else "Failed to store documents in vector database"
            )
            
        except Exception as e:
            processing_time = time.time() - start_time
            logger.error(f"Document processing failed: {e}")
            return ProcessingResult(
                success=False,
                documents_processed=0,
                documents_failed=len(documents),
                processing_time=processing_time,
                error_message=str(e)
            )
    
    def cleanup(self):
        """Cleanup resources."""
        if self._executor:
            self._executor.shutdown(wait=True, cancel_futures=True)
            logger.info("Document processor executor shutdown completed")


# Global document processing service instance
document_processor = DocumentProcessingService()
