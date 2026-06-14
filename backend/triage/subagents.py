"""
Four specialized subagents that each query Splunk via MCP and direct REST,
returning structured findings with full SPL audit trails.
"""
import asyncio
import json
import anthropic
import splunklib.client as splunk_lib
import splunklib.results as splunk_results
from config import settings
from mcp_client import MCPClient, get_mcp_client


def _make_anthropic() -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)


def _make_service() -> splunk_lib.Service:
    return splunk_lib.connect(
        host=settings.splunk_host,
        port=settings.splunk_port,
        splunkToken=settings.splunk_token, scheme="https",
        
        timeout=10,
    )


def _run_spl(service: splunk_lib.Service, spl: str, earliest: str = "-30m") -> str:
    try:
        job = service.jobs.create(spl, exec_mode="blocking",
                                  earliest_time=earliest, latest_time="now",
                                  count=20, timeout=10)
        reader = splunk_results.JSONResultsReader(job.results(output_mode="json", count=20))
        rows = [item for item in reader if isinstance(item, dict)]
        if not rows:
            return "No results found."
        lines = [row.get("_raw", str(row))[:200] for row in rows[:20]]
        return "\n".join(lines)
    except Exception as e:
        return f"Search error: {e}"


async def _mcp_generate_and_run(
    mcp: MCPClient, service: splunk_lib.Service,
    natural_language: str, fallback_spl: str
) -> tuple[str, str]:
    """Use MCP to generate SPL from natural language, then run it. Returns (results, spl_used)."""
    if settings.splunk_mcp_enabled:
        gen_result = await mcp.generate_spl(natural_language)
        spl = gen_result.output.strip()
        # Only use if MCP returned a real SPL query
        if spl and not spl.lower().startswith("mcp unavailable") and (
            spl.lower().startswith("search") or spl.startswith("|")
        ):
            results = await asyncio.to_thread(_run_spl, service, spl)
            return results, f"[MCP generated] {spl}"
    # Fallback to hardcoded SPL
    results = await asyncio.to_thread(_run_spl, service, fallback_spl)
    return results, fallback_spl


def _parse_agent_response(text: str) -> dict:
    """Parse JSON from agent response, falling back to plain text."""
    stripped = text.strip()
    # Strip markdown code fences: ```json ... ``` or ``` ... ```
    if stripped.startswith("```"):
        lines = stripped.split("\n")
        # Drop first line (```json or ```) and last ``` line
        inner = "\n".join(
            line for line in lines[1:]
            if line.strip() != "```"
        ).strip()
        stripped = inner
    # Extract first JSON object if present anywhere in the string
    start = stripped.find("{")
    end = stripped.rfind("}") + 1
    if start != -1 and end > start:
        try:
            return json.loads(stripped[start:end])
        except json.JSONDecodeError:
            pass
    return {"findings": text, "indicators": []}


async def run_auth_agent(source_ip: str, affected_host: str, timestamp: str) -> dict:
    mcp = get_mcp_client()
    service = await asyncio.to_thread(_make_service)

    nl_query = (
        f"Find authentication events involving source IP {source_ip} "
        f"or host {affected_host} in the last 30 minutes"
    )
    fallback_spl = (
        f'search index=* (sourcetype="WinEventLog:Security" OR sourcetype="linux_secure") '
        f'(src_ip="{source_ip}" OR host="{affected_host}") '
        f'earliest=-30m latest=now | head 20 | table _time, EventCode, Account_Name, src_ip, host, _raw'
    )
    raw_results, spl_used = await _mcp_generate_and_run(mcp, service, nl_query, fallback_spl)

    client = _make_anthropic()
    prompt = f"""You are a security analyst. Analyze these authentication log events for threats.
Source IP: {source_ip}, Affected host: {affected_host}, Alert time: {timestamp}

Raw log events:
{raw_results[:2000]}

Respond with JSON only:
{{"findings": "<2-3 sentence analysis>", "indicators": ["<indicator 1>", "<indicator 2>"]}}"""

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    result = _parse_agent_response(message.content[0].text)
    result["spl_query"] = spl_used
    return result


async def run_network_agent(source_ip: str, timestamp: str) -> dict:
    mcp = get_mcp_client()
    service = await asyncio.to_thread(_make_service)

    nl_query = f"Find network flows from or to source IP {source_ip} in the last 30 minutes"
    fallback_spl = (
        f'search index=* (sourcetype="firewall" OR sourcetype="pan:traffic" OR sourcetype="cisco:asa") '
        f'(src="{source_ip}" OR dest="{source_ip}") '
        f'earliest=-30m latest=now | head 20 | table _time, src, dest, dpt, action, _raw'
    )
    raw_results, spl_used = await _mcp_generate_and_run(mcp, service, nl_query, fallback_spl)

    client = _make_anthropic()
    prompt = f"""You are a network security analyst. Analyze these network flow events.
Source IP: {source_ip}, Alert time: {timestamp}

Raw log events:
{raw_results[:2000]}

Respond with JSON only:
{{"findings": "<2-3 sentence analysis>", "indicators": ["<indicator 1>", "<indicator 2>"]}}"""

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    result = _parse_agent_response(message.content[0].text)
    result["spl_query"] = spl_used
    return result


async def run_endpoint_agent(affected_host: str, timestamp: str) -> dict:
    mcp = get_mcp_client()
    service = await asyncio.to_thread(_make_service)

    nl_query = f"Find suspicious process and file activity on host {affected_host} in the last 30 minutes"
    fallback_spl = (
        f'search index=* (sourcetype="WinEventLog:System" OR sourcetype="sysmon" OR sourcetype="osquery") '
        f'host="{affected_host}" '
        f'earliest=-30m latest=now | head 20 | table _time, host, EventCode, Process_Name, Process_Command_Line, _raw'
    )
    raw_results, spl_used = await _mcp_generate_and_run(mcp, service, nl_query, fallback_spl)

    client = _make_anthropic()
    prompt = f"""You are an endpoint forensics analyst. Analyze these process and system events.
Affected host: {affected_host}, Alert time: {timestamp}

Raw log events:
{raw_results[:2000]}

Respond with JSON only:
{{"findings": "<2-3 sentence analysis>", "indicators": ["<indicator 1>", "<indicator 2>"]}}"""

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    result = _parse_agent_response(message.content[0].text)
    result["spl_query"] = spl_used
    return result


async def run_lateral_agent(affected_host: str, timestamp: str) -> dict:
    mcp = get_mcp_client()
    service = await asyncio.to_thread(_make_service)

    nl_query = f"Find lateral movement from host {affected_host} to other internal hosts in the last 30 minutes"
    fallback_spl = (
        f'search index=* sourcetype="WinEventLog:Security" '
        f'(EventCode=4648 OR EventCode=4624) host="{affected_host}" '
        f'earliest=-30m latest=now | head 20 | table _time, EventCode, Account_Name, Target_Server_Name, Logon_Type, _raw'
    )
    raw_results, spl_used = await _mcp_generate_and_run(mcp, service, nl_query, fallback_spl)

    client = _make_anthropic()
    prompt = f"""You are a threat hunter specializing in lateral movement detection.
Affected host: {affected_host}, Alert time: {timestamp}

Raw log events:
{raw_results[:2000]}

Respond with JSON only:
{{"findings": "<2-3 sentence analysis>", "indicators": ["<indicator 1>", "<indicator 2>"], "other_hosts": ["<host 1>"]}}"""

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    result = _parse_agent_response(message.content[0].text)
    result.setdefault("other_hosts", [])
    result["spl_query"] = spl_used
    return result
