import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))
from unittest.mock import AsyncMock, patch, MagicMock
from mcp_client import MCPClient, MCPToolResult


def test_mcp_tool_result_fields():
    result = MCPToolResult(tool_name="run_splunk_query", output="test output", spl_used="search index=*")
    assert result.tool_name == "run_splunk_query"
    assert result.output == "test output"
    assert result.spl_used == "search index=*"


@pytest.mark.asyncio
async def test_mcp_client_falls_back_on_connection_error():
    with patch("mcp_client.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post.side_effect = Exception("connection refused")
        client = MCPClient(base_url="https://localhost:8089/services/mcp", token="test")
        result = await client.run_splunk_query("search index=*")
    assert "unavailable" in result.output.lower() or "error" in result.output.lower()
