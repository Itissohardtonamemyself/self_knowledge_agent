# 个人数据知识库 Agent — 技术架构设计文档

> **文档版本**：V1.0  
> **编制日期**：2026-07-08  
> **基于文档**：《个人知识库Agent产品设计文档》

---

## 目录

- [1. 项目概述](#1-项目概述)
- [2. 整体技术架构](#2-整体技术架构)
  - [2.1 架构总览图](#21-架构总览图)
  - [2.2 分层说明](#22-分层说明)
- [3. 技术栈选型](#3-技术栈选型)
  - [3.1 核心框架与运行时](#31-核心框架与运行时)
  - [3.2 存储层选型](#32-存储层选型)
  - [3.3 AI/ML 组件选型](#33-aiml-组件选型)
  - [3.4 文档解析与预处理](#34-文档解析与预处理)
  - [3.5 前端与桌面端](#35-前端与桌面端)
- [4. 目录结构设计](#4-目录结构设计)
- [5. 六大核心模块详细设计](#5-六大核心模块详细设计)
  - [5.1 模块一：数据摄入层（数字吸收器）](#51-模块一数据摄入层数字吸收器)
  - [5.2 模块二：知识处理层（提炼工厂）](#52-模块二知识处理层提炼工厂)
  - [5.3 模块三：记忆与个性化系统（懂你的大脑）](#53-模块三记忆与个性化系统懂你的大脑)
  - [5.4 模块四：智能交互层（对话与生成）](#54-模块四智能交互层对话与生成)
  - [5.5 模块五：维护与扩展（持续进化）](#55-模块五维护与扩展持续进化)
  - [5.6 模块六：隐私与安全（数据主权）](#56-模块六隐私与安全数据主权)
- [6. Agent 核心工作流程（RAG Pipeline）](#6-agent-核心工作流程rag-pipeline)
- [7. 数据库设计概要](#7-数据库设计概要)
  - [7.1 SQLite 关系表设计](#71-sqlite-关系表设计)
  - [7.2 向量数据库集合设计](#72-向量数据库集合设计)
  - [7.3 图数据库节点/关系设计](#73-图数据库节点关系设计)
- [8. API 设计概要](#8-api-设计概要)
- [9. 部署架构](#9-部署架构)
  - [9.1 本地单机部署（V1.0 默认）](#91-本地单机部署v10-默认)
  - [9.2 可选云端同步架构](#92-可选云端同步架构)
- [10. 关键技术挑战与应对](#10-关键技术挑战与应对)
- [11. 版本迭代技术路线](#11-版本迭代技术路线)
- [12. 快速开始](#12-快速开始)

---

## 1. 项目概述

**个人数据知识库 Agent** 是一款面向知识工作者的个人知识管理智能体。产品定位为用户的"数字知识伙伴"，核心价值主张是：

> **让知识从"存起来"变为"用起来"，从"搜索"进化为"对话"。**

本技术架构文档基于产品 PRD 进行落地设计，遵循以下原则：

| 设计原则 | 具体要求 |
|---------|---------|
| **本地优先** | 核心数据处理与存储在用户本地设备完成，保障数据主权 |
| **模块化** | 六大功能模块松耦合，可独立迭代和替换 |
| **可插拔** | 大模型、向量库、Embedding 模型等核心组件支持热切换 |
| **高性能** | 单次问答响应时间 ≤ 3 秒，支持 10 万级文档检索 |
| **跨平台** | 原生支持 Windows / macOS / Linux 桌面端 |

---

## 2. 整体技术架构

### 2.1 架构总览图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        交互层 (Presentation)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │  桌面端 UI    │  │  Web 管理面板 │  │    插件/扩展 API Gateway │   │
│  │  (Electron)  │  │  (Vue3 + Vite)│  │   (REST / WebSocket)    │   │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘   │
└─────────┼─────────────────┼────────────────────────┼─────────────────┘
          │                 │                        │
          ▼                 ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        推理层 (Reasoning)                            │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              Agent Orchestrator (LangChain / LlamaIndex)      │    │
│  ├──────────────┬──────────────┬──────────────┬─────────────────┤    │
│  │ LLM Provider │ RAG Retriever │ Prompt 编排 │ Tool / 技能调度  │    │
│  │ (多模型适配) │ (混合检索引擎) │ (模板管理)  │ (函数调用)       │    │
│  └──────┬───────┘──────┬───────┘──────┬───────┘────────┬────────┘    │
└─────────┼──────────────┼──────────────┼────────────────┼─────────────┘
          │              │              │                │
          ▼              ▼              ▼                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        记忆层 (Memory)                               │
│  ┌────────────┐  ┌──────────────┐  ┌────────────┐  ┌────────────┐   │
│  │ 用户画像    │  │ 长期记忆库    │  │ 短期会话    │  │ 经验技巧库  │   │
│  │ (静态偏好) │  │ (跨会话知识) │  │ (上下文)    │  │(最佳实践)  │   │
│  └─────┬──────┘  └──────┬───────┘  └──────┬─────┘  └─────┬──────┘   │
└────────┼────────────────┼─────────────────┼───────────────┼───────────┘
         │                │                 │               │
         ▼                ▼                 ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        处理层 (Processing)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │ 文档解析引擎  │  │ Embedding    │  │ 知识抽取引擎  │                │
│  │ (多格式解析) │  │ (向量化模块) │  │ (NER+关系+主题)│                │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                │
└─────────┼─────────────────┼─────────────────┼────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        数据层 (Storage)                              │
│  ┌────────────────────┐  ┌──────────────┐  ┌───────────────────┐    │
│  │ 本地文件系统        │  │ 向量数据库    │  │ 图数据库           │    │
│  │ (原始文档/配置文件) │  │ (Chroma)     │  │ (NetworkX Lite)    │    │
│  └────────┬───────────┘  └──────┬───────┘  └─────────┬─────────┘    │
│           │                     │                      │              │
│           ▼                     ▼                      ▼              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              SQLite (元数据/用户画像/会话/配置)              │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 分层说明

| 层级 | 职责 | 关键技术 |
|-----|-----|---------|
| **交互层** | 用户界面、请求接入、插件扩展 | Electron、Vue3、FastAPI、WebSocket |
| **推理层** | LLM 调度、RAG 编排、Prompt 管理、工具调用 | LangChain、LlamaIndex、Function Calling |
| **记忆层** | 用户画像、长期/短期记忆、知识图谱、经验沉淀 | SQLite、NetworkX、Chroma |
| **处理层** | 文档解析、向量化、知识抽取与结构化 | Unstructured、PyMuPDF、BGE、spaCy |
| **数据层** | 原始文件存储、向量索引、图关系存储、元数据 | 本地FS、Chroma、NetworkX、SQLite |

---

## 3. 技术栈选型

### 3.1 核心框架与运行时

| 类别 | 推荐方案 | 备选方案 | 选型理由 |
|-----|---------|---------|---------|
| **后端语言** | Python 3.11+ | Python 3.10+ | 生态成熟，AI/ML 库支持最好 |
| **Web 框架** | FastAPI | Flask / Starlette | 异步性能好、自动文档、类型安全 |
| **ASGI 服务器** | Uvicorn | Hypercorn | 性能稳定，与 FastAPI 配合最佳 |
| **Agent 编排** | LangChain + LlamaIndex 组合 | AutoGen / CrewAI | LangChain 擅长工具链，LlamaIndex 擅长 RAG |
| **异步任务队列** | APScheduler (本地) | Celery + Redis | V1.0 单机部署优先，APScheduler 零依赖 |
| **桌面端框架** | Electron + FastAPI | Tauri | Electron 生态成熟，Python 后端通过子进程/HTTP 通信 |
| **前端框架** | Vue 3 + Vite + Pinia | React + Vite | Vue 上手快，适合中小型项目 |
| **UI 组件库** | Element Plus | Ant Design Vue | 组件丰富、文档齐全、中文友好 |

### 3.2 存储层选型

| 类别 | 推荐方案 | 备选方案 | 选型理由 |
|-----|---------|---------|---------|
| **关系数据库** | SQLite 3.40+ | PostgreSQL | 本地单机优先，SQLite 零运维、单文件便携 |
| **向量数据库** | Chroma DB 0.5+ | Milvus Lite / Qdrant | Chroma 纯 Python、轻量化、本地部署零配置 |
| **图数据库** | NetworkX（内存图）+ 持久化 JSON | Neo4j Community | V1.0 用 NetworkX 即可，无需独立图数据库服务 |
| **缓存层** | diskcache（本地磁盘缓存） | Redis | 单机场景 diskcache 更轻量，无需额外服务 |
| **文件存储** | 本地文件系统 | 对象存储（S3 兼容） | 本地优先原则，原始文档落地到用户本地 |

### 3.3 AI/ML 组件选型

| 类别 | 推荐方案 | 备选方案 | 选型理由 |
|-----|---------|---------|---------|
| **云端 LLM** | GPT-4o Mini / Claude 3.5 Sonnet | DeepSeek V3 / Qwen Plus | 兼顾效果与成本，优先支持中文 |
| **本地 LLM** | Qwen2.5-7B-Instruct（ollama） | Llama 3 8B | 中文支持好、社区活跃、7B 模型消费级 GPU 可跑 |
| **Embedding 模型** | BGE-M3（本地）/ text-embedding-3-small（云端） | m3e-large / GTE | BGE-M3 中文语义检索 SOTA，支持多粒度 |
| **Rerank 模型** | BGE-Reranker-v2-m3 | Cohere Rerank 3 | 与 BGE Embedding 配套，效果稳定 |
| **实体识别 (NER)** | spaCy + zh_core_web_trf 模型 | LLM NER Prompt | 离线可用，性能可控 |
| **OCR** | PaddleOCR | Tesseract | 中文识别率高，百度开源 |

### 3.4 文档解析与预处理

| 格式 | 解析库 | 说明 |
|-----|-------|-----|
| **PDF** | PyMuPDF (fitz) + Unstructured | PyMuPDF 提取文本速度快，Unstructured 处理复杂布局 |
| **DOCX** | python-docx | 已在项目依赖中 |
| **Markdown / TXT** | 标准库 + 正则 | 轻量处理 |
| **HTML / 网页** | BeautifulSoup4 + Trafilatura | Trafilatura 擅长提取正文、去噪 |
| **图片（OCR）** | PaddleOCR + Pillow | 支持扫描件 PDF 和图片 |
| **语义分块** | LangChain RecursiveCharacterTextSplitter | 支持自定义分隔符和chunk重叠 |

### 3.5 前端与桌面端

| 类别 | 技术选型 |
|-----|---------|
| **桌面壳** | Electron 30+（Chromium 内核） |
| **前端构建** | Vite 5+ |
| **状态管理** | Pinia |
| **对话 UI** | 自定义组件（支持 Markdown 渲染 + 引用跳转） |
| **图表可视化** | ECharts（KPI 仪表盘） + Cytoscape.js（知识图谱） |
| **Markdown 渲染** | marked + highlight.js（代码高亮） |
| **HTTP 客户端** | axios（支持流式 SSE） |

---

## 4. 目录结构设计

```
self_knowledge_agent/
├── README.md                          # 本文档
├── requirements.txt                   # Python 依赖
├── pyproject.toml                     # 项目配置（构建、格式化、lint）
├── config/                            # 配置文件目录
│   ├── config.yaml                    # 主配置文件（LLM/向量库/路径等）
│   ├── config.example.yaml            # 示例配置
│   └── prompts/                       # Prompt 模板目录
│       ├── rag_answer.yaml            # RAG 回答模板
│       ├── query_rewrite.yaml         # 查询改写模板
│       ├── entity_extraction.yaml     # 实体抽取模板
│       └── knowledge_summary.yaml     # 知识摘要模板
├── data/                              # 用户数据（默认本地存储路径，gitignore）
│   ├── documents/                     # 原始文档入库
│   ├── vector_store/                  # Chroma 持久化数据
│   ├── graph_store/                   # 图数据 JSON 备份
│   ├── cache/                         # diskcache 缓存
│   └── sqlite/                        # SQLite 数据库文件
├── logs/                              # 日志目录
├── src/                               # Python 后端核心源码
│   ├── __init__.py
│   ├── main.py                        # FastAPI 应用入口
│   ├── core/                          # 核心基础模块
│   │   ├── __init__.py
│   │   ├── config.py                  # 配置加载与管理（Pydantic Settings）
│   │   ├── exceptions.py              # 全局异常定义
│   │   ├── logging.py                 # 日志配置
│   │   ├── dependencies.py            # FastAPI 依赖注入
│   │   └── security.py                # 加密/解密、哈希、脱敏
│   ├── db/                            # 数据访问层
│   │   ├── __init__.py
│   │   ├── session.py                 # SQLite/SQLAlchemy 会话管理
│   │   ├── vector_store.py            # Chroma 封装（增删改查+检索）
│   │   ├── graph_store.py             # NetworkX 图存储封装
│   │   ├── cache.py                   # diskcache 封装
│   │   └── models/                    # SQLAlchemy ORM 模型
│   │       ├── __init__.py
│   │       ├── document.py            # 文档表
│   │       ├── chunk.py               # 知识块表
│   │       ├── conversation.py        # 会话与消息表
│   │       ├── user_profile.py        # 用户画像表
│   │       ├── memory.py              # 长期记忆表
│   │       ├── tag.py                 # 标签与关联表
│   │       └── entity.py              # 实体与关系表
│   ├── modules/                       # 六大功能模块
│   │   ├── __init__.py
│   │   ├── ingestion/                 # 模块一：数据摄入层
│   │   │   ├── __init__.py
│   │   │   ├── router.py              # API 路由
│   │   │   ├── service.py             # 业务逻辑
│   │   │   ├── loaders/               # 各种格式加载器
│   │   │   │   ├── __init__.py
│   │   │   │   ├── pdf_loader.py
│   │   │   │   ├── docx_loader.py
│   │   │   │   ├── markdown_loader.py
│   │   │   │   ├── web_loader.py
│   │   │   │   └── ocr_loader.py
│   │   │   └── preprocessor.py        # 预处理：清洗、分块、元数据标注
│   │   ├── processing/                # 模块二：知识处理层
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── embedder.py            # Embedding 封装（本地+云端可切换）
│   │   │   ├── indexer.py             # 索引构建与更新
│   │   │   ├── extractor.py           # 实体/关系/主题抽取
│   │   │   └── cluster.py             # 主题聚类
│   │   ├── memory/                    # 模块三：记忆与个性化
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── profile_manager.py     # 用户画像管理
│   │   │   ├── memory_manager.py      # 长/短期记忆管理（含遗忘机制）
│   │   │   ├── graph_builder.py       # 知识图谱构建与持久化
│   │   │   └── experience_lib.py      # 经验技巧库
│   │   ├── interaction/               # 模块四：智能交互层
│   │   │   ├── __init__.py
│   │   │   ├── router.py              # REST + WebSocket 路由
│   │   │   ├── service.py
│   │   │   ├── agent.py               # Agent 核心编排（LangChain）
│   │   │   ├── llm/                   # LLM Provider 适配层
│   │   │   │   ├── __init__.py
│   │   │   │   ├── base.py            # 抽象基类
│   │   │   │   ├── openai_provider.py
│   │   │   │   ├── anthropic_provider.py
│   │   │   │   └── ollama_provider.py # 本地模型
│   │   │   ├── retrieval/             # 检索引擎
│   │   │   │   ├── __init__.py
│   │   │   │   ├── base.py
│   │   │   │   ├── vector_retriever.py   # 语义检索
│   │   │   │   ├── keyword_retriever.py  # 关键词检索（BM25）
│   │   │   │   ├── hybrid_retriever.py   # 混合检索 + Rerank
│   │   │   │   └── graph_retriever.py    # 图谱检索
│   │   │   └── generators/          # 主动生成模块
│   │   │       ├── __init__.py
│   │   │       ├── summarizer.py     # 自动摘要
│   │   │       ├── wiki_generator.py # Wiki 生成
│   │   │       └── recommender.py    # 知识推送
│   │   ├── maintenance/               # 模块五：维护与扩展
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── health_check.py        # 知识库健康检查
│   │   │   ├── version_control.py     # 版本与回滚
│   │   │   ├── backup.py              # 自动备份与恢复
│   │   │   └── plugins/               # 插件系统
│   │   │       ├── __init__.py
│   │   │       ├── manager.py
│   │   │       └── builtin/           # 内置技能/插件
│   │   └── privacy/                   # 模块六：隐私与安全
│   │       ├── __init__.py
│   │       ├── router.py
│   │       ├── service.py
│   │       ├── crypto.py              # 本地加密（AES-256-GCM）
│   │       ├── data_manager.py        # 导出/删除/隔离
│   │       └── audit.py               # 操作审计日志
│   ├── schemas/                       # Pydantic 请求/响应模型
│   │   ├── __init__.py
│   │   ├── document.py
│   │   ├── conversation.py
│   │   ├── memory.py
│   │   └── common.py                  # 通用响应包装
│   └── utils/                         # 工具函数
│       ├── __init__.py
│       ├── file_utils.py
│       ├── text_utils.py
│       └── datetime_utils.py
├── frontend/                          # Electron + Vue3 前端代码
│   ├── package.json
│   ├── vite.config.ts
│   ├── electron/                      # Electron 主进程
│   │   └── main.ts
│   └── src/                           # Vue 渲染进程
│       ├── App.vue
│       ├── main.ts
│       ├── components/                # 对话区、知识库侧栏等
│       ├── views/
│       ├── stores/                    # Pinia stores
│       └── api/                       # 后端 API 封装
├── scripts/                           # 运维脚本
│   ├── init_db.py                     # 数据库初始化
│   ├── backup.py                      # 备份脚本
│   └── restore.py                     # 恢复脚本
└── tests/                             # 测试代码
    ├── __init__.py
    ├── unit/
    ├── integration/
    └── conftest.py
```

---

## 5. 六大核心模块详细设计

### 5.1 模块一：数据摄入层（数字吸收器）

**职责**：多源数据接入 → 格式清洗 → 语义分块 → 元数据标注

#### 5.1.1 多源数据接入（Loader 模式）

采用**策略模式 + 工厂模式**，每种数据源对应一个 Loader，统一继承 `BaseDocumentLoader` 抽象基类。

```python
# src/modules/ingestion/loaders/base.py
from abc import ABC, abstractmethod
from typing import List
from src.schemas.document import RawDocument

class BaseDocumentLoader(ABC):
    """文档加载器抽象基类"""
    supported_extensions: List[str] = []

    @abstractmethod
    def load(self, source: str, **kwargs) -> RawDocument:
        """加载并提取纯文本内容"""
        ...

    @classmethod
    def supports(cls, filename: str) -> bool:
        return any(filename.lower().endswith(ext) for ext in cls.supported_extensions)
```

| Loader 子类 | 支持格式 | 优先级 |
|------------|---------|-------|
| PDFLoader | `.pdf` | P0 |
| DocxLoader | `.docx` | P0 |
| MarkdownLoader | `.md`, `.markdown` | P0 |
| TextLoader | `.txt`, `.log` | P0 |
| OCRLoader | `.jpg`, `.png`, `.tiff`, 扫描件 PDF | P1 |
| WebLoader | URL / HTML | P0 |
| BatchFolderLoader | 整个文件夹批量导入 | P1 |
| NotionAPILoader / LarkLoader | 第三方 API 同步 | P2 |

**批量导入流程**：
```
用户选择文件夹
    ↓
递归遍历所有文件，按扩展名路由到对应 Loader
    ↓
多线程并行处理（ThreadPoolExecutor，max_workers=CPU*2）
    ↓
进度条实时上报（WebSocket 推送）
    ↓
失败文件记录到 import_error.log，支持断点续传
```

#### 5.1.2 智能预处理 Pipeline

```
原始文本 → 清洗 → 标准化 → 语义分块 → 元数据标注 → Chunk 列表
           ↓        ↓         ↓           ↓
        去HTML   全半角转  RecursiveChunker  自动抽标签
        去重复   统一换行  (chunk_size=512,  来源/日期/作者
        去噪声   空白压缩  overlap=64)       文件大小/类型
```

**Chunk ID 生成规则**：
```
doc_id:  = sha256(source_path + size + mtime)[:16]
chunk_id = f"{doc_id}:{page_num}:{chunk_idx}"
```

### 5.2 模块二：知识处理层（提炼工厂）

**职责**：向量化 → 索引构建 → 实体/关系抽取 → 主题聚类

#### 5.2.1 Embedding 适配层

支持**本地模型**与**云端 API** 无缝切换，通过策略模式隔离：

```python
# src/modules/processing/embedder.py
class BaseEmbedder(ABC):
    @abstractmethod
    def embed_documents(self, texts: List[str]) -> List[List[float]]: ...
    @abstractmethod
    def embed_query(self, text: str) -> List[float]: ...
    @property
    @abstractmethod
    def dimension(self) -> int: ...

class BGEEmbedder(BaseEmbedder):
    """本地 BGE-M3，基于 sentence-transformers"""
    def __init__(self, model_name="BAAI/bge-m3", device="auto"): ...

class OpenAIEmbedder(BaseEmbedder):
    """云端 text-embedding-3-small"""
    def __init__(self, api_key: str, model="text-embedding-3-small"): ...
```

| 模式 | 模型 | 维度 | 适用场景 |
|-----|-----|-----|---------|
| 本地离线 | BGE-M3 | 1024 | 无网络、隐私敏感 |
| 云端平衡 | text-embedding-3-small | 1536 | 平衡效果与成本 |
| 云端高质量 | text-embedding-3-large | 3072 | 高质量检索需求 |

#### 5.2.2 知识抽取流水线

```
知识块文本
    ↓
┌─ spaCy NER ───────────────────────┐
│  → 实体：人名 / 术语 / 日期 / 组织 │
│  → 实体类型 + 置信度 + 位置偏移    │
└──────────────┬────────────────────┘
               ↓
┌─ LLM 关系抽取 Prompt ─────────────┐
│  → (实体A, 关系, 实体B) 三元组     │
└──────────────┬────────────────────┘
               ↓
┌─ 主题聚类 (HDBSCAN + 向量降维) ──┐
│  → UMAP 降维 → HDBSCAN 聚类       │
│  → LLM 生成每个簇的主题标签        │
└───────────────────────────────────┘
```

### 5.3 模块三：记忆与个性化系统（懂你的大脑）

#### 5.3.1 分层记忆模型

```
┌──────────────────────────────────────────────┐
│              用户画像（User Profile）          │  静态背景信息
│  职业 / 领域 / 偏好 / 语言 / 习惯模式          │  更新频率：低
├──────────────────────────────────────────────┤
│         长期记忆（Long-term Memory）          │  跨会话持久化
│  重要知识点 / 用户明确标注 / 历史经验总结      │  更新频率：中
├──────────────────────────────────────────────┤
│         短期记忆（Short-term Memory）         │  当前会话上下文
│  最近 N 轮对话 / 当前查询上下文                │  更新频率：高
├──────────────────────────────────────────────┤
│         经验技巧库（Experience Library）       │  最佳实践沉淀
│  成功解决过的问题 → 方案对，可复用检索         │  更新频率：中
└──────────────────────────────────────────────┘
```

#### 5.3.2 记忆主动管理机制

| 机制 | 实现方式 |
|-----|---------|
| **自动更新画像** | 分析用户历史提问、文档主题分布，每 N 次交互后触发更新 Prompt |
| **记忆遗忘** | 长期记忆按 `last_accessed_at` + `importance_score` 计算活跃度；低于阈值自动降级（不删除，仅降低检索权重） |
| **记忆压缩** | 短期记忆超过窗口（默认 20 轮）时，用 LLM 自动总结为"上下文摘要"注入长期记忆 |
| **可视化编辑** | 前端提供记忆管理器页面，用户可增删改查所有记忆条目 |

### 5.4 模块四：智能交互层（对话与生成）

#### 5.4.1 Agent 核心编排（LangChain 实现）

```python
# 核心 Agent Chain 结构
Agent = {
    input: 用户问题 + 会话历史
      ↓
    [Step 1] 查询改写链 (QueryRewriteChain)
      → LLM 改写 + 扩展成 3-5 个子查询
      ↓
    [Step 2] 混合检索器 (HybridRetriever)
      → 向量检索 top_k=20 + 关键词检索 top_k=20
      → Reciprocal Rank Fusion (RRF) 融合
      → BGE-Reranker 重排序 → top_k=6
      ↓
    [Step 3] 上下文构建
      → 用户画像注入 + 短期记忆 + 检索结果
      → 构造 Prompt（含引用 ID 映射）
      ↓
    [Step 4] LLM 生成回答（流式）
      → 开启 function calling（可调用插件）
      → 回答中嵌入 [ref:N] 引用标记
      ↓
    [Step 5] 引用溯源 + 后处理
      → 将 [ref:N] 转为可点击的引用卡片
      → 拒答检测：若检索相关性全 < threshold 则触发拒答模板
    output: 流式回答 + 引用列表 + 建议追问
}
```

#### 5.4.2 混合检索引擎设计

| 检索方式 | 算法 | 权重 | 适用场景 |
|---------|-----|-----|---------|
| 语义检索 | Chroma HNSW 余弦相似度 | 0.6 | 语义相关、模糊查询 |
| 关键词检索 | SQLite FTS5 BM25 | 0.4 | 精确术语、专有名词 |
| **融合策略** | Reciprocal Rank Fusion (RRF) | — | 合并两者排序结果 |
| **重排序** | BGE-Reranker-v2-m3 | — | 语义精细化排序，截断 top_k=6 |

**RRF 公式**：
```
score(d) = Σ 1 / (k + rank_i(d))   // k=60 默认值
```

### 5.5 模块五：维护与扩展（持续进化）

#### 5.5.1 知识库健康管理

| 检查项 | 检测方法 | 修复建议 |
|-------|---------|---------|
| 过时内容 | 文档创建时间 > 2 年且主题涉及时效性领域 | 标记黄色预警，提示用户确认 |
| 矛盾内容 | 两篇文档 Embedding 余弦相似度 > 0.95 但核心观点相反（LLM 对比） | 标记红色冲突，弹窗要求用户确认 |
| 低质量 Chunk | Chunk 长度 < 50 字符 OR 重复率 > 80% | 建议合并或删除 |
| 孤立节点 | 知识图谱中 degree=0 的实体节点 | 建议补充关联或删除 |
| 索引一致性 | SQLite 元数据条目数 ≠ Chroma doc count | 触发增量重建索引 |

#### 5.5.2 插件系统设计（V1.5 引入）

采用 **钩子（Hook）机制** + **配置驱动**：

```yaml
# 插件 manifest 示例（plugins/note_creator/manifest.yaml）
id: "note_creator"
name: "笔记创建器"
version: "1.0.0"
description: "创建结构化 Markdown 笔记并入库"
hooks:
  - on_tool_call: "create_note"
    entry: "plugin_main.py:create_note"
permissions:
  - "document:write"
  - "filesystem:write"
```

### 5.6 模块六：隐私与安全（数据主权）

#### 5.6.1 本地加密存储方案

```
用户设置主密码（首次启动）
    ↓
Argon2id 派生 256-bit DEK (派生密钥)  →  仅内存持有，不落地
    ↓
┌─ 需要加密的字段：─────────────────────────┐
│  user_profile.*                           │
│  conversations.messages.content           │
│  long_term_memories.*                     │
│  plugins.private_config                   │
└───────────────────────────────────────────┘
    ↓
AES-256-GCM 加密存储（每次加密随机生成 12-byte IV，拼接密文+tag）
```

#### 5.6.2 LLM 调用隐私保护

| 防护措施 | 实现方式 |
|---------|---------|
| **最小化发送** | 只发送 RAG 检索命中的 Top-6 Chunk，不发送完整知识库 |
| **敏感信息脱敏** | 发送前用正则 + NER 检测手机号/身份证/邮箱/地址等，替换为 `[MASKED]` |
| **本地优先模式** | 用户可配置「仅本地模型」，完全断网运行 |
| **审计日志** | 每次 LLM API 调用记录：token 数、发送片段 hash、耗时、模型名（不记录原文） |
| **可擦除承诺** | 提供一键「清空所有发送历史 + 重新生成对话」功能 |

---

## 6. Agent 核心工作流程（RAG Pipeline）

```
用户输入问题
    │
    ▼
┌─────────────────────────────────────────────────┐
│ 1. 预处理阶段                                    │
│    ├─ 查询理解：分类（闲聊/知识/指令/工具调用）   │
│    └─ 查询改写：扩展成多个子查询，做同义词替换     │
└──────────────────────┬──────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────┐
│ 2. 检索阶段（并行）                               │
│    ├─ 向量检索：Chroma 语义相似度 top-20          │
│    ├─ 关键词检索：SQLite FTS5 BM25 top-20        │
│    ├─ 图谱检索：从用户画像关联实体扩展 3 跳邻居    │
│    └─ 记忆检索：长期记忆 top-3 + 短期记忆窗口      │
└──────────────────────┬──────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────┐
│ 3. 融合与排序阶段                                 │
│    ├─ RRF 融合多检索结果 → 去重 → 候选池 (N≤30)   │
│    └─ BGE-Reranker 精排 → 最终上下文 (N=6)       │
└──────────────────────┬──────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────┐
│ 4. 生成阶段                                       │
│    ├─ 注入 Prompt 模板：[System] + [Profile]     │
│    │                 + [Memory] + [Context Chunks]│
│    │                 + [History] + [Query]        │
│    ├─ Function Calling 检测 → 若需工具则先执行    │
│    └─ 流式输出 SSE：逐 token 推送到前端            │
└──────────────────────┬──────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────┐
│ 5. 后处理阶段                                     │
│    ├─ 引用解析：[ref:N] → 绑定到实际文档+位置      │
│    ├─ 拒答检测：所有 chunk score < 0.3 → 拒答      │
│    ├─ 建议追问：LLM 生成 3 个 follow-up 问题      │
│    └─ 记忆写入：判断是否要沉淀到长期记忆           │
└──────────────────────┬──────────────────────────┘
                       ▼
              前端渲染（Markdown + 引用卡片 + 追问）
```

**性能指标目标（V1.0）**：

| 阶段 | 目标耗时 | 占比 |
|-----|---------|-----|
| 查询改写 | ≤ 200ms | ~7% |
| 混合检索 | ≤ 400ms | ~13% |
| Rerank 排序 | ≤ 200ms | ~7% |
| LLM 首 token | ≤ 1500ms | ~50% |
| LLM 生成中 | 取决于长度 | ~23% |
| **端到端总计** | **≤ 3000ms** | 100% |

---

## 7. 数据库设计概要

### 7.1 SQLite 关系表设计

**核心 ER 关系**：
```
documents (1) ──→ (N) chunks
    │                    │
    │                    ├─→ chunk_tags (N) ←─ tags
    │                    └─→ chunk_entities (N) ←─ entities
    │
    ├─→ conversations (N) ←─ messages (N)
    │
    ├─→ user_profile (1:1)
    ├─→ long_term_memories (N)
    └─→ import_jobs (N)
```

**主要表字段**（简略）：

#### documents 文档表
| 字段 | 类型 | 说明 |
|-----|-----|-----|
| id | TEXT PK | sha256(source+size+mtime)[:16] |
| source_path | TEXT | 原始文件路径 |
| title | TEXT | 文档标题（自动提取/可编辑） |
| file_type | TEXT | pdf/docx/md/txt/web/... |
| file_size | INTEGER | 字节数 |
| chunk_count | INTEGER | 切块数量 |
| created_at | DATETIME | 入库时间 |
| updated_at | DATETIME | 更新时间 |
| status | TEXT | processing/completed/failed |
| tags_json | TEXT | 标签 JSON 数组（冗余便于快速查询） |
| summary | TEXT | 自动生成摘要（V1.5） |

#### chunks 知识块表
| 字段 | 类型 | 说明 |
|-----|-----|-----|
| id | TEXT PK | `{doc_id}:{page}:{idx}` |
| doc_id | TEXT FK | 所属文档 |
| content | TEXT | 块原文（用于关键词检索/引用展示） |
| page_num | INTEGER | 原文档页码/位置 |
| char_start | INTEGER | 原文起始偏移 |
| char_end | INTEGER | 原文结束偏移 |
| token_count | INTEGER | token 估算 |
| created_at | DATETIME | — |

#### conversations / messages 会话与消息表
| 表 | 关键字段 |
|----|---------|
| conversations | id, title, created_at, last_msg_at, msg_count |
| messages | id, conv_id, role(user/assistant/system), content, refs_json, tokens_used, created_at |

#### user_profile 用户画像表
| 字段 | 类型 | 说明 |
|-----|-----|-----|
| id | INTEGER PK | 固定为 1（单用户） |
| occupation | TEXT | 职业 |
| domains_json | TEXT | 关注领域 ["AI", "产品", ...] |
| preferences_json | TEXT | 偏好：回答风格/语言/详细程度 |
| auto_update | BOOLEAN | 是否允许自动更新画像 |
| updated_at | DATETIME | — |

#### long_term_memories 长期记忆表
| 字段 | 类型 | 说明 |
|-----|-----|-----|
| id | INTEGER PK | — |
| content | TEXT | 记忆内容（加密存储） |
| source_type | TEXT | user_explicit/auto_summary/experience |
| importance_score | REAL | 0-1 重要性评分 |
| access_count | INTEGER | 命中次数 |
| last_accessed_at | DATETIME | 最近命中 |
| embedding | BLOB | 向量化表示（用于检索） |
| status | TEXT | active/archived/expired |

### 7.2 向量数据库集合设计（Chroma）

| Collection 名 | 用途 | 元数据 |
|--------------|-----|-------|
| `chunks_v1` | 知识块向量 | doc_id, chunk_id, file_type, tags[], page_num, created_at |
| `memories_v1` | 长期记忆向量 | memory_id, source_type, importance_score |
| `profiles_v1` | 用户画像语义描述 | version, updated_at |

> 索引类型：Chroma 默认 HNSW；度量：余弦相似度 `cosine`。

### 7.3 图数据库节点/关系设计（NetworkX）

```
节点类型（Node Labels）：
  ├─ Document      属性: {id, title, file_type}
  ├─ Topic         属性: {name, description}
  ├─ Entity        属性: {name, type(person/org/term/...), confidence}
  └─ UserTag       属性: {name, color}

关系类型（Edge Types）：
  ├─ CONTAINS_CHUNK    Document ─→ Chunk
  ├─ BELONGS_TO_TOPIC  Chunk ─→ Topic
  ├─ MENTIONS          Chunk ─→ Entity
  ├─ RELATED_TO        Entity ←→ Entity  (带属性: relation_type, confidence)
  └─ TAGGED_WITH       Document/Chunk ─→ UserTag
```

> V1.0 NetworkX 图对象以 `.graphml` + `.json` 双格式持久化到 `data/graph_store/`。

---

## 8. API 设计概要

采用 **RESTful + WebSocket 流式** 混合架构。

### 8.1 REST API（非流式）

| 模块 | Method | 路径 | 说明 |
|-----|--------|-----|-----|
| 系统 | GET | `/api/v1/health` | 健康检查 + 版本信息 |
| 系统 | GET | `/api/v1/stats` | 知识库统计 KPI（文档数/Chunk 数/会话数等） |
| 摄入 | POST | `/api/v1/documents/upload` | 上传文件（支持 multipart 批量） |
| 摄入 | POST | `/api/v1/documents/import-url` | 导入网页 URL |
| 摄入 | GET | `/api/v1/documents` | 文档列表（分页、筛选、搜索） |
| 摄入 | GET | `/api/v1/documents/{id}` | 文档详情 + 预览 |
| 摄入 | DELETE | `/api/v1/documents/{id}` | 删除文档（含向量/图谱同步清理） |
| 处理 | POST | `/api/v1/processing/reindex` | 触发重建索引（增量/全量） |
| 处理 | GET | `/api/v1/processing/jobs/{job_id}` | 查询任务进度 |
| 记忆 | GET | `/api/v1/memory/profile` | 获取用户画像 |
| 记忆 | PUT | `/api/v1/memory/profile` | 更新用户画像 |
| 记忆 | GET | `/api/v1/memory/long-term` | 长期记忆列表 |
| 交互 | GET | `/api/v1/conversations` | 会话列表 |
| 交互 | POST | `/api/v1/conversations` | 新建会话 |
| 交互 | DELETE | `/api/v1/conversations/{id}` | 删除会话 |
| 交互 | GET | `/api/v1/search?q=` | 独立检索 API（不调用 LLM） |
| 维护 | POST | `/api/v1/maintenance/health-check` | 触发知识库健康检查 |
| 维护 | POST | `/api/v1/maintenance/backup` | 立即备份 |
| 隐私 | GET | `/api/v1/privacy/export` | 导出全部数据（ZIP 下载） |
| 隐私 | DELETE | `/api/v1/privacy/wipe` | 一键彻底删除所有数据 |

### 8.2 WebSocket 流式 API（核心问答）

```
连接：ws://localhost:8000/ws/chat/{conversation_id}

→ 发送：
{
  "type": "chat.message",
  "payload": {
    "query": "用户问题",
    "mode": "rag",          // rag / pure_llm / search_only
    "stream": true
  }
}

← 接收（事件流）：
{ "type": "chat.phase",       "data": { "phase": "retrieving" } }
{ "type": "search.results",   "data": { "chunks": [...] } }
{ "type": "chat.token",       "data": { "token": "你" } }
{ "type": "chat.token",       "data": { "token": "好" } }
{ "type": "chat.token",       "data": { "token": "，" } }
...
{ "type": "citations",        "data": { "refs": [{id,title,page,url}] } }
{ "type": "follow_ups",       "data": { "questions": ["...","...","..."] } }
{ "type": "chat.done",        "data": { "msg_id": "...", "tokens": 412, "latency_ms": 2840 } }
```

---

## 9. 部署架构

### 9.1 本地单机部署（V1.0 默认）

```
┌─────────────────── 用户设备（Windows/macOS/Linux）────────────────────┐
│                                                                       │
│  Electron 桌面进程 ──── 本地 HTTP+WS ────►  Python 后端 (FastAPI)     │
│  (Vue3 UI, 端口 5173)                  (Uvicorn, 端口 8000, 仅监听回环)│
│           │                                       │                   │
│           │                                       ├─► Chroma (内存映射)│
│           │                                       ├─► SQLite 单文件    │
│           │                                       ├─► NetworkX 内存图  │
│           │                                       └─► diskcache        │
│           │                                                           │
│           └────────────── 文件系统 I/O ─────────► data/ 目录           │
│                                    documents/ 原始文档                │
│                                    vector_store/ Chroma 数据          │
│                                    sqlite/ main.db                    │
│                                    graph_store/ graph.graphml         │
└───────────────────────────────────────────────────────────────────────┘
```

**特点**：
- 所有进程运行在用户本地，后端仅绑定 `127.0.0.1`，不暴露外网
- 零外部服务依赖（首次使用时按需下载 BGE 模型到本地缓存）
- 用户数据完全由用户掌控，可随时复制/迁移 `data/` 目录

### 9.2 可选云端同步架构（V1.5 +，用户主动开启）

```
用户设备 A                          云端（可选加密同步区）                 用户设备 B
    │                                     │                                     │
    ├─► 本地加密 data/ ▼                   │                                     │
    │    (AES-GCM 密文分片) ───►  对象存储（S3/OSS）◄─── (端到端加密) ──── 本地加密 data/
    │                                     │                                     │
    └─► 同步状态 SQLite ◄───►  同步中继服务（仅做一致性同步，不持有解密密钥） ◄──►
```

**原则**：云端仅持有密文，服务端无法解密；同步逻辑采用 `content-based addressing`（内容寻址）避免重复上传。

---

## 10. 关键技术挑战与应对

| 挑战 | 影响 | 应对方案 |
|-----|-----|---------|
| **大模型幻觉** | 回答不准确、编造引用 | 强制 RAG + 引用溯源 + 拒答阈值 + 引用准确率 ≥ 90% 指标 |
| **本地 Embedding 性能** | 首次批量导入慢 | 量化模型 (int8) + GPU 自动检测 + 批量 batch 处理 + 进度断点续传 |
| **10 万级 Chunk 检索** | 召回变慢 | Chroma HNSW 参数调优 + 分层索引（先按 tag/时间过滤，再向量检索）+ 冷热分离 |
| **中文长尾语义** | 检索不匹配 | 使用 BGE-M3 中文专用模型 + 查询改写 + 同义词扩展 + 混合 BM25 |
| **多轮对话上下文过长** | 成本飙升 + 效果下降 | 滑动窗口 + 滚动摘要 + 记忆压缩（超过 20 轮自动总结） |
| **用户隐私敏感** | 数据泄露风险 | 本地优先 + 最小化发送 + 脱敏过滤器 + 一键擦除 + 审计日志 |
| **桌面端 Python 环境打包** | 用户安装复杂 | PyInstaller 一键打包为可执行 / 使用嵌入式 Python（embeddable package）随 Electron 分发 |
| **大模型 API 成本** | 不可控 | 本地模型可选 + 语义缓存（diskcache，相似问题命中直接返回）+ token 用量统计面板 |

---

## 11. 版本迭代技术路线

| 版本 | 时间 | 技术交付重点 |
|-----|-----|-------------|
| **MVP** (V0.1) | 第 1-2 月 | FastAPI 骨架 + SQLite/Chroma + PDF/MD/DOCX Loader + 纯向量检索 + 单轮 RAG + 引用溯源 + 基础前端对话页 |
| **V1.0** | 第 3-5 月 | Web URL 抓取 + OCR + 混合检索(BM25+Rerank) + 多轮对话 + 短期记忆窗口 + 用户画像 + 主题聚类 + Electron 桌面端打包 |
| **V1.5** | 第 6-7 月 | 实体/关系抽取 + NetworkX 知识图谱可视化 + 知识库健康检查 + 自动备份/恢复 + 自动摘要生成 + AES-256 加密存储 |
| **V2.0** | 第 8-10 月 | Wiki 自动生成 + 主动推荐推送 + 插件系统（内置技能 + 自定义）+ 云端加密同步 + 浏览器插件 + Notion/飞书 API 接入 |

**MVP 交付标准（技术视角）**：
- ✅ 能导入 100 份 PDF/MD/DOCX 文档，完成向量化入库
- ✅ 10 个标准问题中，8 个以上回答准确且引用真实存在
- ✅ 端到端响应时间 P95 ≤ 5 秒
- ✅ Windows 可运行安装包 / macOS .app 可用

---

## 12. 快速开始

### 12.1 环境要求

- Python 3.11+
- Node.js 18+ (前端构建)
- 磁盘空间：≥ 2GB（模型 + 数据预留）
- 内存：≥ 8GB（使用本地 Embedding 模型时建议 16GB+）

### 12.2 后端启动

```bash
# 1. 克隆项目
cd self_knowledge_agent

# 2. 创建虚拟环境
python -m venv venv
.\venv\Scripts\activate        # Windows
# source venv/bin/activate     # macOS/Linux

# 3. 安装依赖
pip install -r requirements.txt
pip install -e .                # 以开发模式安装 src 包

# 4. 初始化配置与数据库
cp config/config.example.yaml config/config.yaml
python scripts/init_db.py

# 5. 启动后端服务
.\venv\Scripts\python.exe main.py
```

### 12.3 前端启动

```bash
cd frontend
npm install
npm run dev        # 开发模式：http://localhost:5173
npm run build      # 生产构建
```

### 12.4 验证 API

```bash
# 健康检查
curl http://127.0.0.1:8000/api/v1/health

# 上传测试文档
curl -X POST -F "file=@test.pdf" http://127.0.0.1:8000/api/v1/documents/upload
```

---

> 本文档为技术架构总纲，各模块详细设计请参考对应子模块的 `DESIGN.md` 文档。
