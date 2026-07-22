import asyncio

from deploytoagents import DeployToAgentsClient


async def main() -> None:
    async with DeployToAgentsClient() as client:
        tools = await client.list_tools()
        names = sorted(tool.name for tool in tools)
        expected = sorted(["audit_app", "get_audit_result", "create_distribution_plan", "get_customer_zero_evidence"])
        if names != expected:
            raise RuntimeError(f"Unexpected tools: {names}")
        evidence = await client.get_customer_zero_evidence()
        if evidence.get("independent_discovery_status") != "not-yet-proven":
            raise RuntimeError("Customer Zero discovery limitation changed unexpectedly")
        print(f"Python MCP smoke passed: {', '.join(names)}")


asyncio.run(main())
