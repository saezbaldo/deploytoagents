# Security

Please do not publish suspected vulnerabilities in a public issue. Report them through GitHub's private vulnerability reporting for this repository.

The public MCP server accepts only public HTTP and HTTPS audit targets. Its worker validates resolved addresses and redirects, rejects private and reserved networks, and bounds response size and request time. Audit receipts are unlisted and noindex by default; they are not authenticated private storage.
