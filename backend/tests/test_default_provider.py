import os
import unittest
from unittest.mock import patch

from app.config import Settings
from app.services import transcriber


class DefaultProviderTests(unittest.TestCase):
    def test_clean_install_uses_aliyun(self):
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings(_env_file=None)
        self.assertEqual(settings.asr_provider, 'aliyun')
        with patch.object(transcriber, 'settings', settings):
            self.assertIsInstance(transcriber.get_transcriber(), transcriber.AliyunASRTranscriber)

    def test_only_aliyun_provider_is_shipped(self):
        self.assertFalse(hasattr(transcriber, 'GroqASRTranscriber'))
