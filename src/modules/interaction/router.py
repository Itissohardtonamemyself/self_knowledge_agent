from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_db_session, get_session_factory
from ...schemas.common import ApiResponse
from ...schemas.conversation import (
    ChatRequest, ChatResponse, ConversationCreate, ConversationOut,
    SimpleSearchRequest, SearchHit,
)
from ...core.logging import log
from ...core.exceptions import AppBaseException, to_http_exception
from .service import InteractionService
from .llm.provider import get_available_models, test_model_availability

router = APIRouter(tags=["智能交互层 Interaction"])
_service = InteractionService()


# ========== 会话管理 ==========
@router.get("/conversations", response_model=ApiResponse[dict])
async def list_conversations(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=200),
    db: AsyncSession = Depends(get_db_session),
):
    try:
        return ApiResponse.success(await _service.list_conversations(db, page=page, page_size=page_size))
    except Exception as e:
        log.exception("list_conversations")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/conversations", response_model=ApiResponse[ConversationOut])
async def create_conversation(create: ConversationCreate, db: AsyncSession = Depends(get_db_session)):
    try:
        return ApiResponse.success(await _service.create_conversation(db, create))
    except AppBaseException as e:
        raise to_http_exception(e)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/conversations/{conv_id}", response_model=ApiResponse[dict])
async def delete_conversation(conv_id: str, db: AsyncSession = Depends(get_db_session)):
    try:
        return ApiResponse.success(await _service.delete_conversation(db, conv_id))
    except AppBaseException as e:
        raise to_http_exception(e)
    except Exception as e:
        log.exception("delete_conversation")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations/{conv_id}/messages", response_model=ApiResponse[dict])
async def list_messages(
    conv_id: str, page: int = Query(1, ge=1), page_size: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db_session),
):
    try:
        return ApiResponse.success(await _service.list_messages(db, conv_id, page=page, page_size=page_size))
    except Exception as e:
        log.exception("list_messages")
        raise HTTPException(status_code=500, detail=str(e))


# ========== 对话 API ==========
@router.post("/chat", response_model=ApiResponse[ChatResponse])
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db_session)):
    try:
        return ApiResponse.success(await _service.chat(db, req))
    except AppBaseException as e:
        raise to_http_exception(e)
    except Exception as e:
        log.exception("chat error")
        raise HTTPException(status_code=500, detail=str(e))


@router.websocket("/ws/chat")
async def ws_chat(websocket: WebSocket):
    """WebSocket 流式问答。

    接收 JSON 消息格式同 ChatRequest；服务端按事件流返回：chat.phase / search.results /
    chat.token / citations / follow_ups / chat.done。
    """
    await websocket.accept()
    # 在 ws 中创建独立 DB 会话
    factory = get_session_factory()
    db: AsyncSession = factory()
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
                req = ChatRequest(**payload)
            except Exception as e:
                await websocket.send_json({"type": "error", "data": {"message": f"无法解析请求: {e}"}})
                continue
            try:
                async for event in _service.chat_stream(db, req):
                    await websocket.send_json(event)
            except WebSocketDisconnect:
                break
            except AppBaseException as e:
                await websocket.send_json({"type": "error", "data": {"message": e.message, "code": e.code}})
            except Exception as e:
                log.exception("ws_chat stream")
                await websocket.send_json({"type": "error", "data": {"message": str(e)}})
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await db.close()
        except Exception:
            pass
        try:
            await websocket.close()
        except Exception:
            pass


# ========== 模型管理 ==========
@router.get("/models", response_model=ApiResponse[list[dict]])
async def list_models():
    """获取所有可用的大模型列表"""
    try:
        models = get_available_models()
        return ApiResponse.success(models)
    except Exception as e:
        log.exception("list_models")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/models/test", response_model=ApiResponse[dict])
async def test_model(provider: str, model: str, base_url: str = None):
    """测试指定大模型的可用性"""
    try:
        result = await test_model_availability(provider, model, base_url)
        return ApiResponse.success(result)
    except Exception as e:
        log.exception("test_model")
        raise HTTPException(status_code=500, detail=str(e))


# ========== 独立检索 ==========
@router.post("/search", response_model=ApiResponse[list[SearchHit]])
def simple_search(req: SimpleSearchRequest):
    try:
        return ApiResponse.success(_service.simple_search(req))
    except AppBaseException as e:
        raise to_http_exception(e)
    except Exception as e:
        log.exception("simple_search")
        raise HTTPException(status_code=500, detail=str(e))
