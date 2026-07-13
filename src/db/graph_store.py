from __future__ import annotations

import networkx as nx
from pathlib import Path
from typing import Optional
from functools import lru_cache

from ..core.config import settings
from ..core.logging import log


class GraphStore:
    """NetworkX 内存图 + 本地持久化封装"""

    def __init__(self) -> None:
        self._graph = nx.MultiDiGraph()
        self._graph_path = Path(settings.paths.graph_store_dir) / "knowledge.graphml"
        Path(settings.paths.graph_store_dir).mkdir(parents=True, exist_ok=True)
        self._load()

    def _load(self) -> None:
        if self._graph_path.exists():
            try:
                self._graph = nx.read_graphml(self._graph_path)
                log.info(f"已加载知识图谱: {len(self._graph.nodes)} 节点, {len(self._graph.edges)} 关系")
                return
            except Exception as e:
                log.warning(f"加载知识图谱失败，将新建空图: {e}")
        self._graph = nx.MultiDiGraph()

    def save(self) -> None:
        try:
            Path(settings.paths.graph_store_dir).mkdir(parents=True, exist_ok=True)
            nx.write_graphml(self._graph, str(self._graph_path))
            log.debug(f"知识图谱已保存: {len(self._graph.nodes)} 节点")
        except Exception as e:
            log.error(f"保存知识图谱失败: {e}")

    @property
    def graph(self) -> nx.MultiDiGraph:
        return self._graph

    def add_node(self, node_id: str, label: str, **attrs) -> None:
        self._graph.add_node(node_id, label=label, **attrs)

    def add_edge(self, src: str, dst: str, rel_type: str, **attrs) -> None:
        self._graph.add_edge(src, dst, key=rel_type, relation=rel_type, **attrs)

    def neighbors(self, node_id: str, depth: int = 3) -> list[tuple[str, int]]:
        """取 N 跳邻居，返回 [(node_id, depth)]"""
        if node_id not in self._graph:
            return []
        result = []
        seen = {node_id}
        frontier = {node_id}
        for d in range(1, depth + 1):
            nxt = set()
            for n in frontier:
                for succ in self._graph.successors(n):
                    if succ not in seen:
                        seen.add(succ)
                        nxt.add(succ)
                        result.append((succ, d))
                for pred in self._graph.predecessors(n):
                    if pred not in seen:
                        seen.add(pred)
                        nxt.add(pred)
                        result.append((pred, d))
            frontier = nxt
            if not frontier:
                break
        return result

    def stats(self) -> dict:
        return {
            "nodes": len(self._graph.nodes),
            "edges": len(self._graph.edges),
        }


@lru_cache(maxsize=1)
def get_graph_store() -> GraphStore:
    return GraphStore()
