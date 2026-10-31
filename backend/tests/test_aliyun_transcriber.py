import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from app.services import transcriber


class AliyunTranscriberTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.config = SimpleNamespace(
            asr_provider="aliyun", dashscope_api_key="test-aliyun-key",
            dashscope_asr_model="paraformer-realtime-v2",
            dashscope_asr_url="wss://dashscope.aliyuncs.com/api-ws/v1/inference",
            dashscope_asr_sample_rate=16000,
        )
        self.settings_patch = patch.object(transcriber, "settings", self.config)
        self.settings_patch.start()
        self.addCleanup(self.settings_patch.stop)

    def test_select_aliyun(self):
        self.assertIsInstance(transcriber.get_transcriber(), transcriber.AliyunASRTranscriber)

    def test_unknown_provider_is_rejected(self):
        self.config.asr_provider = "typo"
        with self.assertRaisesRegex(ValueError, "ASR_PROVIDER"):
            transcriber.get_transcriber()

    async def test_missing_aliyun_key_names_correct_setting(self):
        self.config.dashscope_api_key = ""
        with self.assertRaisesRegex(RuntimeError, "DASHSCOPE_API_KEY"):
            await transcriber.get_transcriber().transcribe("unused.mp3")

    async def test_stream_protocol_and_final_timestamps(self):
        events = asyncio.Queue()
        events.put_nowait(json.dumps({"header": {"event": "task-started"}}))
        sent = []
        class Socket:
            async def send(self, data):
                sent.append(data)
                if isinstance(data, str) and json.loads(data)["header"]["action"] == "finish-task":
                    for sentence in [
                        {"text": "partial", "sentence_end": False},
                        {"text": "心跳", "sentence_end": True, "heartbeat": True},
                        {"text": " 第一段 ", "sentence_end": True, "begin_time": 1250,
                         "end_time": None, "words": [{"end_time": 2500}]},
                    ]:
                        events.put_nowait(json.dumps({"header": {"event": "result-generated"},
                            "payload": {"output": {"sentence": sentence}}}))
                    events.put_nowait(json.dumps({"header": {"event": "task-finished"}}))
            async def recv(self):
                return await events.get()
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                pass
        with tempfile.TemporaryDirectory() as folder:
            audio = Path(folder) / "sample.mp3"
            audio.write_bytes(b"test audio")
            with patch.object(transcriber, "websocket_connect", return_value=Socket()) as connect:
                result = await asyncio.wait_for(transcriber.get_transcriber().transcribe(str(audio)), 2)
        self.assertEqual(result, [{"start": 1.25, "end": 2.5, "text": "第一段"}])
        start = json.loads(sent[0])
        finish = json.loads(sent[-1])
        self.assertEqual(start["payload"]["model"], "paraformer-realtime-v2")
        self.assertEqual(start["payload"]["parameters"]["format"], "mp3")
        self.assertEqual(start["header"]["task_id"], finish["header"]["task_id"])
        self.assertEqual(sent[1], b"test audio")
        self.assertEqual(connect.call_args.kwargs["additional_headers"]["Authorization"], "Bearer test-aliyun-key")

    async def test_remote_failure_is_reported_without_secret(self):
        class FailedSocket:
            async def send(self, data):
                pass
            async def recv(self):
                return json.dumps({"header": {"event": "task-failed", "error_code": "InvalidApiKey",
                    "error_message": "bad test-aliyun-key"}})
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                pass
        with tempfile.TemporaryDirectory() as folder:
            audio = Path(folder) / "sample.mp3"
            audio.write_bytes(b"test audio")
            with patch.object(transcriber, "websocket_connect", return_value=FailedSocket()):
                with self.assertRaisesRegex(RuntimeError, "InvalidApiKey") as error:
                    await transcriber.get_transcriber().transcribe(str(audio))
        self.assertNotIn(self.config.dashscope_api_key, str(error.exception))
