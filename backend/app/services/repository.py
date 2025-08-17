"""
Repository service for Git operations and repository processing.
"""
import os
import asyncio
from typing import List, Optional
from urllib.parse import urlparse
from git import Repo, GitCommandError
from fastapi import HTTPException
from loguru import logger

from app.config.settings import settings
from app.core.utils import cleanup_directory, ensure_directory
from app.services.file_processor import file_processor
from app.models.schemas import FileProcessingStats


class RepositoryService:
    """Service for Git repository operations."""
    
    def __init__(self):
        self._clone_lock = asyncio.Lock()
    
    def _validate_git_url(self, url: str) -> bool:
        """
        Validate that the URL is a valid Git repository URL.
        
        Args:
            url: Repository URL to validate
            
        Returns:
            True if valid, False otherwise
        """
        try:
            parsed = urlparse(url)
            
            # Check for valid schemes
            valid_schemes = ['http', 'https', 'git', 'ssh']
            if parsed.scheme not in valid_schemes:
                return False
            
            # Basic validation for known Git hosting services
            valid_hosts = [
                'github.com', 'gitlab.com', 'bitbucket.org',
                'dev.azure.com', 'visualstudio.com'
            ]
            
            # Allow any host if it's not in the common list (private repos)
            if parsed.hostname and any(host in parsed.hostname for host in valid_hosts):
                return True
            elif parsed.hostname:
                # Allow other hosts but log for monitoring
                logger.info(f"Cloning from non-standard host: {parsed.hostname}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"URL validation failed: {e}")
            return False
    
    async def _clone_repository_async(self, repo_url: str, target_dir: str) -> bool:
        """
        Clone repository asynchronously.
        
        Args:
            repo_url: Git repository URL
            target_dir: Target directory for cloning
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Run git clone in a thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            
            def clone_sync():
                return Repo.clone_from(repo_url, target_dir, depth=1)  # Shallow clone
            
            await loop.run_in_executor(None, clone_sync)
            logger.success(f"Successfully cloned repository: {repo_url}")
            return True
            
        except GitCommandError as e:
            logger.error(f"Git command failed for {repo_url}: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to clone repository {repo_url}: {e}")
            return False
    
    def _get_repository_info(self, repo_path: str) -> dict:
        """
        Get information about the cloned repository.
        
        Args:
            repo_path: Path to the repository
            
        Returns:
            Dictionary with repository information
        """
        try:
            repo = Repo(repo_path)
            
            # Get basic repository information
            info = {
                "active_branch": repo.active_branch.name if repo.active_branch else "detached",
                "commit_count": len(list(repo.iter_commits())),
                "latest_commit": {
                    "hash": repo.head.commit.hexsha[:8],
                    "message": repo.head.commit.message.strip(),
                    "author": repo.head.commit.author.name,
                    "date": repo.head.commit.committed_datetime.isoformat()
                } if repo.head.commit else None,
                "remotes": [remote.name for remote in repo.remotes],
                "is_dirty": repo.is_dirty()
            }
            
            return info
            
        except Exception as e:
            logger.warning(f"Could not get repository info: {e}")
            return {"error": str(e)}
    
    async def process_repository(self, repo_url: str) -> FileProcessingStats:
        """
        Process a Git repository by cloning and analyzing its files.
        
        Args:
            repo_url: Git repository URL
            
        Returns:
            FileProcessingStats with processing results
        """
        if not self._validate_git_url(repo_url):
            raise HTTPException(
                status_code=400, 
                detail="Invalid Git repository URL"
            )
        
        async with self._clone_lock:
            temp_repo_dir = settings.temp_repo_dir
            
            try:
                # Clean up any existing temp directory
                await cleanup_directory(temp_repo_dir)
                
                # Ensure parent directory exists
                await ensure_directory(os.path.dirname(temp_repo_dir))
                
                logger.info(f"Starting repository processing: {repo_url}")
                
                # Clone repository
                clone_success = await self._clone_repository_async(repo_url, temp_repo_dir)
                if not clone_success:
                    raise HTTPException(
                        status_code=400,
                        detail="Failed to clone repository. Please check the URL and access permissions."
                    )
                
                # Get repository information
                repo_info = self._get_repository_info(temp_repo_dir)
                logger.info(f"Repository info: {repo_info}")
                
                # Process files in the repository
                processing_stats = await file_processor.process_directory_files(
                    temp_repo_dir, 
                    recursive=True
                )
                
                logger.success(
                    f"Repository processing completed: {processing_stats.processed_files} files processed"
                )
                
                return processing_stats
                
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Repository processing failed: {e}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Repository processing failed: {str(e)}"
                )
            finally:
                # Always clean up temp directory
                await cleanup_directory(temp_repo_dir)
    
    async def get_repository_structure(self, repo_url: str) -> dict:
        """
        Get the structure of a repository without processing files.
        
        Args:
            repo_url: Git repository URL
            
        Returns:
            Dictionary with repository structure information
        """
        if not self._validate_git_url(repo_url):
            raise HTTPException(
                status_code=400, 
                detail="Invalid Git repository URL"
            )
        
        temp_repo_dir = f"{settings.temp_repo_dir}_structure"
        
        try:
            # Clean up any existing temp directory
            await cleanup_directory(temp_repo_dir)
            
            # Clone repository
            clone_success = await self._clone_repository_async(repo_url, temp_repo_dir)
            if not clone_success:
                raise HTTPException(
                    status_code=400,
                    detail="Failed to clone repository for structure analysis"
                )
            
            # Get repository info
            repo_info = self._get_repository_info(temp_repo_dir)
            
            # Count files by type
            file_stats = {}
            total_files = 0
            
            for root, dirs, files in os.walk(temp_repo_dir):
                # Skip .git directory
                if '.git' in dirs:
                    dirs.remove('.git')
                
                for filename in files:
                    total_files += 1
                    extension = filename.split('.')[-1] if '.' in filename else 'no_extension'
                    file_stats[extension] = file_stats.get(extension, 0) + 1
            
            structure_info = {
                "repository_info": repo_info,
                "total_files": total_files,
                "file_types": file_stats,
                "largest_file_types": sorted(
                    file_stats.items(), 
                    key=lambda x: x[1], 
                    reverse=True
                )[:10]
            }
            
            return structure_info
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Repository structure analysis failed: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Repository structure analysis failed: {str(e)}"
            )
        finally:
            # Clean up temp directory
            await cleanup_directory(temp_repo_dir)
    
    async def validate_repository_access(self, repo_url: str) -> dict:
        """
        Validate if a repository is accessible without cloning.
        
        Args:
            repo_url: Git repository URL
            
        Returns:
            Dictionary with validation results
        """
        if not self._validate_git_url(repo_url):
            return {
                "valid": False,
                "reason": "Invalid Git repository URL format",
                "accessible": False
            }
        
        try:
            # Try to get remote references without cloning
            loop = asyncio.get_event_loop()
            
            def check_remote():
                from git.cmd import Git
                g = Git()
                return g.ls_remote(repo_url, heads=True)
            
            # This will raise an exception if the repository is not accessible
            await loop.run_in_executor(None, check_remote)
            
            return {
                "valid": True,
                "reason": "Repository is accessible",
                "accessible": True
            }
            
        except Exception as e:
            logger.warning(f"Repository access validation failed for {repo_url}: {e}")
            return {
                "valid": True,  # URL format is valid
                "reason": f"Repository not accessible: {str(e)}",
                "accessible": False
            }


# Global repository service instance
repository_service = RepositoryService()
