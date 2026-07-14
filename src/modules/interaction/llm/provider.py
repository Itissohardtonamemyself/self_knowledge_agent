from __future__ import annotations

from abc import ABC, abstractmethod
from typing import AsyncIterable, Optional
from functools import lru_cache

from ....core.config import settings
from ....core.logging import log
from ....core.exceptions import LLMProviderError


class BaseLLMProvider(ABC):
    @abstractmethod
    def generate(self, prompt: str, system_prompt: Optional[str] = None,
                 temperature: Optional[float] = None,
                 max_tokens: Optional[int] = None) -> str:
        ...

    async def astream(self, prompt: str, system_prompt: Optional[str] = None,
                      temperature: Optional[float] = None,
                      max_tokens: Optional[int] = None) -> AsyncIterable[str]:
        """默认退化为同步生成，按字符流式输出"""
        text = self.generate(prompt, system_prompt=system_prompt,
                             temperature=temperature, max_tokens=max_tokens)
        for ch in text:
            yield ch


class MockLLMProvider(BaseLLMProvider):
    """Mock 实现：基于检索结果模板化生成回答，无外部依赖"""

    def generate(self, prompt: str, system_prompt: Optional[str] = None,
                 temperature: Optional[float] = None, max_tokens: Optional[int] = None) -> str:
        import re
        import hashlib
        user_q_match = re.search(r"用户问题[：:]\s*(.+?)(?:\n|$)", prompt)
        user_q = user_q_match.group(1).strip() if user_q_match else "你的问题"

        # 提取参考上下文段落
        ctx_matches = re.findall(r"\[(\d+)\]\s*(.+?)(?=\n\s*\[\d+\]|参考上下文结束|$)", prompt, re.S)
        references = []
        for idx, content in ctx_matches:
            snippet = content.strip().replace("\n", " ")[:120]
            if snippet:
                references.append((int(idx), snippet))

        # 基于问题哈希选择回答模板（保证同一问题回答稳定）
        h = int(hashlib.md5(user_q.encode("utf-8")).hexdigest(), 16)
        answers = [
            f"根据知识库中的相关信息，关于「{user_q}」可以从以下几个方面来理解：",
            f"针对你的问题「{user_q}」，我检索到了以下相关内容：",
            f"我已在你的个人知识库中查找了与「{user_q}」相关的资料，整理如下：",
        ]
        head = answers[h % len(answers)]
        body_parts = []
        if references:
            for i, (idx, snip) in enumerate(references[:3], 1):
                body_parts.append(f"{i}. {snip}… [ref:{idx}]")
        else:
            body_parts.append(
                "当前知识库中尚未包含该主题的明确信息。建议：\n"
                "  1. 上传相关文档（PDF/Word/Markdown/网页链接等）\n"
                "  2. 使用不同关键词重新提问\n"
                "  3. 检查已导入文档的处理状态"
            )
            if "[EOF_NO_CONTEXT]" in prompt:
                return f"根据当前知识库未找到相关内容。请尝试上传相关文档或换一种提问方式。\n\n提示：你可以通过「文档导入」功能添加 PDF、Word、Markdown、TXT 或网页链接，系统会自动处理并建立可检索的知识索引。"

        tail = "\n\n以上内容来自你的个人知识库，如需深入了解，可以点击引用卡片查看原始文档。如有其他疑问，请继续追问。"
        return head + "\n\n" + "\n".join(body_parts) + tail


