"""
File processing service for handling file uploads with validation and security.
"""
import os
import uuid
import asyncio
import aiofiles
import shutil
from typing import List, Dict, Any, Tuple, Optional
from pathlib import Path
from fastapi import UploadFile, HTTPException
from loguru import logger

from app.config.settings import settings
from app.core.utils import (
    is_path_ignored, safe_filename, validate_file_size,
    ensure_directory, cleanup_directory
)
from app.services.document_processor import document_processor
from app.models.schemas import FileProcessingStats


class FileProcessingService:
    """Service for handling file uploads and processing."""

    def __init__(self):
        self._processing_lock = asyncio.Lock()

    async def _save_uploaded_file(
        self,
        file: UploadFile,
        temp_dir: str
    ) -> tuple[str, bool]:
        """
        Save an uploaded file to temporary directory with validation.

        Args:
            file: FastAPI UploadFile object
            temp_dir: Temporary directory path

        Returns:
            Tuple of (file_path, success)
        """
        if not file.filename:
            logger.warning("File has no filename")
            return "", False

        # Create safe filename
        safe_name = safe_filename(file.filename)
        file_path = os.path.join(temp_dir, safe_name)

        # Ensure subdirectories exist if filename contains path separators
        file_dir = os.path.dirname(file_path)
        if file_dir != temp_dir:
            await ensure_directory(file_dir)

        # Check if path is within temp directory (security)
        abs_temp_dir = os.path.abspath(temp_dir)
        abs_file_path = os.path.abspath(file_path)
        if not abs_file_path.startswith(abs_temp_dir):
            logger.warning(f"Potential path traversal attempt: {file.filename}")
            return "", False

        try:
            # Save file asynchronously
            async with aiofiles.open(file_path, 'wb') as f:
                while chunk := await file.read(8192):  # 8KB chunks
                    await f.write(chunk)

            # Validate file size after saving
            if not validate_file_size(file_path, settings.max_file_size_mb):
                logger.warning(f"File exceeds size limit: {file.filename}")
                try:
                    os.remove(file_path)
                except Exception:
                    pass
                return "", False

            logger.debug(f"Saved uploaded file: {file_path}")
            return file_path, True

        except Exception as e:
            logger.error(f"Failed to save uploaded file {file.filename}: {e}")
            # Clean up partial file
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception:
                    pass
            return "", False

    async def _validate_file_for_processing(self, file: UploadFile) -> Dict[str, Any]:
        """
        Validate file before processing.

        Args:
            file: UploadFile to validate

        Returns:
            Dict with validation result
        """
        validation_result = {
            "valid": True,
            "reason": "",
            "file_info": {
                "filename": file.filename,
                "content_type": file.content_type,
                "size": 0
            }
        }

        if not file.filename:
            validation_result["valid"] = False
            validation_result["reason"] = "No filename provided"
            return validation_result

        # Check if file should be ignored
        if is_path_ignored(file.filename, settings.ignore_patterns):
            validation_result["valid"] = False
            validation_result["reason"] = "File matches ignore patterns"
            return validation_result

        # Get file size
        try:
            file_size = 0
            current_pos = file.file.tell()  # Remember current position
            file.file.seek(0, 2)  # Seek to end
            file_size = file.file.tell()
            file.file.seek(current_pos)  # Restore position

            validation_result["file_info"]["size"] = file_size

            # Check size limit
            max_size_bytes = settings.max_file_size_mb * 1024 * 1024
            if file_size > max_size_bytes:
                validation_result["valid"] = False
                validation_result["reason"] = f"File exceeds {settings.max_file_size_mb}MB limit"
                return validation_result

        except Exception as e:
            logger.warning(f"Could not determine file size for {file.filename}: {e}")

        return validation_result

    async def process_uploaded_files(
        self,
        files: List[UploadFile]
    ) -> FileProcessingStats:
        """
        Process multiple uploaded files.

        Args:
            files: List of uploaded files

        Returns:
            FileProcessingStats with processing results
        """
        if not files:
            raise HTTPException(status_code=400, detail="No files provided")

        async with self._processing_lock:
            temp_dir = settings.temp_files_dir

            try:
                # Ensure temp directory exists
                await ensure_directory(temp_dir)

                # Validate all files first
                valid_files = []
                skipped_files = 0

                for file in files:
                    validation = await self._validate_file_for_processing(file)
                    if validation["valid"]:
                        valid_files.append(file)
                    else:
                        logger.info(f"Skipping file {file.filename}: {validation['reason']}")
                        skipped_files += 1

                if not valid_files:
                    raise HTTPException(
                        status_code=400,
                        detail="No valid files found for processing"
                    )

                logger.info(f"Processing {len(valid_files)} valid files, skipping {skipped_files}")

                # Save files concurrently
                save_tasks = [
                    self._save_uploaded_file(file, temp_dir)
                    for file in valid_files
                ]
                save_results = await asyncio.gather(*save_tasks, return_exceptions=True)

                # Collect successfully saved file paths
                saved_file_paths = []
                failed_saves = 0

                for i, result in enumerate(save_results):
                    if isinstance(result, Exception):
                        logger.error(f"Save task failed for {valid_files[i].filename}: {result}")
                        failed_saves += 1
                        continue

                    file_path, success = isinstance(result, tuple) and result or (result, True)
                    if success and file_path:
                        saved_file_paths.append(file_path)
                    else:
                        failed_saves += 1

                if not saved_file_paths:
                    raise HTTPException(
                        status_code=500,
                        detail="Failed to save any uploaded files"
                    )

                # Process saved files
                processing_result = await document_processor.process_files_concurrent(saved_file_paths)

                return FileProcessingStats(
                    total_files=len(files),
                    processed_files=processing_result.documents_processed,
                    skipped_files=skipped_files,
                    failed_files=failed_saves + processing_result.documents_failed,
                    processing_time_seconds=processing_result.processing_time
                )

            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"File processing failed: {e}")
                raise HTTPException(
                    status_code=500,
                    detail=f"File processing failed: {str(e)}"
                )
            finally:
                # Always cleanup temp directory
                await cleanup_directory(temp_dir)

    async def process_directory_files(
        self,
        directory_path: str,
        recursive: bool = True
    ) -> FileProcessingStats:
        """
        Process files from a directory.

        Args:
            directory_path: Path to directory to process
            recursive: Whether to process subdirectories

        Returns:
            FileProcessingStats with processing results
        """
        if not os.path.exists(directory_path):
            raise HTTPException(
                status_code=400,
                detail=f"Directory not found: {directory_path}"
            )

        if not os.path.isdir(directory_path):
            raise HTTPException(
                status_code=400,
                detail=f"Path is not a directory: {directory_path}"
            )

        try:
            # Collect all files
            file_paths = []

            if recursive:
                for root, dirs, files in os.walk(directory_path):
                    # Skip ignored directories
                    dirs[:] = [d for d in dirs if not is_path_ignored(
                        os.path.join(root, d), settings.ignore_patterns
                    )]

                    for filename in files:
                        file_path = os.path.join(root, filename)
                        if not is_path_ignored(file_path, settings.ignore_patterns):
                            file_paths.append(file_path)
            else:
                for filename in os.listdir(directory_path):
                    file_path = os.path.join(directory_path, filename)
                    if (os.path.isfile(file_path) and
                            not is_path_ignored(file_path, settings.ignore_patterns)):
                        file_paths.append(file_path)

            if not file_paths:
                return FileProcessingStats(
                    total_files=0,
                    processed_files=0,
                    skipped_files=0,
                    failed_files=0,
                    processing_time_seconds=0.0
                )

            logger.info(f"Found {len(file_paths)} files in directory {directory_path}")

            # Process files
            processing_result = await document_processor.process_files_concurrent(file_paths)

            return FileProcessingStats(
                total_files=len(file_paths),
                processed_files=processing_result.documents_processed,
                skipped_files=0,  # Already filtered
                failed_files=processing_result.documents_failed,
                processing_time_seconds=processing_result.processing_time
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Directory processing failed: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Directory processing failed: {str(e)}"
            )

    # New helper: process files from disk paths (for background tasks)
    async def process_uploaded_file_paths(self, paths: List[str]) -> FileProcessingStats:
        """
        Accepts saved file paths and processes them (reuses document_processor).
        Returns FileProcessingStats.
        """
        if not paths:
            raise HTTPException(status_code=400, detail="No file paths provided")

        try:
            processing_result = await document_processor.process_files_concurrent(paths)
            return FileProcessingStats(
                total_files=len(paths),
                processed_files=processing_result.documents_processed,
                skipped_files=0,
                failed_files=processing_result.documents_failed,
                processing_time_seconds=processing_result.processing_time
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Error processing uploaded file paths")
            raise HTTPException(status_code=500, detail=f"Processing failed: {e}")

    # New helper: accept (filename, bytes) items, save to temp dir, process, and cleanup
    async def process_uploaded_file_bytes(self, items: List[Tuple[str, bytes]]) -> FileProcessingStats:
        """
        Accepts list[(filename, bytes)], writes them to a per-task temp dir,
        calls the existing document_processor, then cleans up. Returns FileProcessingStats.
        """
        if not items:
            raise HTTPException(status_code=400, detail="No file data provided")

        task_temp_dir = os.path.join(settings.temp_files_dir, f"upload_{uuid.uuid4().hex}")
        await ensure_directory(task_temp_dir)
        saved_paths: List[str] = []

        try:
            # Save bytes to temp files
            for filename, data in items:
                safe_name = safe_filename(filename)
                dest_path = os.path.join(task_temp_dir, safe_name)
                dest_dir = os.path.dirname(dest_path)
                if dest_dir and not os.path.exists(dest_dir):
                    await ensure_directory(dest_dir)
                try:
                    async with aiofiles.open(dest_path, "wb") as fh:
                        await fh.write(data)
                    saved_paths.append(dest_path)
                except Exception:
                    logger.exception("Failed to save temp file for %s", filename)
                    # ensure partial file removal
                    try:
                        if os.path.exists(dest_path):
                            os.remove(dest_path)
                    except Exception:
                        pass

            if not saved_paths:
                raise HTTPException(status_code=400, detail="No files saved for processing")

            # Reuse existing concurrent document processing
            processing_result = await document_processor.process_files_concurrent(saved_paths)

            return FileProcessingStats(
                total_files=len(items),
                processed_files=processing_result.documents_processed,
                skipped_files=0,
                failed_files=processing_result.documents_failed,
                processing_time_seconds=processing_result.processing_time
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Error processing uploaded file bytes")
            raise HTTPException(status_code=500, detail=f"Processing failed: {e}")
        finally:
            # Always cleanup the per-task directory
            await cleanup_directory(task_temp_dir)


# Global file processing service instance
file_processor = FileProcessingService()

# """
# File processing service for handling file uploads with validation and security.
# """
# import os
# import asyncio
# import aiofiles
# import shutil
# from typing import List, Dict, Any
# from pathlib import Path
# from fastapi import UploadFile, HTTPException
# from loguru import logger

# from app.config.settings import settings
# from app.core.utils import (
#     is_path_ignored, safe_filename, validate_file_size, 
#     ensure_directory, cleanup_directory
# )
# from app.services.document_processor import document_processor
# from app.models.schemas import FileProcessingStats


# class FileProcessingService:
#     """Service for handling file uploads and processing."""
    
#     def __init__(self):
#         self._processing_lock = asyncio.Lock()
    
#     async def _save_uploaded_file(
#         self, 
#         file: UploadFile, 
#         temp_dir: str
#     ) -> tuple[str, bool]:
#         """
#         Save an uploaded file to temporary directory with validation.
        
#         Args:
#             file: FastAPI UploadFile object
#             temp_dir: Temporary directory path
            
#         Returns:
#             Tuple of (file_path, success)
#         """
#         if not file.filename:
#             logger.warning("File has no filename")
#             return "", False
        
#         # Create safe filename
#         safe_name = safe_filename(file.filename)
#         file_path = os.path.join(temp_dir, safe_name)
        
#         # Ensure subdirectories exist if filename contains path separators
#         file_dir = os.path.dirname(file_path)
#         if file_dir != temp_dir:
#             await ensure_directory(file_dir)
        
#         # Check if path is within temp directory (security)
#         abs_temp_dir = os.path.abspath(temp_dir)
#         abs_file_path = os.path.abspath(file_path)
#         if not abs_file_path.startswith(abs_temp_dir):
#             logger.warning(f"Potential path traversal attempt: {file.filename}")
#             return "", False
        
#         try:
#             # Save file asynchronously
#             async with aiofiles.open(file_path, 'wb') as f:
#                 while chunk := await file.read(8192):  # 8KB chunks
#                     await f.write(chunk)
            
#             # Validate file size after saving
#             if not validate_file_size(file_path, settings.max_file_size_mb):
#                 logger.warning(f"File exceeds size limit: {file.filename}")
#                 os.remove(file_path)
#                 return "", False
            
#             logger.debug(f"Saved uploaded file: {file_path}")
#             return file_path, True
            
#         except Exception as e:
#             logger.error(f"Failed to save uploaded file {file.filename}: {e}")
#             # Clean up partial file
#             if os.path.exists(file_path):
#                 try:
#                     os.remove(file_path)
#                 except:
#                     pass
#             return "", False
    
#     async def _validate_file_for_processing(self, file: UploadFile) -> Dict[str, Any]:
#         """
#         Validate file before processing.
        
#         Args:
#             file: UploadFile to validate
            
#         Returns:
#             Dict with validation result
#         """
#         validation_result = {
#             "valid": True,
#             "reason": "",
#             "file_info": {
#                 "filename": file.filename,
#                 "content_type": file.content_type,
#                 "size": 0
#             }
#         }
        
#         if not file.filename:
#             validation_result["valid"] = False
#             validation_result["reason"] = "No filename provided"
#             return validation_result
        
#         # Check if file should be ignored
#         if is_path_ignored(file.filename, settings.ignore_patterns):
#             validation_result["valid"] = False
#             validation_result["reason"] = "File matches ignore patterns"
#             return validation_result
        
#         # Get file size
#         try:
#             file_size = 0
#             current_pos = file.file.tell()  # Remember current position
#             file.file.seek(0, 2)  # Seek to end
#             file_size = file.file.tell()
#             file.file.seek(current_pos)  # Restore position
            
#             validation_result["file_info"]["size"] = file_size
            
#             # Check size limit
#             max_size_bytes = settings.max_file_size_mb * 1024 * 1024
#             if file_size > max_size_bytes:
#                 validation_result["valid"] = False
#                 validation_result["reason"] = f"File exceeds {settings.max_file_size_mb}MB limit"
#                 return validation_result
                
#         except Exception as e:
#             logger.warning(f"Could not determine file size for {file.filename}: {e}")
        
#         return validation_result
    
#     async def process_uploaded_files(
#         self, 
#         files: List[UploadFile]
#     ) -> FileProcessingStats:
#         """
#         Process multiple uploaded files.
        
#         Args:
#             files: List of uploaded files
            
#         Returns:
#             FileProcessingStats with processing results
#         """
#         if not files:
#             raise HTTPException(status_code=400, detail="No files provided")
        
#         async with self._processing_lock:
#             temp_dir = settings.temp_files_dir
            
#             try:
#                 # Ensure temp directory exists
#                 await ensure_directory(temp_dir)
                
#                 # Validate all files first
#                 valid_files = []
#                 skipped_files = 0
                
#                 for file in files:
#                     validation = await self._validate_file_for_processing(file)
#                     if validation["valid"]:
#                         valid_files.append(file)
#                     else:
#                         logger.info(f"Skipping file {file.filename}: {validation['reason']}")
#                         skipped_files += 1
                
#                 if not valid_files:
#                     raise HTTPException(
#                         status_code=400, 
#                         detail="No valid files found for processing"
#                     )
                
#                 logger.info(f"Processing {len(valid_files)} valid files, skipping {skipped_files}")
                
#                 # Save files concurrently
#                 save_tasks = [
#                     self._save_uploaded_file(file, temp_dir) 
#                     for file in valid_files
#                 ]
#                 save_results = await asyncio.gather(*save_tasks, return_exceptions=True)
                
#                 # Collect successfully saved file paths
#                 saved_file_paths = []
#                 failed_saves = 0
                
#                 for i, result in enumerate(save_results):
#                     if isinstance(result, Exception):
#                         logger.error(f"Save task failed for {valid_files[i].filename}: {result}")
#                         failed_saves += 1
#                         continue
                    
#                     file_path, success = isinstance(result, tuple) and result or (result, True)
#                     if success and file_path:
#                         saved_file_paths.append(file_path)
#                     else:
#                         failed_saves += 1
                
#                 if not saved_file_paths:
#                     raise HTTPException(
#                         status_code=500, 
#                         detail="Failed to save any uploaded files"
#                     )
                
#                 # Process saved files
#                 processing_result = await document_processor.process_files_concurrent(saved_file_paths)
                
#                 return FileProcessingStats(
#                     total_files=len(files),
#                     processed_files=processing_result.documents_processed,
#                     skipped_files=skipped_files,
#                     failed_files=failed_saves + processing_result.documents_failed,
#                     processing_time_seconds=processing_result.processing_time
#                 )
                
#             except HTTPException:
#                 raise
#             except Exception as e:
#                 logger.error(f"File processing failed: {e}")
#                 raise HTTPException(
#                     status_code=500, 
#                     detail=f"File processing failed: {str(e)}"
#                 )
#             finally:
#                 # Always cleanup temp directory
#                 await cleanup_directory(temp_dir)
    
#     async def process_directory_files(
#         self, 
#         directory_path: str,
#         recursive: bool = True
#     ) -> FileProcessingStats:
#         """
#         Process files from a directory.
        
#         Args:
#             directory_path: Path to directory to process
#             recursive: Whether to process subdirectories
            
#         Returns:
#             FileProcessingStats with processing results
#         """
#         if not os.path.exists(directory_path):
#             raise HTTPException(
#                 status_code=400, 
#                 detail=f"Directory not found: {directory_path}"
#             )
        
#         if not os.path.isdir(directory_path):
#             raise HTTPException(
#                 status_code=400, 
#                 detail=f"Path is not a directory: {directory_path}"
#             )
        
#         try:
#             # Collect all files
#             file_paths = []
            
#             if recursive:
#                 for root, dirs, files in os.walk(directory_path):
#                     # Skip ignored directories
#                     dirs[:] = [d for d in dirs if not is_path_ignored(
#                         os.path.join(root, d), settings.ignore_patterns
#                     )]
                    
#                     for filename in files:
#                         file_path = os.path.join(root, filename)
#                         if not is_path_ignored(file_path, settings.ignore_patterns):
#                             file_paths.append(file_path)
#             else:
#                 for filename in os.listdir(directory_path):
#                     file_path = os.path.join(directory_path, filename)
#                     if (os.path.isfile(file_path) and 
#                         not is_path_ignored(file_path, settings.ignore_patterns)):
#                         file_paths.append(file_path)
            
#             if not file_paths:
#                 return FileProcessingStats(
#                     total_files=0,
#                     processed_files=0,
#                     skipped_files=0,
#                     failed_files=0,
#                     processing_time_seconds=0.0
#                 )
            
#             logger.info(f"Found {len(file_paths)} files in directory {directory_path}")
            
#             # Process files
#             processing_result = await document_processor.process_files_concurrent(file_paths)
            
#             return FileProcessingStats(
#                 total_files=len(file_paths),
#                 processed_files=processing_result.documents_processed,
#                 skipped_files=0,  # Already filtered
#                 failed_files=processing_result.documents_failed,
#                 processing_time_seconds=processing_result.processing_time
#             )
            
#         except HTTPException:
#             raise
#         except Exception as e:
#             logger.error(f"Directory processing failed: {e}")
#             raise HTTPException(
#                 status_code=500, 
#                 detail=f"Directory processing failed: {str(e)}"
#             )


# # Global file processing service instance
# file_processor = FileProcessingService()
