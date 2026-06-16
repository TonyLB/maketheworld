# `mtw.ephemera.narration`

**Status:** Scaffold --- bus-only **`EphemeraDataSource`** (**`replayable: false`**, subscribe-only). Registered from [`../../app.ts`](../../app.ts) via **`import './dataSource/narration'`**.

## Role

Terminal, **non-correlated** character-voice depiction: **`SayMessage`**, **`NarrateMessage`**, **`OOCMessage`** room broadcasts via **`messageBus.publish`**. No state mutation, no fan-in, no outbound stream contracts.

| Layer | Owner |
| --- | --- |
| Intent (parse / assessed) | **`mtw.ephemera.actions`** (future emission) |
| Terminal speech depiction | **`mtw.ephemera.narration`** (this package) |
| Correlated world copy (leave/arrive) | **`mtw.ephemera.perception`** membership fan-in |
| Async render depiction | **`mtw.ephemera.perception`** + render orchestration |

## Ingress

Subscribes to **`mtw.ephemera.actions`** **`Character Spoke`** ([`../actions/publishedEvents.ts`](../actions/publishedEvents.ts)). Envelope guards: [`subscribedEvents.ts`](subscribedEvents.ts). Handler: [`handleCharacterSpoke.ts`](handleCharacterSpoke.ts).

**Contract only today:** [`actions/index.ts`](../actions/index.ts) does **not** emit **`Character Spoke`** yet; legacy UI speech still flows through [`../../parse/executeAction.ts`](../../parse/executeAction.ts).

## Publish behavior

On **`Character Spoke`**:

1. Load **`CharacterMeta`** for **`characterId`**.
2. If **`RoomId`** present: **`PublishMessage`** to room with **`displayProtocol`**, **`message`**, **`characterId`**, **`name`**, **`color`**.
3. If **`requestId`** on payload: correlated **`ReturnValue`** **`Success`** with **`message: 'character_spoke_handled'`**.

**ReturnValue delta vs legacy `executeAction`:** narration emits **`ReturnValue`** only when **`requestId`** is set. Legacy speech always publishes **`ReturnValue`** **`Success`** without **`RequestId`**. Follow-up wiring should align policy.

## Outbounds

None (placeholder **`Narration noop`** in [`publishedEvents.ts`](publishedEvents.ts) satisfies **`busOnly`** typing).

## Explicit non-goals

- Leave/arrive **`WorldMessage`** (perception fan-in).
- **`PerceptionMessage`** / render headers.
- Parse / Bedrock / command transcript.
- Owning position or room state.

## Future wiring (follow-up)

1. **`actions` emission:** **`SpeechIntent`** / **`Action Assessed`** speech outcome -> **`streamEvent`** **`Character Spoke`** from [`actions/index.ts`](../actions/index.ts).
2. **UI ingress:** trusted speech routing; remove [`executeAction`](../../parse/executeAction.ts) speech + **`ExecuteAction`** bus hop.
3. **ReturnValue policy:** align UI speech ack with or without **`RequestId`**.

## Related documentation

| Doc | Role |
| --- | --- |
| [`../actions/AGENT.md`](../actions/AGENT.md) | **`Character Spoke`** outbound contract |
| [`../perception/AGENT.md`](../perception/AGENT.md) | Correlated world copy (not speech) |
| [`../../AGENT.narrativeTranscript.concepts.md`](../../AGENT.narrativeTranscript.concepts.md) | Transcript **`CreatedTime`** semantics |
