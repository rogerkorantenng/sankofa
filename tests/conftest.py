import os
import sys

# Ensure backend is on the path for all tests
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))

# Provide required env vars so config.py doesn't error on import
os.environ.setdefault("SPLUNK_TOKEN", "test-token")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
