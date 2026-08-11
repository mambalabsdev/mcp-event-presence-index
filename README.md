# Event Presence Index MCP Server

[![Smithery](https://smithery.ai/badge/mambabuilt/mcp-event-presence-index)](https://smithery.ai/servers/mambabuilt/mcp-event-presence-index) [![Glama score](https://glama.ai/mcp/servers/mambalabsdev/mcp-event-presence-index/badges/score.svg)](https://glama.ai/mcp/servers/mambalabsdev/mcp-event-presence-index) [![MCP Registry](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fregistry.modelcontextprotocol.io%2Fv0%2Fservers%3Fsearch%3Dcom.mambabuilt%252Fmcp-event-presence-index%26limit%3D1&query=%24.servers%5B0%5D._meta%5B%22io.modelcontextprotocol.registry%2Fofficial%22%5D.status&label=mcp%20registry&color=blue)](https://registry.modelcontextprotocol.io/v0/servers?search=com.mambabuilt/mcp-event-presence-index&limit=1) [![npm version](https://img.shields.io/npm/v/@mambalabsdev/mcp-event-presence-index)](https://www.npmjs.com/package/@mambalabsdev/mcp-event-presence-index) [![npm downloads](https://img.shields.io/npm/dm/@mambalabsdev/mcp-event-presence-index)](https://www.npmjs.com/package/@mambalabsdev/mcp-event-presence-index) [![license](https://img.shields.io/github/license/mambalabsdev/mcp-event-presence-index)](https://github.com/mambalabsdev/mcp-event-presence-index/blob/main/LICENSE) [![mcpservers.org](https://img.shields.io/badge/mcpservers.org-listed-blue)](https://mcpservers.org/servers/mambalabsdev/mcp-event-presence-index)

MCP server for the Mamba Labs [Event Presence Index](https://apify.com/mambalabs/event-presence-index) actor on Apify.

Give it a company domain. It returns the third party conferences and trade shows that company publicly says it attends, with a year for each where one can be resolved, as one flat row. Its own conference is reported separately and never mixed into the attendance list.

## Install

```bash
npx -y @mambalabsdev/mcp-event-presence-index
```

### Claude Desktop

```json
{
  "mcpServers": {
    "mamba-event-presence-index": {
      "command": "npx",
      "args": ["-y", "@mambalabsdev/mcp-event-presence-index"],
      "env": { "APIFY_TOKEN": "your-apify-token" }
    }
  }
}
```

Get an Apify token at [console.apify.com/account/integrations](https://console.apify.com/account/integrations).

## Tool

### `map_company_event_presence`

Company domain in, the events that company says it attends out.

| Input | Type | Required | Notes |
| --- | --- | --- | --- |
| `domain` | string | yes | A single company domain, for example 6sense.com. Protocol and path are stripped. |
| `company_name` | string | no | Improves matching when the brand differs from the domain stem, for example Gong for gong.io. Derived from the domain when left empty. |
| `years` | string | no | Comma separated, for example 2025,2026. Events dated outside this set are still returned and flagged. Sent as a string so it works from Clay. Default `2025,2026`. |
| `include_own_events` | boolean | no | Reports whether the company runs its own conference as a separate field. It is never mixed into the attendance list. Default `true`. |
| `max_queries` | string | no | Between 1 and 5. 2 is the measured sweet spot: search engines refuse a third query from the same container almost every time. Sent as a string so it works from Clay. Default `2`. |
| `skipCache` | enum | no | `false` uses the 21 day result cache, `true` forces a fresh look. Default `false`. |

## Reading the output

It finds events for roughly 2 companies in 10, and every event it returns is real. An empty row is an honest empty row rather than a guess, so read `coverage`, `fetch_status` and `queries_failed` to tell a company that publishes nothing apart from a search that could not see.

Events dated outside the years you asked for are still returned and flagged, so filter on the event year rather than assuming the input filtered for you.

## Billing

You are charged per company analyzed, plus a small actor start fee. A repeat run inside the 21 day cache window costs nothing new.

Pricing is on the [actor's Apify page](https://apify.com/mambalabs/event-presence-index). Running this server consumes Apify credits.

## What this server does and does not do

It is a thin client for the Apify actor. It passes your input through and returns the actor's output unchanged. Every behavior described above lives in the actor, not here.

This is not an events database. It is not a ticketing feed, not a directory of conferences, and not a list of everyone exhibiting at a show. It takes a company and reports what that company publishes about the events it attends.

Errors are surfaced, never swallowed. An invalid input, an invalid token, an exhausted balance, a timeout, or a run that returns anything other than a dataset all come back as an explicit tool error rather than as an empty result.

## Source

The actor is on the [Apify Store](https://apify.com/mambalabs/event-presence-index). This wrapper is [MIT licensed](LICENSE).

Built by [Mamba Labs](https://apify.com/mambalabs)
