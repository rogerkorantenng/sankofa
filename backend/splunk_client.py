import splunklib.client as splunk_client_lib
import splunklib.results as splunk_results
from config import settings


class SplunkClient:
    def __init__(self):
        self.service = splunk_client_lib.connect(
            host=settings.splunk_host,
            port=settings.splunk_port,
            splunkToken=settings.splunk_token, scheme="https",
            
        )

    def search(self, spl: str, earliest: str = "-15m", latest: str = "now") -> list[dict]:
        kwargs = {
            "exec_mode": "blocking",
            "earliest_time": earliest,
            "latest_time": latest,
            "count": 50,
            "output_mode": "json",
        }
        job = self.service.jobs.create(spl, **kwargs)
        reader = splunk_results.JSONResultsReader(job.results(output_mode="json", count=50))
        rows = []
        for item in reader:
            if isinstance(item, dict):
                rows.append(item)
        return rows

    def get_triggered_alerts(self) -> list[dict]:
        return self.search(
            "| rest /services/alerts/fired_alerts | table title, severity, trigger_time, sid"
        )

    def _build_time_filter(self, earliest: str, latest: str) -> str:
        return f'earliest="{earliest}" latest="{latest}"'

    def _format_results(self, rows: list[dict]) -> str:
        if not rows:
            return "No results found."
        truncated = rows[:50]
        lines = []
        for row in truncated:
            raw = row.get("_raw", str(row))
            lines.append(raw[:300])
        result = "\n".join(lines)
        if len(rows) > 50:
            result += f"\n[truncated — showing 50 of {len(rows)} results]"
        return result

    def format_search_results(self, rows: list[dict]) -> str:
        return self._format_results(rows)
