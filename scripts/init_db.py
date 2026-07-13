#!/usr/bin/env python3
"""初始化脚本：创建目录结构 + 初始化数据库 + 验证依赖

使用方式：
  python scripts/init_db.py           # 完整初始化
  python scripts/init_db.py --quick   # 跳过示例数据
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def main() -> int:
    parser = argparse.ArgumentParser(description="Self Knowledge Agent 初始化脚本")
    parser.add_argument("--quick", action="store_true", help="快速模式：跳过示例数据")
    parser.add_argument("--no-seed", action="store_true", help="不插入示例数据")
    args = parser.parse_args()

    print("=" * 60)
    print("  Self Knowledge Agent — 初始化")
    print("=" * 60)

    # 1. 配置与目录
    print("\n[1/5] 加载配置并创建数据目录...")
    from src.core.config import settings
    settings.paths.ensure_all()
    for k, v in {
        "data_dir": settings.paths.data_dir,
        "documents_dir": settings.paths.documents_dir,
        "sqlite_dir": settings.paths.sqlite_dir,
        "vector_store_dir": settings.paths.vector_store_dir,
        "graph_store_dir": settings.paths.graph_store_dir,
        "cache_dir": settings.paths.cache_dir,
        "logs_dir": settings.paths.logs_dir,
    }.items():
        p = Path(v)
        print(f"  · {k:<20} -> {p.resolve()} {'✅' if p.exists() else '❌'}")

    # 2. 数据库初始化（同步版本，兼容脚本环境）
    print("\n[2/5] 初始化 SQLite 数据库...")
    from src.db.session import run_sync_with_db
    try:
        run_sync_with_db(lambda: None)
        sqlite_path = Path(settings.paths.sqlite_dir) / "agent.db"
        print(f"  · 数据库创建: {sqlite_path.resolve()} {'✅' if sqlite_path.exists() else '❌'}")
    except Exception as e:
        print(f"  ⚠️  DB 同步初始化失败: {e}")
        # 退化为异步版本
        import asyncio
        from src.db.session import create_all_tables
        try:
            asyncio.run(create_all_tables())
            print("  · 异步模式初始化 DB 成功 ✅")
        except Exception as e2:
            print(f"  ❌ 初始化失败: {e2}")
            return 2

    # 3. 验证向量库初始化
    print("\n[3/5] 初始化向量数据库 (Chroma)...")
    try:
        from src.db.vector_store import get_vector_store
        get_vector_store.cache_clear()  # type: ignore[attr-defined]
        vs = get_vector_store()
        print(f"  · 集合: {settings.vector_store.default_collection} "
              f"(当前 {vs.count_chunks()} 条)")
        print(f"  · 集合: {settings.vector_store.memory_collection} ✅")
    except Exception as e:
        print(f"  ⚠️  向量库初始化异常（首次使用 sentence-transformers 会下载模型，属正常）: {e}")

    # 4. Embedder 初始化
    print("\n[4/5] 初始化 Embedder...")
    provider = settings.embedder.provider
    print(f"  · Provider: {provider}")
    try:
        from src.modules.processing.embedder import get_embedder
        get_embedder.cache_clear()  # type: ignore[attr-defined]
        emb = get_embedder()
        v = emb.embed_query("ping")
        print(f"  · 维度: {len(v)} ✅")
    except Exception as e:
        print(f"  ⚠️  Embedder 初始化异常（会自动降级为 Mock 模式）: {e}")

    # 5. 示例数据
    if args.quick or args.no_seed:
        print("\n[5/5] 跳过示例数据（--quick / --no-seed）")
    else:
        print("\n[5/5] 插入示例数据...")
        _insert_seed_data()

    print("\n" + "=" * 60)
    print("  🎉 初始化完成！")
    print(f"  启动服务： uvicorn main:app --reload --host 127.0.0.1 --port {settings.server.port}")
    print(f"  访问 API 文档： http://127.0.0.1:{settings.server.port}/docs")
    print("=" * 60)
    return 0


def _insert_seed_data() -> None:
    """插入一份示例 Markdown 文档 + 会话 + 画像，便于直接体验"""
    import asyncio
    import tempfile
    from pathlib import Path
    import shutil

    sample_md = """# 个人知识库 Agent 快速入门

## 产品定位
个人数据知识库 Agent 是你的「数字知识伙伴」。它帮你把散落在各处的文档、笔记、网页，
整合为一个有机的、可智能检索、可主动利用的知识体系。

