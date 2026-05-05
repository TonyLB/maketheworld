# Connections lambda - agent notes

## Session row key shape (`Meta::Session`) and DynamoDB trade-offs

Canonical session metadata lives in the `connections` DynamoDB table with **concentrated partition key**:

- **`ConnectionId`**: always `Meta::Session` (exported as `META_SESSION_PK` from [`packages/mtw-utilities/ts/dynamoDB/sessionMetaKeys.ts`](../../packages/mtw-utilities/ts/dynamoDB/sessionMetaKeys.ts)).
- **`DataCategory`**: `SESSION#${sessionId}` (use `sessionMetaSortKey(sessionId)` next to code that writes or reads the meta row).

Payload attributes on that item are unchanged (`connections`, `player`, `dropAfter`, etc.).

**Distinct from adjacency rows**: session-character edges stay under `ConnectionId='SESSION#${sessionId}'` with `DataCategory` character ids (`CHARACTER#...`). Only the **meta document** uses the concentrated PK above.

**Reads**: Prefer `getItem` / `optimisticUpdate` on the meta key with `ConsistentRead` where callers need an immediately consistent view. To **list** all active session meta rows, query the base table (`ConnectionId = Meta::Session`, `begins_with(DataCategory, 'SESSION#')`) with `ConsistentRead` when correctness-sensitive (see internal caches).

**Deploy / cutover**: Initiative decision D2 is clean-slate only. Before enabling a build that expects this shape, remove any legacy session-meta items that used the old orientation (`ConnectionId='SESSION#...'`, `DataCategory='Meta::Session'`). Rollback is revert the deploy and restore prior session behavior before reopening traffic.

**Deliberate trade-off**

- **Hot partitions**: Putting many session meta rows under one partition key increases write/read concentration on that partition compared to spreading each session across its own `SESSION#...` PK. That can surface as throttling or uneven utilization under extreme concurrent load.
- **Why we accept it**: Co-locating canonical session meta rows enables **primary-key reads with `ConsistentRead`** where correctness-sensitive paths need an immediately consistent view without relying on eventually consistent GSI queries.

This is an explicit engineering choice: **operational risk on one partition** in exchange for **predictable read semantics** on session meta. Mitigations are standard DynamoDB practice (capacity/burst behavior, observability on hot keys, rate shaping upstream), not a misunderstanding of partition limits.

When changing session storage, update this section so the trade-off stays visible to future contributors.
