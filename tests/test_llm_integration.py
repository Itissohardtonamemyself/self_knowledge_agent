import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import unittest
import time
from typing import Dict, Any


class TestLLMIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from src.core.config import settings
        cls.settings = settings

    def _test_provider(self, provider_name: str, config: Dict[str, Any]) -> Dict[str, Any]:
        print(f"\n{'='*60}")
        print(f"测试 Provider: {provider_name}")
        print(f"配置: model={config.get('model')}, base_url={config.get('base_url')}")
        print(f"{'='*60}")

        start = time.perf_counter()

        try:
            if provider_name == "glm":
                from src.modules.interaction.llm.provider import GLMProvider
                provider = GLMProvider(
                    api_key=config.get("api_key"),
                    model=config.get("model"),
                    base_url=config.get("base_url"),
                )
            elif provider_name == "openai":
                from src.modules.interaction.llm.provider import OpenAIProvider
                provider = OpenAIProvider(
                    api_key=config.get("api_key"),
                    model=config.get("model"),
                    base_url=config.get("base_url"),
                )
            elif provider_name == "ollama":
                from src.modules.interaction.llm.provider import OllamaProvider
                provider = OllamaProvider(
                    base_url=config.get("base_url"),
                    model=config.get("model"),
                )
            else:
                print(f"未知 Provider: {provider_name}")
                return {"success": False, "error": f"未知 Provider: {provider_name}"}

            print(f"Provider 初始化成功")

            result = provider.generate("你好", max_tokens=50)

            elapsed = (time.perf_counter() - start) * 1000

            if result and len(result) > 0:
                print(f"✓ API 调用成功!")
                print(f"  延迟: {elapsed:.2f}ms")
                print(f"  返回: {result[:100]}...")
                return {
                    "success": True,
                    "provider": provider_name,
                    "model": config.get("model"),
                    "latency_ms": elapsed,
                    "response": result[:100],
                }
            else:
                print(f"✗ API 调用失败: 返回空结果")
                return {"success": False, "provider": provider_name, "error": "返回空结果"}

        except Exception as e:
            elapsed = (time.perf_counter() - start) * 1000
            import traceback
            print(f"✗ API 调用失败: {e}")
            print(f"  详细错误: {traceback.format_exc()}")
            print(f"  耗时: {elapsed:.2f}ms")
            return {"success": False, "provider": provider_name, "error": str(e), "latency_ms": elapsed}

    @unittest.skipUnless(os.environ.get("RUN_LLM_INTEGRATION") == "true", "需设置 RUN_LLM_INTEGRATION=true 才能运行")
    def test_glm_provider(self):
        config = {
            "api_key": self.settings.llm.glm_api_key,
            "model": self.settings.llm.glm_model,
            "base_url": self.settings.llm.glm_base_url,
        }

        if not config["api_key"]:
            self.skipTest("GLM API Key 未配置")

        result = self._test_provider("glm", config)
        self.assertTrue(result["success"], f"GLM Provider 测试失败: {result.get('error')}")

    @unittest.skipUnless(os.environ.get("RUN_LLM_INTEGRATION") == "true", "需设置 RUN_LLM_INTEGRATION=true 才能运行")
    def test_openai_provider(self):
        config = {
            "api_key": getattr(self.settings.llm, 'openai_api_key', None),
            "model": getattr(self.settings.llm, 'openai_model', None),
            "base_url": getattr(self.settings.llm, 'openai_base_url', None),
        }

        if not config["api_key"]:
            self.skipTest("OpenAI API Key 未配置")

        result = self._test_provider("openai", config)
        self.assertTrue(result["success"], f"OpenAI Provider 测试失败: {result.get('error')}")

    @unittest.skipUnless(os.environ.get("RUN_LLM_INTEGRATION") == "true", "需设置 RUN_LLM_INTEGRATION=true 才能运行")
    def test_ollama_provider(self):
        config = {
            "model": self.settings.llm.ollama_model,
            "base_url": self.settings.llm.ollama_base_url,
        }

        result = self._test_provider("ollama", config)
        self.assertTrue(result["success"], f"Ollama Provider 测试失败: {result.get('error')}")

    @unittest.skipUnless(os.environ.get("RUN_LLM_INTEGRATION") == "true", "需设置 RUN_LLM_INTEGRATION=true 才能运行")
    def test_all_providers(self):
        results = []

        if self.settings.llm.glm_api_key:
            config = {
                "api_key": self.settings.llm.glm_api_key,
                "model": self.settings.llm.glm_model,
                "base_url": self.settings.llm.glm_base_url,
            }
            results.append(self._test_provider("glm", config))

        if getattr(self.settings.llm, 'openai_api_key', None):
            config = {
                "api_key": getattr(self.settings.llm, 'openai_api_key', None),
                "model": getattr(self.settings.llm, 'openai_model', None),
                "base_url": getattr(self.settings.llm, 'openai_base_url', None),
            }
            results.append(self._test_provider("openai", config))

        config = {
            "model": self.settings.llm.ollama_model,
            "base_url": self.settings.llm.ollama_base_url,
        }
        results.append(self._test_provider("ollama", config))

        print(f"\n{'='*60}")
        print("测试汇总:")
        print(f"{'='*60}")
        for r in results:
            status = "✓" if r["success"] else "✗"
            print(f"{status} {r['provider']}: {r.get('model')} - {'成功' if r['success'] else r.get('error')}")

        if results:
            success_count = sum(1 for r in results if r["success"])
            print(f"\n成功率: {success_count}/{len(results)}")


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description="LLM 集成测试")
    parser.add_argument("--run-all", action="store_true", help="运行所有 Provider 测试")
    parser.add_argument("--provider", choices=["glm", "openai", "ollama"], help="指定测试单个 Provider")
    args = parser.parse_args()

    if args.run_all or args.provider:
        os.environ["RUN_LLM_INTEGRATION"] = "true"

    suite = unittest.TestSuite()

    if args.provider == "glm":
        suite.addTest(TestLLMIntegration('test_glm_provider'))
    elif args.provider == "openai":
        suite.addTest(TestLLMIntegration('test_openai_provider'))
    elif args.provider == "ollama":
        suite.addTest(TestLLMIntegration('test_ollama_provider'))
    elif args.run_all:
        suite.addTest(TestLLMIntegration('test_all_providers'))
    else:
        suite.addTest(TestLLMIntegration('test_all_providers'))
        os.environ["RUN_LLM_INTEGRATION"] = "true"

    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(suite)