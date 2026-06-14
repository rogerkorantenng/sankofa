import httpx
from dataclasses import dataclass
from config import settings


@dataclass
class MCPToolResult:
    tool_name: str
    output: str
    spl_used: str = ""


class MCPClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    async def _call_tool(self, tool_name: str, arguments: dict) -> str:
        payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments},
            "id": 1,
        }
        try:
            async with httpx.AsyncClient(verify=False, timeout=15) as client:
                resp = await client.post(
                    self.base_url,
                    headers=self.headers,
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                result = data.get("result", {})
                content = result.get("content", [])
                if content and isinstance(content, list):
                    return content[0].get("text", str(result))
                return str(result)
        except Exception as e:
            return f"MCP unavailable: {e}"

    async def run_splunk_query(self, spl: str, earliest: str = "-30m") -> MCPToolResult:
        output = await self._call_tool(
            "run_splunk_query",
            {"query": spl, "earliest_time": earliest, "latest_time": "now"},
        )
        return MCPToolResult(tool_name="run_splunk_query", output=output, spl_used=spl)

    async def generate_spl(self, natural_language: str) -> MCPToolResult:
        output = await self._call_tool(
            "generate_spl",
            {"query": natural_language},
        )
        return MCPToolResult(tool_name="generate_spl", output=output, spl_used=output)


def get_mcp_client() -> MCPClient:
    return MCPClient(
        base_url=f"https://{settings.splunk_host}:{settings.splunk_port}/services/mcp",
        token=settings.splunk_token,
    )
