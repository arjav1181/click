"use client";

import { Button, Card, CardHeader } from "@click/ui";
import Link from "next/link";

const SNIPPETS: Record<string, string> = {
  claude: `{
  "mcpServers": {
    "click": {
      "command": "npx",
      "args": ["-y", "@click/mcp", "--url", "https://your-click-instance.example.com", "--token", "ck_…"]
    }
  }
}`,
  cursor: `{
  "mcpServers": {
    "click": {
      "url": "https://your-click-instance.example.com/api/v1/mcp",
      "headers": { "Authorization": "Bearer ck_…" }
    }
  }
}`,
  generic: `POST https://your-click-instance.example.com/api/v1/mcp
Authorization: Bearer ck_…
Content-Type: application/json

{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }`,
};

export default function McpSetupPage() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">MCP setup</h2>
        <p className="text-sm text-text-muted">
          Connect AI clients like Claude Desktop, Cursor or any MCP-compatible tool to your Click workspace.
        </p>
      </div>

      <Card className="mb-4">
        <CardHeader title="Endpoint" description="Point your client at this URL." />
        <div className="grid gap-3 p-4">
          <p className="mono break-all text-sm text-text">https://your-click-instance.example.com/api/v1/mcp</p>
          <p className="text-xs text-text-muted">
            Replace the host with your instance URL. Authentication uses a scoped API key created on the
            Developers page.
          </p>
          <Link href="/app/developers">
            <Button variant="secondary" size="sm">
              Create an API key
            </Button>
          </Link>
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader title="Available tools" description="What connected clients can do." />
        <ul className="grid gap-2 p-4 text-sm text-text">
          <li>Search meetings, transcripts and notes.</li>
          <li>Read a meeting's summary, transcript and action items.</li>
          <li>List open action items across the workspace.</li>
          <li>Ask a question across meetings and get cited answers.</li>
        </ul>
      </Card>

      <div className="grid gap-4">
        {Object.entries(SNIPPETS).map(([key, snippet]) => (
          <Card key={key}>
            <CardHeader title={key === "claude" ? "Claude Desktop" : key === "cursor" ? "Cursor" : "Generic client"} />
            <pre className="overflow-x-auto bg-surface-2 p-4 text-xs text-text">
              <code>{snippet}</code>
            </pre>
          </Card>
        ))}
      </div>

      <p className="mt-4 text-xs text-text-muted">
        The MCP server must be enabled by an admin. If tools are not listed, check that the instance has
        MCP turned on and that your key has the right scopes.
      </p>
    </div>
  );
}
