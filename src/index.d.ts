export const DEFAULT_ENDPOINT: "https://deploytoagents.com/mcp";

export type DeployToAgentsClientOptions = {
  endpoint?: string;
  clientName?: string;
  clientVersion?: string;
};

export type AuditFinding = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  points: number;
  maxPoints: number;
  evidence: string;
  url: string | null;
};

export type QueuedAudit = {
  audit_id: string;
  status: "queued";
  hostname: string;
  receipt_url: string;
  privacy: "unlisted-noindex-unless-explicitly-published";
};

export type AuditResult = {
  audit_id: string;
  status: "queued" | "running" | "completed" | "failed";
  score: number | null;
  hostname: string;
  findings: AuditFinding[];
  receipt_url: string;
  visibility: "public" | "unlisted-noindex";
  requested_at: string;
  completed_at: string | null;
};

export type DistributionPlanItem = {
  priority: number;
  status: "required" | "recommended" | "verified";
  channel: string;
  action: string;
  reason: string;
};

export class DeployToAgentsClient {
  readonly endpoint: URL;
  constructor(options?: DeployToAgentsClientOptions);
  connect(): Promise<this>;
  listTools(): Promise<Array<{ name: string; title?: string; description?: string }>>;
  auditApp(url: string): Promise<QueuedAudit>;
  getAuditResult(auditId: string): Promise<AuditResult>;
  createDistributionPlan(auditId: string): Promise<{
    audit_id: string;
    hostname: string;
    score: number;
    plan: DistributionPlanItem[];
    limitation: string;
  }>;
  getCustomerZeroEvidence(): Promise<{
    customer_zero: true;
    technical_audit_score: number;
    receipt_url: string;
    claim: string;
    externally_verified: Array<{
      type: "official-mcp-registry" | "public-source-release" | "npm-package" | "pypi-package";
      identifier: string;
      url: string;
    }>;
    independent_discovery_status: "not-yet-proven" | "observed";
    next_proof: string;
  }>;
  close(): Promise<void>;
}
