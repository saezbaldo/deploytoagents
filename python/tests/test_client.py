import pytest

from deploytoagents import DEFAULT_ENDPOINT, DeployToAgentsClient


def test_default_endpoint_is_canonical():
    assert DEFAULT_ENDPOINT == "https://deploytoagents.com/mcp"


def test_rejects_cleartext_remote_endpoint():
    with pytest.raises(ValueError):
        DeployToAgentsClient("http://example.com/mcp")


def test_allows_local_development_endpoint():
    assert DeployToAgentsClient("http://localhost:3000/mcp").endpoint.endswith("/mcp")
