# Deploy to Agents for Python

Official Python client for the public Deploy to Agents Streamable HTTP MCP server.

```bash
pip install deploytoagents
```

```python
import asyncio
from deploytoagents import DeployToAgentsClient

async def main():
    async with DeployToAgentsClient() as client:
        evidence = await client.get_customer_zero_evidence()
        print(evidence["receipt_url"])

asyncio.run(main())
```

The client exposes `audit_app`, `get_audit_result`, `create_distribution_plan`, `get_customer_zero_evidence`, and `list_tools`. Audit receipts for third-party apps are unlisted and noindex by default.
