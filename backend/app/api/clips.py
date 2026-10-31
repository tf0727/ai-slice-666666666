"""切片结果接口：列表、下载"""

import os
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models import Clip, ClipResponse

router = APIRouter(prefix="/api", tags=["clips"])


@router.get("/tasks/{task_id}/clips", response_model=list[ClipResponse])
async def list_clips(task_id: UUID, db: AsyncSession = Depends(get_db)):
    """获取指定任务的切片列表"""
    result = await db.execute(
        select(Clip).where(Clip.task_id == task_id).order_by(Clip.clip_index)
    )
    clips = result.scalars().all()

    clip_responses = []
    for clip in clips:
        resp = ClipResponse.model_validate(clip)
        if clip.file_key:
            resp.download_url = f"/api/clips/{clip.id}/download"
        clip_responses.append(resp)

    return clip_responses


@router.get("/clips/{clip_id}/download")
async def download_clip(clip_id: UUID, db: AsyncSession = Depends(get_db)):
    """从本地存储下载切片文件"""
    result = await db.execute(select(Clip).where(Clip.id == clip_id))
    clip = result.scalar_one_or_none()
    if not clip:
        raise HTTPException(status_code=404, detail="切片不存在")
    if not clip.file_key:
        raise HTTPException(status_code=404, detail="切片文件尚未生成")

    # file_key 存的是本地相对路径 clips/{task_id}/filename.mp4
    file_path = os.path.join(settings.storage_dir, clip.file_key)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"切片文件不存在: {clip.file_key}")

    return FileResponse(
        file_path,
        media_type="video/mp4",
        filename=os.path.basename(file_path),
    )


@router.post("/clips/{clip_id}/viral-titles")
async def generate_viral_titles(clip_id: UUID, db: AsyncSession = Depends(get_db)):
    """为指定切片生成 5 个抖音风格爆款标题（每次调用覆盖旧结果）"""
    from app.services.viral_title_generator import ViralTitleGenerator
    from app.models import ViralTitlesResponse

    result = await db.execute(select(Clip).where(Clip.id == clip_id))
    clip = result.scalar_one_or_none()
    if not clip:
        raise HTTPException(status_code=404, detail="切片不存在")

    # 构建上下文
    clip_context = {
        "title": clip.title,
        "summary": clip.summary,
        "clip_type": clip.clip_type,
        "suggested_caption": clip.suggested_caption,
    }

    generator = ViralTitleGenerator()
    titles = await generator.generate(clip_context)

    # 持久化到数据库
    clip.viral_titles = titles
    await db.commit()

    return ViralTitlesResponse(
        clip_id=str(clip_id),
        viral_titles=titles,
    )


@router.post("/clips/{clip_id}/editing-guide")
async def generate_editing_guide(clip_id: UUID, db: AsyncSession = Depends(get_db)):
    """为指定切片生成结构化剪辑思路（每次调用覆盖旧结果）"""
    from app.services.editing_guide_generator import EditingGuideGenerator
    from app.models import EditingGuideResponse

    result = await db.execute(select(Clip).where(Clip.id == clip_id))
    clip = result.scalar_one_or_none()
    if not clip:
        raise HTTPException(status_code=404, detail="切片不存在")

    # 构建上下文
    clip_context = {
        "title": clip.title,
        "summary": clip.summary,
        "clip_type": clip.clip_type,
        "duration": clip.duration,
        "virality_score": clip.virality_score,
    }

    generator = EditingGuideGenerator()
    guide = await generator.generate(clip_context)

    # 持久化到数据库
    clip.editing_guide = guide
    await db.commit()

    return EditingGuideResponse(
        clip_id=str(clip_id),
        editing_guide=guide,
    )
