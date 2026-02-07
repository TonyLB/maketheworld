# Client instrumentation – planning

**Temporary planning doc.** Used to lay out and prioritize instrumentation **patterns** and tools for the charcoal client. Once plans are implemented and reflected in `AGENT.testing.instrumentation.md`, this file can be archived or removed.

## Goal

Improve developer quality-of-life by enabling precise instrumentation of client behavior for debugging. Current ability to instrument the client is very limited, which hinders diagnosis of persistent front-end bugs. We are implementing **patterns** (reusable ways to add and control instrumentation) rather than one-off tools.

## Pattern: Scoped instrumentation via options threading

**Problem:** Foundational UI pieces (e.g. authoring workbench) use shared utilities like `useDebouncedValue` everywhere. Instrumenting such a hook indiscriminately produces a flood of logs; we need to turn on instrumentation only along a specific "thread" of the call tree (e.g. one workbench flow).

**Idea:** Thread an optional `options` argument through components and functions we want to be able to selectively instrument. The **first** property in that options object is `instrumentation?: string[]`. Each call that accepts options and receives them from its caller should pass the instrumentation list through, and may append a characteristic string for its own subtree. At instrumented sites (e.g. inside `useDebouncedValue`), we check whether a given activation string is in the list before emitting logs or traces.

**Concrete design:**

- Functions/components that participate accept an optional `options` argument, with `instrumentation?: string[]` as the first (or a designated) field.
- Callers that have an incoming `options` (e.g. from props or a parent) pass it on; they may extend `options.instrumentation` with a string that identifies their call path or feature (e.g. `'workbench-reference-list'`).
- At the root of the subtree we want to debug, we pass that characteristic string in `instrumentation` (e.g. `instrumentation: ['workbench-reference-list']`).
- Inside shared code (e.g. `useDebouncedValue`), we only run instrumentation (logging, traces) if the relevant key is present in `options?.instrumentation`.

That gives us named "channels" we can turn on per call tree without enabling instrumentation globally.

**Workflow:** Add threading only when you need it: you have a differentiation site high in the tree (where you pass the activation string) and an instrumentation site lower down; thread the `options` argument along the path between them, adding it only where it isn't already present. When you're done debugging, remove the differentiation (the place you pass the string) and the instrumentation (the logging/traces), but **keep the threading** (the optional `options` parameter and pass-through). The plumbing accumulates over time, so the next time you need to debug that path you only add activation + instrumentation at the right spots.

**Related concepts:** This is similar to *Mapped Diagnostic Context* (MDC) in logging frameworks and to *trace context* propagation in observability (e.g. OpenTelemetry): a bag of keys that flows down the call tree and is read at instrumented sites to decide what to emit.

## Pattern: Instrumentation rehydration for async request/response (lifeline)

**Problem:** Many flows send a message to the lifeline websocket and subscribe to the result; send and response are tied only by `RequestID`. We want to differentiate (turn on instrumentation) before the send and have instrumentation in the response handler (e.g. when resolving `pendingEdits` in the `personalAssets` slice). The response handler has no call-stack or options from the send side—only the RequestID.

**Alternatives:** We could pass instrumentation through the backend and thread it through the server process, but that's overengineering for current needs.

**Idea:** Cache instrumentation by RequestID on send; on incoming response, look up that RequestID in the cache to rehydrate the instrumentation tags, then run the usual "is this key in the list?" check at instrumented sites in the handler. No backend changes; everything stays client-side.

**Concrete design:**

- When sending a lifeline request that we may want to instrument, if we have an active `instrumentation` context (e.g. from options threading at the call site), store a copy keyed by the request's RequestID in a small global (or module-level) cache, e.g. `Map<RequestID, string[]>`.
- When handling the corresponding response (or subscription event), look up the RequestID in the cache. If present, use that instrumentation list for the duration of that handler (and any sync call tree it triggers); optionally delete the entry after use to avoid unbounded growth, or use a short TTL/cleanup.
- Response-handler instrumentation sites then check the rehydrated list instead of (or in addition to) options from the call tree.

**Workflow:** Same as options-threading: add the cache write at the send site when you need differentiation, add instrumentation in the response handler; when done debugging, remove differentiation and instrumentation but keep the cache plumbing (store on send, lookup on response) so it's ready next time.

## Other planned patterns / tools

*(Add more as we design them.)*

---

## Notes

- Keep instrumentation low-friction and easy to enable/disable.
- Prefer approaches that don’t require code changes in hot paths for routine debugging.