## 核心价值
1. 从「存起来」变为「用起来」
2. 从「搜索」进化为「对话」
3. 本地优先，保证数据主权

## 典型使用场景
- 研发人员：沉淀技术方案、设计文档、代码 Review 记录
- 产品经理：PRD、竞品分析、用户访谈纪要
- 研究者：论文笔记、实验记录、文献综述
- 学生：课程笔记、错题本、复习大纲

## 六大模块
### 模块一 数据摄入层（数字吸收器）
支持 PDF、Word、Markdown、TXT、网页链接等多源数据接入。

### 模块二 知识处理层（提炼工厂）
将原始内容经过清洗、分块、向量化、实体抽取后建立索引。

### 模块三 记忆与个性化系统（懂你的大脑）
分层记忆：用户画像、长期记忆、短期记忆、经验技巧库。

### 模块四 智能交互层（对话与生成）
RAG 检索增强生成：向量检索 + 关键词检索 + Rerank 精排，引用溯源。

### 模块五 维护与扩展（持续进化）
知识库健康检查、自动备份、版本控制、插件系统。

### 模块六 隐私与安全（数据主权）
本地优先存储、端到端加密、敏感信息脱敏、一键导出与彻底删除。

## RAG 工作流程
用户提问 → 查询理解与改写 → 混合检索 → 结果融合与重排序
→ 构建上下文提示词 → 大模型生成 → 标注引用 → 返回答案

## 非功能指标
- 单次问答端到端响应 ≤ 3 秒
- 支持 10 万级文档检索
- 回答引用准确率 ≥ 90%
- 支持 macOS / Windows / Linux 跨平台桌面端

## 竞品对比
- Notion AI：知识管理 + AI 问答，但缺乏个性化记忆
- Obsidian + 插件：本地优先，但 AI 能力需自行组装
- Dify / Coze：Agent 构建平台，偏通用而非个人化
- Mintlify：以 AI 为中心的文档系统

## 版本迭代
- MVP：数据导入 + 基础 RAG 问答 + 引用溯源
- V1.0：多格式支持 + 多轮对话 + 用户画像 + 混合检索 + 记忆
- V1.5：知识图谱可视化 + 健康检查 + 自动备份
- V2.0：Wiki 自动生成 + 主动推荐 + 插件系统 + 跨应用集成

## 常见问题
Q: 我的数据会上传云端吗？
A: 默认完全本地存储。可选开启云端同步，且采用端到端加密。

Q: 必须购买大模型 API 吗？
A: 不是必需。默认使用 Mock 模式快速体验，后续可接入 OpenAI、
Claude 或本地部署的 Qwen / Llama 等开源模型。

Q: 支持哪些文件类型？
A: MVP 已支持 PDF / DOCX / Markdown / TXT / HTML / 网页链接。
V1.0 起将补充 OCR、飞书、Notion 等 API 数据源。
"""
    try:
        asyncio.run(_async_seed(sample_md))
        print("  ✅ 示例文档已插入（产品快速入门.md）")
    except Exception as e:
        print(f"  ⚠️  示例数据插入失败（不影响使用）: {e}")


async def _async_seed(md_content: str) -> None:
    import tempfile
    from pathlib import Path
    import shutil
    import uuid

    # 先写一个临时 md，再走 IngestionService 流程
    with tempfile.TemporaryDirectory() as td:
        temp_md = Path(td) / "产品快速入门.md"
        temp_md.write_text(md_content, encoding="utf-8")

        from src.db.session import get_session_factory
        from src.modules.ingestion.service import IngestionService
        from src.modules.memory.service import MemoryService
        from src.schemas.memory import UserProfileUpdate

        factory = get_session_factory()
        async with factory() as db:
            svc = IngestionService()
            res = await svc.ingest_uploaded_file(
                db, str(temp_md), "产品快速入门.md",
                tags=["示例", "产品文档", "快速入门"],
                doc_id=uuid.uuid4().hex[:16],
            )
            # 更新一个示例用户画像
            mem_svc = MemoryService()
            await mem_svc.update_profile(db, UserProfileUpdate(
                occupation="知识工作者",
                domains=["人工智能", "产品设计", "知识管理"],
                preferences={"回答风格": "专业简洁", "语言": "中文"},
                auto_update=True,
            ))
            await db.commit()


if __name__ == "__main__":
    sys.exit(main())
