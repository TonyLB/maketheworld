# `mtw.ephemera.narration`

**Status:** Shipped --- bus-only **`EphemeraDataSource`** (**`replayable: false`**, subscribe-only). Registered from [`../../app.ts`](../../app.ts) via **`import './dataSource/narration'`**.

## Role

Terminal, **non-correlated** character-voice depiction: **`SayMessage`**, **`NarrateMessage`**, **`OOCMessage`** room broadcasts via **`messageBus.publish`**. No state mutation, no fan-in, no outbound stream contracts.

| Layer | Owner |
| --- | --- |
| Intent (parse / assessed) | **`mtw.ephemera.actions`** |
| Terminal speech depiction | **`mtw.ephemera.narration`** (this package) |
| Correlated world copy (leave/arrive) | **`mtw.ephemera.perception`** membership fan-in |
| Async render depiction | **`mtw.ephemera.perception`** + render orchestration |

## Ingress

Subscribes to **`mtw.ephemera.actions`** **`Character Spoke`** ([`../actions/publishedEvents.ts`](../actions/publishedEvents.ts)). Emitted from [`../actions/index.ts`](../actions/index.ts) when **`Action Assessed`** carries **`CharacterSpoke`** (`source: uiSpeech`) or future typed-command speech outcomes. Envelope guards: [`subscribedEvents.ts`](subscribedEvents.ts). Handler: [`handleCharacterSpoke.ts`](handleCharacterSpoke.ts).

Trusted UI speech ingress: [`../routeTrustedUiAction.ts`](../routeTrustedUiAction.ts) -> **`sendActionAssessed`** -> actions **`streamEvent`** **`Character Spoke`**.

## Publish behavior

On **`Character Spoke`**:

1. Load **`CharacterMeta`** for **`characterId`**.
2. If **`RoomId`** present: **`PublishMessage`** to room with **`displayProtocol`**, **`message`**, **`characterId`**, **`name`**, **`color`**.

**ReturnValue** is owned by **`actions`** ingress (`publishReturnValueForRequest` when **`requestId`** is present on **`Action Assessed`**). Narration is depiction-only.

## Outbounds

None (placeholder **`Narration noop`** in [`publishedEvents.ts`](publishedEvents.ts) satisfies **`busOnly`** typing).

## Explicit non-goals

- Leave/arrive **`WorldMessage`** (perception fan-in).
- **`PerceptionMessage`** / render headers.
- Parse / Bedrock / command transcript.
- Owning position or room state.

## Related documentation

| Doc | Role |
| --- | --- |
| [`../actions/AGENT.md`](../actions/AGENT.md) | **`Character Spoke`** emission; **`ReturnValue`** at assessed tail |
| [`../perception/AGENT.md`](../perception/AGENT.md) | Correlated world copy (not speech) |
| [`../../AGENT.narrativeTranscript.concepts.md`](../../AGENT.narrativeTranscript.concepts.md) | Transcript **`CreatedTime`** semantics |
