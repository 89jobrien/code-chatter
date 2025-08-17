from typing import List, Tuple, Optional
from uuid import uuid4
import os
from pathlib import Path
import aiofiles
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from starlette.status import HTTP_202_ACCEPTED
from loguru import logger

from app.models.schemas import RepoURL
from app.api.v1.deps import get_repository_service, get_file_processor, get_background_task_service
from app.config.settings import settings
from app.core.utils import ensure_directory, cleanup_directory, safe_filename

router = APIRouter()

IN_MEMORY_LIMIT_BYTES = 5 * 1024 * 1024


@router.post("/process-repo", status_code=HTTP_202_ACCEPTED, tags=["Data Processing"])
async def process_repository(
    repo_url: RepoURL,
    repo_service=Depends(get_repository_service),
    bg_service=Depends(get_background_task_service)
):
    task_id = bg_service.create_task(
        name=f"Processing repository: {repo_url.url}",
        task_func=repo_service.process_repository,
        repo_url=str(repo_url.url)
    )
    return {
        "message": "Repository processing started in the background.",
        "task_id": task_id,
        "status_url": f"/api/v1/tasks/{task_id}"
    }


@router.post("/process-files", status_code=HTTP_202_ACCEPTED, tags=["Data Processing"])
async def process_uploaded_files(
    files: List[UploadFile] = File(...),
    file_proc=Depends(get_file_processor),
    bg_service=Depends(get_background_task_service)
):
    """
    Read uploaded files while the request is active and schedule a background task.
    Small files are kept in memory as (filename, bytes). Large files are written to
    a per-task temp directory and their paths are passed to the background worker.
    """

    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    # Prepare per-task temp dir (created lazily)
    task_temp_dir: Optional[str] = None
    saved_paths: List[str] = []
    items_in_memory: List[Tuple[str, bytes]] = []

    try:
        for f in files:
            # Read while the request is still active
            try:
                content = await f.read()
            except Exception as exc:
                logger.exception("Failed reading uploaded file %s: %s", f.filename, exc)
                continue

            if not content:
                logger.warning("Skipping empty upload: %s", f.filename)
                continue

            filename = safe_filename(f.filename or f"upload_{uuid4().hex}")

            # If small, keep in memory
            if len(content) <= IN_MEMORY_LIMIT_BYTES:
                items_in_memory.append((filename, content))
                continue

            # Otherwise write to a per-task temp dir on disk
            if task_temp_dir is None:
                task_temp_dir = os.path.join(settings.temp_files_dir, f"upload_{uuid4().hex}")
                await ensure_directory(task_temp_dir)

            dest_path = os.path.join(task_temp_dir, filename)
            dest_dir = os.path.dirname(dest_path)
            if dest_dir and not os.path.exists(dest_dir):
                await ensure_directory(dest_dir)

            try:
                async with aiofiles.open(dest_path, "wb") as out_f:
                    await out_f.write(content)
                saved_paths.append(dest_path)
            except Exception:
                logger.exception("Failed to write temp file for %s", filename)
                try:
                    if os.path.exists(dest_path):
                        os.remove(dest_path)
                except Exception:
                    pass
                continue

        if not items_in_memory and not saved_paths:
            # Nothing to process after filtering
            if task_temp_dir:
                await cleanup_directory(task_temp_dir)
            raise HTTPException(status_code=400, detail="No processable files after filtering")

        # Background worker wrapper: accepts in-memory items and paths, cleans up work_dir
        async def _bg_worker(items: List[Tuple[str, bytes]], paths: List[str], work_dir: Optional[str]):
            try:
                # Process in-memory items
                if items:
                    if hasattr(file_proc, "process_uploaded_file_bytes"):
                        await file_proc.process_uploaded_file_bytes(items)
                    else:
                        # Fallback: write bytes to temp files and call paths-based method
                        fallback_dir = None
                        try:
                            fallback_dir = work_dir or os.path.join(settings.temp_files_dir, f"upload_fallback_{uuid4().hex}")
                            await ensure_directory(fallback_dir)
                            fallback_paths = []
                            for name, data in items:
                                p = os.path.join(fallback_dir, name)
                                async with aiofiles.open(p, "wb") as fh:
                                    await fh.write(data)
                                fallback_paths.append(p)
                            if hasattr(file_proc, "process_uploaded_file_paths"):
                                await file_proc.process_uploaded_file_paths(fallback_paths)
                            else:
                                raise RuntimeError("file processor missing required methods")
                        finally:
                            if fallback_dir:
                                await cleanup_directory(fallback_dir)

                # Process saved paths
                if paths:
                    if hasattr(file_proc, "process_uploaded_file_paths"):
                        await file_proc.process_uploaded_file_paths(paths)
                    else:
                        # If only bytes method exists, read files and convert to bytes then call it
                        if hasattr(file_proc, "process_uploaded_file_bytes"):
                            tmp_items = []
                            for p in paths:
                                async with aiofiles.open(p, "rb") as fh:
                                    data = await fh.read()
                                tmp_items.append((os.path.basename(p), data))
                            await file_proc.process_uploaded_file_bytes(tmp_items)
                        else:
                            raise RuntimeError("file processor missing required methods")
            finally:
                # always cleanup per-task work dir if it was created
                if work_dir:
                    await cleanup_directory(work_dir)

        # Create background task
        task_id = bg_service.create_task(
            name=f"Processing {len(items_in_memory) + len(saved_paths)} uploaded files",
            task_func=_bg_worker,
            items=items_in_memory,
            paths=saved_paths,
            work_dir=task_temp_dir
        )

        return {
            "message": "File processing started in the background.",
            "task_id": task_id,
            "status_url": f"/api/v1/tasks/{task_id}"
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to schedule file processing task: %s", exc)
        if task_temp_dir:
            await cleanup_directory(task_temp_dir)
        raise HTTPException(status_code=500, detail="Failed to schedule file processing")

@router.post("/analyze-repo-structure", tags=["Data Processing"])
async def analyze_repository_structure(
    repo_url: RepoURL,
    repo_service=Depends(get_repository_service)
):
    return await repo_service.get_repository_structure(str(repo_url.url))