class OpenAIProvider(BaseLLMProvider):
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None,
                 base_url: Optional[str] = None) -> None:
        try:
            from openai import OpenAI
        except ImportError as e:  # pragma: no cover
            raise LLMProviderError(f"请安装 openai: {e}") from e
        self._api_key = api_key or settings.llm.openai_api_key
        if not self._api_key:
            raise LLMProviderError("OpenAI API Key 未配置")
        self._model = model or settings.llm.openai_model
        self._client = OpenAI(api_key=self._api_key, base_url=base_url)

    def generate(self, prompt: str, system_prompt: Optional[str] = None,
                 temperature: Optional[float] = None,
                 max_tokens: Optional[int] = None) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        temp = temperature if temperature is not None else settings.llm.temperature
        mt = max_tokens if max_tokens is not None else settings.llm.max_tokens
        try:
            resp = self._client.chat.completions.create(
                model=self._model, messages=messages, temperature=temp, max_tokens=mt,
            )
            return resp.choices[0].message.content or ""
        except Exception as e:
            raise LLMProviderError(f"OpenAI 调用失败: {e}") from e

    async def astream(self, prompt: str, system_prompt: Optional[str] = None,
                      temperature: Optional[float] = None,
                      max_tokens: Optional[int] = None) -> AsyncIterable[str]:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        temp = temperature if temperature is not None else settings.llm.temperature
        mt = max_tokens if max_tokens is not None else settings.llm.max_tokens
        try:
            stream = self._client.chat.completions.create(
                model=self._model, messages=messages, temperature=temp, max_tokens=mt, stream=True,
            )
            for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            raise LLMProviderError(f"OpenAI stream 失败: {e}") from e


class OllamaProvider(BaseLLMProvider):
    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None) -> None:
        self._base_url = base_url or settings.llm.ollama_base_url
        self._model = model or settings.llm.ollama_model
        try:
            import ollama
            self._client = ollama.Client(host=self._base_url)
        except ImportError:
            # 退化为 HTTP 直连
            self._client = None

    def generate(self, prompt: str, system_prompt: Optional[str] = None,
                 temperature: Optional[float] = None,
                 max_tokens: Optional[int] = None) -> str:
        temp = temperature if temperature is not None else settings.llm.temperature
        import httpx
        payload = {
            "model": self._model,
            "prompt": prompt,
            "system": system_prompt or "",
            "stream": False,
            "options": {"temperature": temp},
        }
        if max_tokens:
            payload["options"]["num_predict"] = max_tokens
        with httpx.Client(timeout=300) as c:
            resp = c.post(f"{self._base_url}/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "")


class GLMProvider(BaseLLMProvider):
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None,
                 base_url: Optional[str] = None) -> None:
        try:
            from zhipuai import ZhipuAI
        except ImportError as e:
            raise LLMProviderError(f"请安装 zhipuai: {e}") from e
        self._api_key = api_key or settings.llm.glm_api_key
        if not self._api_key:
            raise LLMProviderError("GLM API Key 未配置")
        self._model = model or settings.llm.glm_model
        self._client = ZhipuAI(api_key=self._api_key)

    def generate(self, prompt: str, system_prompt: Optional[str] = None,
                 temperature: Optional[float] = None,
                 max_tokens: Optional[int] = None) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        temp = temperature if temperature is not None else settings.llm.temperature
        mt = max_tokens if max_tokens is not None else settings.llm.max_tokens
        try:
            resp = self._client.chat.completions.create(
                model=self._model, messages=messages, temperature=temp, max_tokens=mt,
            )
            return resp.choices[0].message.content or ""
        except Exception as e:
            raise LLMProviderError(f"GLM 调用失败: {e}") from e

    async def astream(self, prompt: str, system_prompt: Optional[str] = None,
                      temperature: Optional[float] = None,
                      max_tokens: Optional[int] = None) -> AsyncIterable[str]:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        temp = temperature if temperature is not None else settings.llm.temperature
        mt = max_tokens if max_tokens is not None else settings.llm.max_tokens
        try:
            stream = self._client.chat.completions.create(
                model=self._model, messages=messages, temperature=temp, max_tokens=mt, stream=True,
            )
            for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            raise LLMProviderError(f"GLM stream 失败: {e}") from e


@lru_cache(maxsize=1)
def get_llm_provider() -> BaseLLMProvider:
    provider = settings.llm.provider.lower()
    log.info(f"初始化 LLM Provider: {provider}")
    try:
        if provider == "openai":
            return OpenAIProvider()
        if provider == "ollama":
            return OllamaProvider()
        if provider == "glm":
            return GLMProvider()
    except Exception as e:
        log.warning(f"LLM Provider {provider} 初始化失败，降级为 Mock: {e}")
    return MockLLMProvider()
