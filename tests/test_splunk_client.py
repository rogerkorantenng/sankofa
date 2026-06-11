from splunk_client import SplunkClient


def test_build_spl_time_filter():
    client = SplunkClient.__new__(SplunkClient)
    spl = client._build_time_filter("2026-06-11T10:00:00", "2026-06-11T11:00:00")
    assert "earliest=" in spl
    assert "latest=" in spl


def test_format_results_empty():
    client = SplunkClient.__new__(SplunkClient)
    result = client._format_results([])
    assert result == "No results found."


def test_format_results_truncates_at_50():
    client = SplunkClient.__new__(SplunkClient)
    rows = [{"_raw": f"event {i}"} for i in range(100)]
    result = client._format_results(rows)
    assert "event 49" in result
    assert "event 50" not in result
    assert "truncated" in result.lower()
