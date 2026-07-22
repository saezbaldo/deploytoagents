import { DeployToAgentsClient } from "../src/index.js";

const client = new DeployToAgentsClient();
try {
  const tools = await client.listTools();
  const evidence = await client.getCustomerZeroEvidence();
  if (tools.length !== 4) throw new Error(`Expected four tools, received ${tools.length}`);
  if (evidence.independent_discovery_status !== "not-yet-proven") {
    throw new Error("Customer Zero evidence overstates independent discovery");
  }
  console.log(`Connected to Deploy to Agents: ${tools.map((tool) => tool.name).join(", ")}`);
} finally {
  await client.close();
}
