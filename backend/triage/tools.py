import asyncio
import aiosqlite
from splunklib.ai.registry import ToolRegistry
from splunklib.ai.tool_context import ToolContext

registry = ToolRegistry()


@registry.tool()
def run_spl_query(spl: str, earliest: str = "-30m", latest: str = "now", ctx: ToolContext = None) -> str:
    """Execute a Splunk search and return formatted results."""
    from splunk_client import SplunkClient
    client = SplunkClient.__new__(SplunkClient)
    client.service = ctx.service
    rows = client.search(spl, earliest=earliest, latest=latest)
    return client.format_search_results(rows)


@registry.tool()
def get_alert_context(alert_id: str, ctx: ToolContext = None) -> str:
    """Return the raw event data for a given alert id."""
    from config import settings

    async def _fetch():
        async with aiosqlite.connect(settings.db_path) as db:
            async with db.execute(
                "SELECT raw_event FROM alerts WHERE id = ?", (alert_id,)
            ) as cursor:
                row = await cursor.fetchone()
                return row[0] if row else "{}"

    loop = asyncio.get_event_loop()
    if loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(asyncio.run, _fetch())
            return future.result()
    return loop.run_until_complete(_fetch())
