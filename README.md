# Deploy to Agents SDK

Public JavaScript client and registry metadata for the [Deploy to Agents](https://deploytoagents.com) remote MCP server.

The remote server is published in the official MCP Registry as `com.deploytoagents/server` and is served from `https://deploytoagents.com/mcp`. The JavaScript client and authenticated agent-first CLI are published as `deploytoagents@0.4.0` on npm, with an equivalent `deploytoagents==0.1.1` client on PyPI.

## Agent-first CLI

```bash
npx deploytoagents login
npx deploytoagents whoami
npx deploytoagents portfolio --json
npx deploytoagents discovery --json
npx deploytoagents discovery-record --input observation.json --json
npx deploytoagents audit https://example.com --json
```

The package installs both `deploytoagents` and the shorter `d2a` command. Google login uses Authorization Code with PKCE and a temporary loopback callback. On Windows the refresh credential is encrypted for the current OS user with DPAPI; CI can provide a short-lived identity token through `DEPLOYTOAGENTS_TOKEN`. Discovery Lab can be read or supplied with a JSON observation file (or stdin via `--input -`). All command results and errors have stable JSON forms for agent use.

```json
{
  "hostname": "example.com",
  "surface": "claude",
  "model": "model label shown by the surface",
  "prompt": "Exact generic, unbranded prompt",
  "outcome": "not-mentioned",
  "freshSession": true,
  "responseExcerpt": "Optional relevant excerpt",
  "citations": ["https://example.org/source"]
}
```

Valid outcomes are `recommended`, `mentioned`, `not-mentioned`, and `error`. The server verifies that the signed-in organization owns the target hostname.

Deploy to Agents currently audits public agent-facing surfaces, returns unlisted evidence receipts, and creates prioritized technical and external-authority distribution plans. It does **not** yet claim to publish every customer artifact or guarantee recommendation by any model.

## Connect directly through MCP

Use this Streamable HTTP endpoint in any compatible MCP client:

```text
https://deploytoagents.com/mcp
```

Available tools:

- `audit_app`
- `get_audit_result`
- `create_distribution_plan`
- `get_customer_zero_evidence`

## JavaScript client

```bash
npm install deploytoagents
```

```js
import { DeployToAgentsClient } from "deploytoagents";

const client = new DeployToAgentsClient();

try {
  const queued = await client.auditApp("https://example.com");
  console.log(queued.receipt_url);

  const result = await client.getAuditResult(queued.audit_id);
  if (result.status === "completed") {
    console.log(await client.createDistributionPlan(queued.audit_id));
  }
} finally {
  await client.close();
}
```

## Python client

```bash
pip install deploytoagents
```

```python
from deploytoagents import DeployToAgentsClient

async with DeployToAgentsClient() as client:
    queued = await client.audit_app("https://example.com")
    print(queued["receipt_url"])
```

## Customer Zero

Deploy to Agents uses its own system as its first customer. The current [100/100 receipt](https://deploytoagents.com/audits/89db3fa0-d7d8-4201-97fd-790727586a14) verifies technical surfaces only. Independent, unbranded discovery remains explicitly `not-yet-proven`.

## Development

```bash
npm install
npm test
npm run smoke
```

## Evidence policy

This project distinguishes owned evidence, externally verified artifacts, and independent recommendations. It does not create fake testimonials, automated community posts, coordinated votes, or links intended primarily to manipulate rankings.

## License

MIT
