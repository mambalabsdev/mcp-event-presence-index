#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(here, "..", "package.json"), "utf8"),
) as { version: string; name: string };

// Distinctive UA so Apify run meta.userAgent marks MCP-originated runs.
const USER_AGENT = `mambalabs-mcp ${pkg.name}@${pkg.version}`;

type ToolResult = {
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
};

// Drop undefined values so optional inputs are not sent to the actor.
function compact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// Shared caller. actorPath is the actor's immutable Apify actor ID (a stable key
// that survives Store renames). The /v2/acts/{id} endpoint accepts it directly,
// so a Store rename never breaks these calls.
//
// The token is read here rather than at module load, so the tool registers
// unconditionally and a server started without APIFY_TOKEN still advertises its
// capabilities instead of reporting none.
async function runActor(
  actorPath: string,
  actorLabel: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  if (!APIFY_TOKEN) {
    return { isError: true, content: [{ type: "text", text: "APIFY_TOKEN is not set. Create a token at https://console.apify.com/account/integrations and set it as the APIFY_TOKEN environment variable." }] };
  }

  const url = `https://api.apify.com/v2/acts/${actorPath}/run-sync-get-dataset-items?timeout=300`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${APIFY_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify(input),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { isError: true, content: [{ type: "text", text: `Could not reach the Apify API: ${message}` }] };
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body?.error?.message) detail = ` ${body.error.message}`;
    } catch {
      detail = "";
    }

    let message: string;
    switch (response.status) {
      case 400:
        message = `The ${actorLabel} run was rejected as invalid input.${detail}`;
        break;
      case 401:
        message = "Invalid Apify token. Check your APIFY_TOKEN environment variable.";
        break;
      case 402:
        message =
          "Insufficient Apify credits. Check your account balance at https://console.apify.com/billing";
        break;
      case 408:
        message = `The ${actorLabel} run timed out after 300 seconds. Ask for less per call, or run the actor on Apify directly for larger jobs.`;
        break;
      default:
        message = `Apify request to ${actorLabel} failed with status ${response.status}.${detail}`;
    }
    return { isError: true, content: [{ type: "text", text: message }] };
  }

  // A 2xx from run-sync-get-dataset-items normally carries the dataset array.
  // Anything else on this path is a failure the caller must see, never an empty
  // success: surfacing it here is what keeps a failed run from reading as "no
  // results found".
  let items: unknown;
  try {
    items = await response.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { isError: true, content: [{ type: "text", text: `The ${actorLabel} run returned a response that could not be parsed: ${message}` }] };
  }

  if (!Array.isArray(items)) {
    const asObj = items as { error?: { type?: string; message?: string } };
    const detail = asObj?.error?.message
      ? `${asObj.error.message}`
      : JSON.stringify(items);
    return { isError: true, content: [{ type: "text", text: `The ${actorLabel} run did not return a dataset. ${detail}` }] };
  }

  return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
}

const server = new McpServer({
  name: "mamba-event-presence-index",
  version: pkg.version,
});

// Event Presence Index (immutable actor ID WLhMy8fMDgsxdYxv5)
server.registerTool(
  "map_company_event_presence",
  {
    title: "Map Company Event Presence",
    description:
      "Give it a company domain. It returns the third party conferences and trade shows that company publicly says it attends, with a year for each where one can be resolved, as one flat row. The search runs against the company's own domain, which is what stops a brand collision returning another company's events. The company's own conference is reported separately and is never mixed into the attendance list. It finds events for roughly 2 companies in 10, and an empty row is an honest empty row rather than a guess: read coverage, fetch_status and queries_failed to tell a company with no published events apart from a search that could not see. Events dated outside the years you ask for are still returned and flagged, so filter on event year rather than assuming the input filtered for you. This is not an events database and not an exhibitor list: it takes a company and reports what that company publishes. Requires an APIFY_TOKEN and consumes Apify credits. Read only.",
    annotations: {
      title: "Map Company Event Presence",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    inputSchema: {
    domain: z.string().describe("A single company domain, for example 6sense.com. Protocol and path are stripped."),
    company_name: z.string().optional().describe("Improves matching when the brand differs from the domain stem, for example Gong for gong.io. Derived from the domain when left empty."),
    years: z.string().optional().describe("Comma separated, for example 2025,2026. Events dated outside this set are still returned and flagged. Sent as a string so it works from Clay. Default: \"2025,2026\"."),
    include_own_events: z.boolean().optional().describe("Reports whether the company runs its own conference as a separate field. It is never mixed into the attendance list. Default: true."),
    max_queries: z.string().optional().describe("Between 1 and 5. Each query costs roughly 0.8 seconds plus a 1.3 second pause. 2 is the measured sweet spot: search engines refuse a third query from the same container almost every time, and the third query added no events the first two did not already find. Sent as a string so it works from Clay. Default: \"2\"."),
    skipCache: z.enum(["false", "true"]).optional().describe("false uses the 21 day result cache. true forces a fresh look. Default: \"false\"."),
    },
  },
  async (args) =>
    runActor("WLhMy8fMDgsxdYxv5", "Event Presence Index", compact(args as Record<string, unknown>)),
);

const transport = new StdioServerTransport();
await server.connect(transport);
