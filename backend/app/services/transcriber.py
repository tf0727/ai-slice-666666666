"""Timestamped Alibaba Cloud Paraformer speech transcription."""

import asyncio
import json
import os
import uuid
from abc import ABC, abstractmethod
from contextlib import suppress
from pathlib import Path

from websockets.asyncio.client import connect as websocket_connect
from websockets.exceptions import InvalidStatus

from app.config import settings


class BaseTranscriber(ABC):
    """Base transcriber."""

    @abstractmethod
    async def transcribe(
        self,
        audio_path: str,
        audio_duration: float | None = None,
    ) -> list[dict]:
        """Return timestamped transcript segments."""


class AliyunASRTranscriber(BaseTranscriber):
    """Stream local mono audio to Paraformer and retain final sentence timestamps."""

    async def transcribe(self, audio_path: str, audio_duration: float | None = None) -> list[dict]:
        api_key = settings.dashscope_api_key.strip()
        if not api_key:
            raise RuntimeError("未配置阿里云 API Key。请在 .env 中设置 DASHSCOPE_API_KEY。")
        audio_format = Path(audio_path).suffix.lower().lstrip(".")
        if audio_format not in {"mp3", "wav", "pcm", "aac", "amr", "opus", "speex"}:
            raise RuntimeError("阿里云转录暂不支持此音频格式，请上传视频由浏览器提取 MP3，或上传单声道 MP3/WAV。")
        if not os.path.getsize(audio_path):
            raise RuntimeError("音频文件为空。")
        task_id = uuid.uuid4().hex

        def command(action, payload):
            return json.dumps({"header": {"action": action, "task_id": task_id, "streaming": "duplex"},
                               "payload": payload})

        async def receive(ws):
            event = json.loads(await asyncio.wait_for(ws.recv(), timeout=120))
            header = event.get("header", {})
            if header.get("event") == "task-failed":
                detail = str(header.get("error_message", "未知错误")).replace(api_key, "[redacted]")
                code = str(header.get("error_code", "unknown")).replace(api_key, "[redacted]")
                raise RuntimeError(f"阿里云 ASR 失败 ({code}): {detail[:250]}")
            return event

        async def send_audio(ws):
            # Read bounded frames instead of holding a full livestream in memory.
            with open(audio_path, "rb") as audio:
                while chunk := audio.read(3200):
                    await ws.send(chunk)
                    await asyncio.sleep(0.01)
            await ws.send(command("finish-task", {"input": {}}))

        async def collect(ws):
            segments = []
            while True:
                event = await receive(ws)
                kind = event.get("header", {}).get("event")
                if kind == "task-finished":
                    return sorted(segments, key=lambda segment: segment["start"])
                if kind != "result-generated":
                    continue
                sentence = event.get("payload", {}).get("output", {}).get("sentence", {})
                text = sentence.get("text", "").strip()
                if not sentence.get("sentence_end") or sentence.get("heartbeat") or not text:
                    continue
                start, end = sentence.get("begin_time"), sentence.get("end_time")
                # Some final responses only provide the end on the last word.
                if end is None:
                    ends = [word["end_time"] for word in sentence.get("words", []) if word.get("end_time") is not None]
                    end = max(ends) if ends else None
                if start is None or end is None or end < start:
                    raise RuntimeError("阿里云返回的转录缺少有效时间戳，无法生成切片。")
                segments.append({"start": start / 1000.0, "end": end / 1000.0, "text": text})

        try:
            async with websocket_connect(
                settings.dashscope_asr_url,
                additional_headers={"Authorization": f"Bearer {api_key}"},
                open_timeout=30, max_size=4 * 1024 * 1024,
            ) as ws:
                await ws.send(command("run-task", {
                    "task_group": "audio", "task": "asr", "function": "recognition",
                    "model": settings.dashscope_asr_model,
                    "parameters": {"format": audio_format, "sample_rate": settings.dashscope_asr_sample_rate,
                                   "heartbeat": True},
                    "input": {},
                }))
                started = await receive(ws)
                if started.get("header", {}).get("event") != "task-started":
                    raise RuntimeError("阿里云未确认转录任务启动。")
                sender = asyncio.create_task(send_audio(ws))
                receiver = asyncio.create_task(collect(ws))
                try:
                    _, segments = await asyncio.gather(sender, receiver)
                    return segments
                finally:
                    for task in (sender, receiver):
                        task.cancel()
                    for task in (sender, receiver):
                        with suppress(asyncio.CancelledError, Exception):
                            await task
        except InvalidStatus as exc:
            raise RuntimeError(
                f"阿里云 ASR 鉴权/连接失败 (HTTP {exc.response.status_code})，"
                "请检查 DASHSCOPE_API_KEY、地域及业务空间接入地址。"
            ) from None
        except TimeoutError:
            raise RuntimeError("阿里云 ASR 响应超时，请检查网络后重试。") from None


def get_transcriber() -> BaseTranscriber:
    """Return the supported Alibaba Cloud transcription service."""
    if settings.asr_provider.strip().lower() != "aliyun":
        raise ValueError("ASR_PROVIDER 必须为 aliyun。")
    return AliyunASRTranscriber()
