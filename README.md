# Deploy to Agents SDK

Public JavaScript client and registry metadata for the [Deploy to Agents](https://deploytoagents.com) remote MCP server.

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

```js
import { DeployToAgentsClient } from "deploytoagents-sdk";

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

The npm package name is reserved in this source but has not yet been published. Clone the repository and use the source directly until the first package release is announced.

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
