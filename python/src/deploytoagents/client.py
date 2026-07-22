from __future__ import annotations

import json
from contextlib import AsyncExitStack
from typing import Any

from mcp import ClientSession, types
from mcp.client.streamable_http import streamable_http_client

DEFAULT_ENDPOINT = "https://deploytoagents.com/mcp"


class DeployToAgentsClient:
    def __init__(self, endpoint: str = DEFAULT_ENDPOINT) -> None:
        if not endpoint.startswith("https://") and not endpoint.startswith(("http://localhost", "http://127.0.0.1")):
            raise ValueError("The MCP endpoint must use HTTPS unless it is local development")
        self.endpoint = endpoint
        self._stack: AsyncExitStack | None = None
        self._session: ClientSession | None = None

    async def __aenter__(self) -> DeployToAgentsClient:
        self._stack = AsyncExitStack()
        read, write, _ = await self._stack.enter_async_context(streamable_http_client(self.endpoint))
        self._session = await self._stack.enter_async_context(ClientSession(read, write))
        await self._session.initialize()
        return self

    async def __aexit__(self, *exc: object) -> None:
        if self._stack is not None:
            await self._stack.aclose()
        self._stack = None
        self._session = None

    def _require_session(self) -> ClientSession:
        if self._session is None:
            raise RuntimeError("Use DeployToAgentsClient as an async context manager")
        return self._session

    @staticmethod
    def _value(result: types.CallToolResult) -> Any:
        if result.isError:
            message = next((item.text for item in result.content if isinstance(item, types.TextContent)), "Deploy to Agents tool failed")
            raise RuntimeError(message)
        if result.structuredContent is not None:
            return result.structuredContent
        text = next((item.text for item in result.content if isinstance(item, types.TextContent)), None)
        if text is None:
            return None
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return text

    async def list_tools(self) -> list[types.Tool]:
        return (await self._require_session().list_tools()).tools

    async def audit_app(self, url: str) -> dict[str, Any]:
        return self._value(await self._require_session().call_tool("audit_app", {"url": url}))

    async def get_audit_result(self, audit_id: str) -> dict[str, Any]:
        return self._value(await self._require_session().call_tool("get_audit_result", {"audit_id": audit_id}))

    async def create_distribution_plan(self, audit_id: str) -> dict[str, Any]:
        return self._value(await self._require_session().call_tool("create_distribution_plan", {"audit_id": audit_id}))

    async def get_customer_zero_evidence(self) -> dict[str, Any]:
        return self._value(await self._require_session().call_tool("get_customer_zero_evidence", {}))
