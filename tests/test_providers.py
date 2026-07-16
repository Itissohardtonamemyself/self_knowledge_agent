import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import unittest
from unittest.mock import patch, MagicMock


class TestBaseLLMProvider(unittest.TestCase):
    def test_ping_success(self):
        from src.modules.interaction.llm.provider import BaseLLMProvider

        class TestProvider(BaseLLMProvider):
            def generate(self, prompt: str, **kwargs) -> str:
                return "pong"

        provider = TestProvider()
        result = provider.ping()
        self.assertTrue(result)

    def test_ping_failure(self):
        from src.modules.interaction.llm.provider import BaseLLMProvider

        class TestProvider(BaseLLMProvider):
            def generate(self, prompt: str, **kwargs) -> str:
                raise Exception("Connection failed")

        provider = TestProvider()
        result = provider.ping()
        self.assertFalse(result)

    def test_ping_empty_result(self):
        from src.modules.interaction.llm.provider import BaseLLMProvider

        class TestProvider(BaseLLMProvider):
            def generate(self, prompt: str, **kwargs) -> str:
                return ""

        provider = TestProvider()
        result = provider.ping()
        self.assertFalse(result)


class TestMockLLMProvider(unittest.TestCase):
    def test_generate(self):
        from src.modules.interaction.llm.provider import MockLLMProvider

        provider = MockLLMProvider()
        result = provider.generate("Hello")
        self.assertIsInstance(result, str)
        self.assertGreater(len(result), 0)

    def test_ping(self):
        from src.modules.interaction.llm.provider import MockLLMProvider

        provider = MockLLMProvider()
        result = provider.ping()
        self.assertTrue(result)


class TestOllamaProvider(unittest.TestCase):
    def test_initialization(self):
        from src.modules.interaction.llm.provider import OllamaProvider

        provider = OllamaProvider(base_url="http://localhost:11434", model="qwen2.5:7b")
        self.assertEqual(provider._base_url, "http://localhost:11434")
        self.assertEqual(provider._model, "qwen2.5:7b")

    def test_generate_with_http_client(self):
        from src.modules.interaction.llm.provider import OllamaProvider

        mock_response = MagicMock()
        mock_response.json.return_value = {"response": "Hello!", "done": True}
        mock_response.raise_for_status.return_value = None

        mock_client = MagicMock()
        mock_client.__enter__.return_value.post.return_value = mock_response

        with patch('httpx.Client', return_value=mock_client):
            provider = OllamaProvider(base_url="http://localhost:11434", model="qwen2.5:7b")
            provider._client = None
            result = provider.generate("Hello")

            self.assertEqual(result, "Hello!")
            mock_client.__enter__.return_value.post.assert_called_once()


class TestGetAvailableModels(unittest.TestCase):
    @patch('src.modules.interaction.llm.provider.settings')
    def test_get_available_models_all_configured(self, mock_settings):
        from src.modules.interaction.llm.provider import get_available_models

        mock_settings.llm.glm_api_key = "glm-key"
        mock_settings.llm.glm_model = "glm-4.7-flash"
        mock_settings.llm.glm_base_url = "https://glm.example.com"
        mock_settings.llm.openai_api_key = "openai-key"
        mock_settings.llm.openai_model = "gpt-4o-mini"
        mock_settings.llm.openai_base_url = "https://openai.example.com"
        mock_settings.llm.ollama_model = "qwen2.5:7b"
        mock_settings.llm.ollama_base_url = "http://localhost:11434"

        models = get_available_models()

        self.assertEqual(len(models), 3)
        self.assertEqual(models[0]["provider"], "glm")
        self.assertEqual(models[1]["provider"], "openai")
        self.assertEqual(models[2]["provider"], "ollama")

    @patch('src.modules.interaction.llm.provider.settings')
    def test_get_available_models_only_ollama(self, mock_settings):
        from src.modules.interaction.llm.provider import get_available_models

        mock_settings.llm.glm_api_key = ""
        mock_settings.llm.openai_api_key = ""
        mock_settings.llm.ollama_model = "qwen2.5:7b"
        mock_settings.llm.ollama_base_url = "http://localhost:11434"

        models = get_available_models()

        self.assertEqual(len(models), 1)
        self.assertEqual(models[0]["provider"], "ollama")


class TestGetLLMProvider(unittest.TestCase):
    @patch('src.modules.interaction.llm.provider.settings')
    @patch('src.modules.interaction.llm.provider.GLMProvider')
    def test_get_llm_provider_glm(self, MockProvider, mock_settings):
        from src.modules.interaction.llm.provider import get_llm_provider

        mock_settings.llm.provider = "glm"
        mock_settings.llm.glm_model = "glm-4.7-flash"
        mock_settings.llm.glm_base_url = "https://glm.example.com"

        mock_instance = MagicMock()
        mock_instance.ping.return_value = True
        MockProvider.return_value = mock_instance

        get_llm_provider.cache_clear()
        provider = get_llm_provider()

        self.assertIs(provider, mock_instance)
        MockProvider.assert_called_once()

    @patch('src.modules.interaction.llm.provider.settings')
    @patch('src.modules.interaction.llm.provider.GLMProvider')
    def test_get_llm_provider_glm_fallback_to_mock(self, MockProvider, mock_settings):
        from src.modules.interaction.llm.provider import get_llm_provider, MockLLMProvider

        mock_settings.llm.provider = "glm"
        mock_settings.llm.glm_model = "glm-4.7-flash"

        mock_instance = MagicMock()
        mock_instance.ping.return_value = False
        MockProvider.return_value = mock_instance

        get_llm_provider.cache_clear()
        provider = get_llm_provider()

        self.assertIsInstance(provider, MockLLMProvider)

    @patch('src.modules.interaction.llm.provider.settings')
    def test_get_llm_provider_unknown_provider(self, mock_settings):
        from src.modules.interaction.llm.provider import get_llm_provider, MockLLMProvider

        mock_settings.llm.provider = "unknown"

        get_llm_provider.cache_clear()
        provider = get_llm_provider()

        self.assertIsInstance(provider, MockLLMProvider)


if __name__ == '__main__':
    unittest.main()