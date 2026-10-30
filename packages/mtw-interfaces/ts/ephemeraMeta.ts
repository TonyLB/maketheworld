import { checkTypes } from './utils'
import {
    isEphemeraRoomId,
    type EphemeraRoomId,
    isEphemeraCharacterId,
    type EphemeraCharacterId,
    isEphemeraObjectId,
    type EphemeraObjectId,
    isEphemeraFeatureId,
    type EphemeraFeatureId,
    isEphemeraAreaId,
    type EphemeraAreaId,
    isEphemeraPresenceNodeId,
    type EphemeraPresenceNodeId,
} from './baseClasses'
import { areCoyoteObjectTropeFieldsValid, type CoyoteTropeAffinity } from './coyotePlanAffinities'
import {
    isEphemeraMembershipHostId,
    type EphemeraMembershipHostId,
} from './ephemeraPositionAdjacency'

//
// Shared types for Ephemera-table metadata records (ephemeraDB).
//
// Note: This is intentionally distinct from assetDB's `Meta::Room` records (which are used
// for cross-asset indexing, e.g. the `cached` asset list).
//

//
// Render-cache Mark state (shared with state system + preview + cache records)
//

export type EphemeraCacheMarkValue = {
    mark: string;
    value: string;
}

export type EphemeraCacheMarkState = {
    markValue: EphemeraCacheMarkValue[];
}

export type EphemeraPerspectiveKey = string
export type EphemeraCacheId = `CACHE#${string}`

export const isEphemeraCacheMarkState = (value: any): value is EphemeraCacheMarkState => {
    if (!value || typeof value !== 'object' || !Array.isArray(value.markValue)) {
        return false
    }
    return value.markValue.every((entry: any) => (
        entry
        && typeof entry === 'object'
        && typeof entry.mark === 'string'
        && typeof entry.value === 'string'
    ))
}

//
// Ephemera-table `Meta::Room` record (ephemeraDB)
//

export type EphemeraRoomState = {
    marks: EphemeraCacheMarkState;
    situationId?: string;
}

export type EphemeraRoomActiveCharacter = {
    EphemeraId: EphemeraCharacterId;
    DisplayName?: string;
    Name?: string;
    Color?: string;
    fileURL?: string;
    ConnectionIds?: string[];
    SessionIds?: string[];
    sessions?: string[];
}

/** Objects Change ingress add-row / affordance wire compose shape (not persisted on Meta::Room).
 *  At persist: shortName -> improvisation pair; stableKey + trope fields -> Meta::Object. */
export type EphemeraMetaRoomObject = {
    uuid: EphemeraObjectId;
    shortName: string;
    /** Coyote-wide machine correlation key (`a-z` / `0-9` / `-`). */
    stableKey: string;
    /** Canonical trope-centered possibilities for Coyote planning (1-3 entries; six tropes incl. Scene Dressing). */
    tropeAffinities?: CoyoteTropeAffinity[];
    /** True when trope affinities were unavailable from enrich processing. */
    tropeAffinitiesFailed?: boolean;
}

export const isEphemeraMetaRoomObject = (entry: unknown): entry is EphemeraMetaRoomObject => {
    if (
        typeof entry !== 'object'
        || entry === null
        || !('uuid' in entry)
        || !('shortName' in entry)
        || typeof (entry as EphemeraMetaRoomObject).shortName !== 'string'
        || !isEphemeraObjectId((entry as EphemeraMetaRoomObject).uuid)
    ) {
        return false
    }
    const o = entry as Record<string, unknown>
    if (!areCoyoteObjectTropeFieldsValid(o)) {
        return false
    }
    if (typeof o.stableKey !== 'string' || o.stableKey.trim().length === 0) {
        return false
    }
    return true
}

//
// First-class improvisational objects (shipped steady state)
//
// ADR: three-way split mirrors Character --- merge body on component pair row,
// play meta on Meta::Object, placement on ludicGraph + POSITION#ROOM adjacency.
// Optional fourth adjacency row (EMBEDDING#IMPROMPTU): see ephemeraEmbedding.ts.
//
// - One component pair row (OBJECT#, ASSET#...) + one (OBJECT#, Meta::Object) per spawned object.
//   v1 writes use ASSET#IMPROVISATION as DataCategory; type does not hard-code that layer.
// - shortName lives only on the pair row (StandardObject JSON), alongside an optional
//   SITUATION#DEFAULT situations facet (Acme-generated flavor-text prose at spawn,
//   lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts); never on Meta::Object.
// - stableKey / trope fields live only on EphemeraMetaObject.
// - Spawn/clear coordinators write or delete both rows in one transact.
//
// Pair merge-body shape: ComponentPairPersistedFields / EphemeraDbGetItemsComponentRow in
// @tonylb/mtw-gateways/ts/assets/components/componentData/fetch.ts (not duplicated here).
//

/** ephemeraDB play meta for OBJECT#; does not participate in asset-stack merge (I2). */
export type EphemeraMetaObject = {
    EphemeraId: EphemeraObjectId;
    DataCategory: 'Meta::Object';
    /** Coyote-wide machine correlation key (`a-z` / `0-9` / `-`). */
    stableKey: string;
    tropeAffinities?: CoyoteTropeAffinity[];
    tropeAffinitiesFailed?: boolean;

    //
    // Object-hosted play membership graph (MK2). Same EphemeraLudicGraphFieldPayload shape as
    // Meta::Room/Meta::Character; no fallback source when absent (MD-1(c)).
    //
    ludicGraph?: EphemeraLudicGraphFieldPayload;
}

export const isEphemeraMetaObject = (entry: unknown): entry is EphemeraMetaObject => {
    if (typeof entry !== 'object' || entry === null) {
        return false
    }
    const o = entry as Record<string, unknown>
    if (typeof o.EphemeraId !== 'string' || !isEphemeraObjectId(o.EphemeraId) || o.DataCategory !== 'Meta::Object') {
        return false
    }
    if (!areCoyoteObjectTropeFieldsValid(o)) {
        return false
    }
    if (typeof o.stableKey !== 'string' || o.stableKey.trim().length === 0) {
        return false
    }
    if ('shortName' in o || 'uuid' in o) {
        return false
    }
    if ('ludicGraph' in o && !isEphemeraLudicGraphFieldPayload(o.ludicGraph)) {
        return false
    }
    return true
}

/**
 * ephemeraDB play meta for FEATURE#. No pre-existing `Meta::Feature` record of any kind exists
 * yet (checked before MK3 --- only forward-looking "out of scope" mentions in dataSource/state
 * and renderOrchestration docs), so unlike `EphemeraMetaObject` this carries no non-ludicGraph
 * fields: MD-1(c)'s plain shape, same as Character.
 */
export type EphemeraMetaFeature = {
    EphemeraId: EphemeraFeatureId;
    DataCategory: 'Meta::Feature';

    //
    // Feature-hosted play membership graph (MK3). Same EphemeraLudicGraphFieldPayload shape as
    // Meta::Room/Meta::Character/Meta::Object; no fallback source when absent (MD-1(c)).
    //
    ludicGraph?: EphemeraLudicGraphFieldPayload;
}

export const isEphemeraMetaFeature = (entry: unknown): entry is EphemeraMetaFeature => {
    if (typeof entry !== 'object' || entry === null) {
        return false
    }
    const f = entry as Record<string, unknown>
    if (typeof f.EphemeraId !== 'string' || !isEphemeraFeatureId(f.EphemeraId) || f.DataCategory !== 'Meta::Feature') {
        return false
    }
    if ('ludicGraph' in f && !isEphemeraLudicGraphFieldPayload(f.ludicGraph)) {
        return false
    }
    return true
}

/**
 * ephemeraDB play meta for AREA#. No pre-existing `Meta::Area` record of any kind exists yet
 * (checked before MK4, same as MK3's Feature finding), so this carries no non-ludicGraph fields:
 * MD-1(c)'s plain shape, same as Character/Object/Feature.
 */
export type EphemeraMetaArea = {
    EphemeraId: EphemeraAreaId;
    DataCategory: 'Meta::Area';

    //
    // Area-hosted play membership graph (MK4). Same EphemeraLudicGraphFieldPayload shape as
    // Meta::Room/Meta::Character/Meta::Object/Meta::Feature; no fallback source when absent (MD-1(c)).
    //
    ludicGraph?: EphemeraLudicGraphFieldPayload;
}

export const isEphemeraMetaArea = (entry: unknown): entry is EphemeraMetaArea => {
    if (typeof entry !== 'object' || entry === null) {
        return false
    }
    const a = entry as Record<string, unknown>
    if (typeof a.EphemeraId !== 'string' || !isEphemeraAreaId(a.EphemeraId) || a.DataCategory !== 'Meta::Area') {
        return false
    }
    if ('ludicGraph' in a && !isEphemeraLudicGraphFieldPayload(a.ludicGraph)) {
        return false
    }
    return true
}

//
// Ludic graph edge/port terminals. A terminal is one of five named kinds (the fifth, an edge named
// by `edgeId`, is defined below `EphemeraLudicOwnedTerminal`; it has no owner):
//   - a component (`EphemeraMembershipHostId`, bare) and an own binding (`EphemeraPresenceNodeId`,
//     bare: a binding named from inside its own graph) --- together `EphemeraLudicNodeTerminal`;
//   - a crossing port address and a binding address (`{ owner, port }`: a slot named through its
//     owner) --- together `EphemeraLudicPortAddress`.
// Each kind has its own guard below. Representation tests (`typeof`, `'owner' in`, a
// `PRESENCE#`/`PORT-` prefix test) live only inside these guards: every other site asks for a kind
// by name and narrows without casts. The parsed shape IS the stored shape --- no string form, no
// separator parsing, in the domain layer (PQ-9, in the abstraction-layers proposals plan). The
// serde/Dynamo string boundary is deferred to a later slice, gated on a port address needing
// to stand free of an edge.
//

/** A terminal that names a node directly: a component (`EphemeraMembershipHostId`) or an own
 * binding (`EphemeraPresenceNodeId`, a binding named from inside its own graph). The other arm,
 * `EphemeraLudicPortAddress`, names a slot through its owner. Tell the two kinds of node apart
 * with `isEphemeraMembershipHostId` / `isEphemeraPresenceNodeId` once this guard has narrowed. */
export type EphemeraLudicNodeTerminal =
    | EphemeraRoomId | EphemeraCharacterId
    | EphemeraObjectId | EphemeraFeatureId | EphemeraAreaId
    | EphemeraPresenceNodeId

export const isEphemeraLudicNodeTerminal = (value: unknown): value is EphemeraLudicNodeTerminal =>
    typeof value === 'string' && (
        isEphemeraRoomId(value) || isEphemeraCharacterId(value) ||
        isEphemeraObjectId(value) || isEphemeraFeatureId(value) || isEphemeraAreaId(value) ||
        isEphemeraPresenceNodeId(value)
    )

/** owner is the whole that ALLOCATED this port --- deliberately not named `host`, which already
 * means two other things in this file (a graph's owner, and a port's exterior `fromHostId`). A
 * presence node never allocates a port (that would reintroduce the port-based mechanism the
 * presenceNodes plan retires), so `owner` stays over the pre-widening domain (PN-4): only a
 * bare terminal --- `EphemeraLudicNodeTerminal` --- may itself resolve to a presence node.
 *
 * **`port`'s prefix says what kind of thing it names (presenceNodes PN-24).** A crossing port
 * carries an `EphemeraCrossingPortId`, backed by a record in `graph.ports`. A presence binding's
 * **exterior address** carries `PRESENCE#{uuid}` --- the binding's own node id --- and is backed by a record in
 * `graph.presenceNodes`, never in `ports`. The two are the kinds `EphemeraLudicCrossingPortAddress`
 * and `EphemeraLudicBindingAddress`; tell them apart with their guards.
 *
 * **Why the tag is on the value rather than on a record:** it used to be on the record. A presence
 * binding was a port with `kind: 'Present'`, so one lookup in `graph.ports` answered both *what
 * kind is this* and *does it exist*. Slice 7a deleted that record, leaving two disjoint
 * collections and nothing on the terminal to say which one to read --- so resolution degraded to
 * searching both in order, and a miss could not distinguish an absent presence binding (legal ---
 * the binding was not pulled into this cut) from a dangling crossing port (corruption). Tagging
 * the value restores the discriminator the record used to carry, and keeps the two questions
 * separate: the tag says where to look, the lookup still confirms existence. */
export type EphemeraLudicPortAddress = EphemeraLudicCrossingPortAddress | EphemeraLudicBindingAddress

export const isEphemeraLudicPortAddress = (value: unknown): value is EphemeraLudicPortAddress =>
    isEphemeraLudicCrossingPortAddress(value) || isEphemeraLudicBindingAddress(value)

/** A crossing port's id: `PORT-${uuid}` when minted for a chain (`buildCrossingLegs.ts`), or
 * `STUB-...` when minted for a same-host straddle (`presenceSubGraph.ts`). The prefix keeps it
 * disjoint from a binding's `PRESENCE#` id, as a type and at runtime (`positions/AGENT.contract.md`). */
export type EphemeraCrossingPortId = `PORT-${string}` | `STUB-${string}`

/** Total over the port-id domain, like `isPresenceTaggedPortId`. */
export const isEphemeraCrossingPortId = (portId: string): portId is EphemeraCrossingPortId =>
    portId.startsWith('PORT-') || portId.startsWith('STUB-')

/** A crossing port: a slot in `graph.ports` that a leg crosses. Its `EphemeraCrossingPortId`
 * makes it disjoint from `EphemeraLudicBindingAddress`, so a failed check for either kind narrows
 * to the other. */
export type EphemeraLudicCrossingPortAddress = {
    owner: EphemeraMembershipHostId;
    port: EphemeraCrossingPortId;
}

/** A binding named from outside its own graph: the owner's `PRESENCE#` node, backed by a record in
 * the owner's `graph.presenceNodes`. Equal to the own binding with the same id (see
 * `ephemeraLudicTerminalsEqual`). */
export type EphemeraLudicBindingAddress = {
    owner: EphemeraMembershipHostId;
    port: EphemeraPresenceNodeId;
}

const hasPortAddressShape = (value: unknown): value is { owner: EphemeraMembershipHostId; port: string } => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const address = value as Record<string, unknown>
    return typeof address.owner === 'string' && isEphemeraMembershipHostId(address.owner) && typeof address.port === 'string'
}

export const isEphemeraLudicCrossingPortAddress = (value: unknown): value is EphemeraLudicCrossingPortAddress =>
    hasPortAddressShape(value) && isEphemeraCrossingPortId(value.port)

export const isEphemeraLudicBindingAddress = (value: unknown): value is EphemeraLudicBindingAddress =>
    hasPortAddressShape(value) && isPresenceTaggedPortId(value.port)

/** Whether a port id carries the presence tag --- i.e. whether this address names a binding in
 * `graph.presenceNodes` rather than a crossing port in `graph.ports` (PN-24).
 *
 * **Use this rather than `isEphemeraPresenceNodeId` on a port id.** That guard is built for the
 * EphemeraId domain and THROWS (`Illegal nested EphemeraId`) on any value containing more than one
 * `#`. Port ids are not EphemeraIds --- `EphemeraCrossingPort.portId` is an
 * `EphemeraCrossingPortId` --- and a minted stub id embeds component ids, e.g.
 * `STUB-["OBJECT#C","OBJECT#D","On",""]`, so an EphemeraId guard is a category error here that
 * throws on ordinary same-host traffic. This predicate is total over the port-id domain. */
export const isPresenceTaggedPortId = (portId: string): portId is EphemeraPresenceNodeId =>
    portId.startsWith('PRESENCE#')

/** A terminal with an owning component: a component, an own binding, or a port address. The
 * edge kind (`EphemeraLudicEdgeTerminal`) is not one, so readers that need an
 * owner take this type rather than `EphemeraLudicTerminalId`, and the compiler finds the callers
 * that must state an edge case. */
export type EphemeraLudicOwnedTerminal =
    | EphemeraLudicNodeTerminal
    | EphemeraLudicPortAddress

export const isEphemeraLudicOwnedTerminal = (value: unknown): value is EphemeraLudicOwnedTerminal =>
    isEphemeraLudicNodeTerminal(value) || isEphemeraLudicPortAddress(value)

/** The fifth terminal kind: another edge in the same graph, named by its `edgeId` (the
 * relationship, not a route or leg of it). It has no owning component, so it is not an
 * `EphemeraLudicOwnedTerminal`. Only a `Justifies` edge carries it, **as v1 policy** (see the
 * guard in `isEphemeraLudicRelationalEdgeData`): the kind of terminal is a settled shape, the
 * restriction on who may carry it and on both ends being edges is not. */
export type EphemeraLudicEdgeTerminal = { edgeId: string }

export const isEphemeraLudicEdgeTerminal = (value: unknown): value is EphemeraLudicEdgeTerminal => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }
    const keys = Object.keys(value)
    const { edgeId } = value as { edgeId?: unknown }
    return keys.length === 1 && keys[0] === 'edgeId' && typeof edgeId === 'string' && edgeId.length > 0
}

export type EphemeraLudicTerminalId = EphemeraLudicOwnedTerminal | EphemeraLudicEdgeTerminal

export const isEphemeraLudicTerminalId = (value: unknown): value is EphemeraLudicTerminalId =>
    isEphemeraLudicNodeTerminal(value) || isEphemeraLudicPortAddress(value) || isEphemeraLudicEdgeTerminal(value)

/** A string identifying a terminal: the id itself for a component, `owner#port` for a port address,
 * `edge:<edgeId>` for an edge. Stub port ids and edge identity hashes are built from it, so the
 * output for the first two is persisted-compatible. */
export const ephemeraLudicTerminalKey = (terminal: EphemeraLudicTerminalId): string => {
    if (isEphemeraLudicEdgeTerminal(terminal)) {
        return `edge:${terminal.edgeId}`
    }
    return isEphemeraLudicNodeTerminal(terminal) ? terminal : `${terminal.owner}#${terminal.port}`
}

/** The type of a graph's `rootId`. The edge arm is excluded from it,
 * because a root is always a component or a port on one. */
export type EphemeraLudicRootId = EphemeraLudicOwnedTerminal

/** The base component a terminal names --- itself if unqualified, `.owner` if port-qualified.
 * Overloaded so a call site already narrowed to a port address (which can only ever name a real
 * component, PN-4) gets `EphemeraMembershipHostId` back rather than the wider terminal-primitive
 * type a bare terminal could resolve to. */
export function ephemeraLudicTerminalOwner(terminal: EphemeraLudicPortAddress): EphemeraMembershipHostId
export function ephemeraLudicTerminalOwner(terminal: EphemeraLudicOwnedTerminal): EphemeraLudicNodeTerminal
export function ephemeraLudicTerminalOwner(terminal: EphemeraLudicOwnedTerminal): EphemeraLudicNodeTerminal {
    return isEphemeraLudicNodeTerminal(terminal) ? terminal : terminal.owner
}

/** The one cross-kind equality: an own binding and a binding address with the same id. The
 * address's owner is ignored unless `bareOwner` is given. */
const ownBindingMatchesAddress = (node: EphemeraLudicNodeTerminal, address: EphemeraLudicPortAddress, bareOwner?: string): boolean =>
    isEphemeraPresenceNodeId(node) && isEphemeraLudicBindingAddress(address) && node === address.port
        && (bareOwner === undefined || address.owner === bareOwner)

/** Full terminal equality, by kind. Two terminals of the same kind are equal when their fields
 * are. An own binding equals a binding address naming the same binding (clause 1's exterior
 * address form), and no other pair of kinds is ever equal --- so a component never equals a port
 * address on itself.
 *
 * **Fixed ids are not unique** (contract, *Base and Unplaced*): every host holds a `PRESENCE#Base`,
 * so a bare presence id names a binding only on the graph it sits in. A caller comparing terminals of
 * one graph passes that graph's host as `bareOwner`, and the cross-kind case then also requires the
 * address to be owned by it. Omitted, the owner is ignored, which is sound only for ids that are
 * still unique (PN-5's `PRESENCE#{uuid}`). */
export const ephemeraLudicTerminalsEqual = (a: EphemeraLudicTerminalId, b: EphemeraLudicTerminalId, bareOwner?: string): boolean => {
    if (isEphemeraLudicEdgeTerminal(a) || isEphemeraLudicEdgeTerminal(b)) {
        return isEphemeraLudicEdgeTerminal(a) && isEphemeraLudicEdgeTerminal(b) && a.edgeId === b.edgeId
    }
    if (isEphemeraLudicNodeTerminal(a)) {
        return isEphemeraLudicNodeTerminal(b) ? a === b : ownBindingMatchesAddress(a, b, bareOwner)
    }
    if (isEphemeraLudicNodeTerminal(b)) {
        return ownBindingMatchesAddress(b, a, bareOwner)
    }
    return a.owner === b.owner && a.port === b.port
}

/**
 * Whether two relational edges have the same endpoints. `ConnectedTo` is symmetric (`A -ConnectedTo- B`
 * is `B -ConnectedTo- A`), so for that kind either order agrees; every other kind is directional
 * and agrees only straight. Order-insensitive comparison rather than a canonical order fixed at
 * write time, so no reader has to know a canonical order exists. Does not compare kinds: callers
 * test `kind` first.
 */
export const ephemeraEdgeEndpointsEqual = (
    a: { from: EphemeraLudicTerminalId; to: EphemeraLudicTerminalId; kind: string },
    b: { from: EphemeraLudicTerminalId; to: EphemeraLudicTerminalId },
    bareOwner?: string
): boolean => (
    (ephemeraLudicTerminalsEqual(a.from, b.from, bareOwner) && ephemeraLudicTerminalsEqual(a.to, b.to, bareOwner))
    || (a.kind === 'ConnectedTo' && ephemeraLudicTerminalsEqual(a.from, b.to, bareOwner) && ephemeraLudicTerminalsEqual(a.to, b.from, bareOwner))
)

/** True when a terminal (qualified or not) resolves to the given component id. An edge terminal
 * names no component, so it refers to none. */
export const ephemeraLudicTerminalRefersTo = (terminal: EphemeraLudicTerminalId, id: EphemeraLudicNodeTerminal): boolean =>
    !isEphemeraLudicEdgeTerminal(terminal) && ephemeraLudicTerminalOwner(terminal) === id

/**
 * Slice 2 v1 shipped Character nodes; Phase 4 shipped Object nodes; CC0b shipped Room nodes
 * (nodes only); a later widening took it to the full terminal-kind set (Feature, Area), closing
 * a referential-integrity gap: terminal kinds already admitted Feature/Area and this union did
 * not, so a terminal could name no backing node.
 *
 * Widening this union is not a part-of-ladder claim: adding a tag here says a kind may appear
 * in a graph's node list, not that it belongs above the room in the containment ladder --- see
 * AGENT.concepts.md's premise-11 warning (the same guard already written on
 * EphemeraPositionAdjacencyContainedId).
 */
export type EphemeraLudicGraphComponentNodeBase =
    | {
        tag: 'Character';
        universalKey: EphemeraCharacterId;
    }
    | {
        tag: 'Object';
        universalKey: EphemeraObjectId;
    }
    | {
        tag: 'Room';
        universalKey: EphemeraRoomId;
    }
    | {
        tag: 'Feature';
        universalKey: EphemeraFeatureId;
    }
    | {
        tag: 'Area';
        universalKey: EphemeraAreaId;
    }

/**
 * A member's hosting kind: how this node sits in the host whose
 * graph holds it. *Placement* kinds (`On`, `In`, `Held`) say where a distinct thing sits relative
 * to its host; *composition* kinds (`PartOf`, `SectionOf`) say a distinct part, or a fungible
 * stretch, of the host read as an abstraction. It is a node field, set by the
 * `setHostingKind` kernel step; no relation instruction or stored edge carries one.
 */
export const HOSTING_KINDS = ['On', 'In', 'Held', 'PartOf', 'SectionOf'] as const
export type EphemeraHostingKind = typeof HOSTING_KINDS[number]
export const isEphemeraHostingKind = (value: unknown): value is EphemeraHostingKind =>
    typeof value === 'string' && (HOSTING_KINDS as readonly string[]).includes(value)

export type EphemeraHostingFamily = 'placement' | 'composition'

/** Total over the five kinds: consumers that care about the distinction read the family, never a list of kinds. */
export const hostingFamily = (kind: EphemeraHostingKind): EphemeraHostingFamily => {
    switch (kind) {
        case 'On':
        case 'In':
        case 'Held':
            return 'placement'
        case 'PartOf':
        case 'SectionOf':
            return 'composition'
        default: {
            const unmapped: never = kind
            throw new Error(`hostingFamily: unmapped hosting kind ${String(unmapped)}`)
        }
    }
}

/**
 * Per-host legality. A node cannot know its host, so this takes the host's tag: `Held` only
 * on a character host; `In`, `PartOf` and `SectionOf` never on one (`On` on a character is worn,
 * or a coating); `On` anywhere.
 */
export const isHostingKindLegalOnHost = (kind: EphemeraHostingKind, hostTag: EphemeraLudicGraphComponentNodeBase['tag']): boolean => {
    if (hostTag === 'Character') {
        return kind === 'On' || kind === 'Held'
    }
    return kind !== 'Held'
}

/**
 * Every non-root component member node carries `hostingKind`. The type leaves it optional
 * because it cannot name "non-root"; the payload guard and the container require it on members and
 * refuse it on the root node and on presence nodes.
 */
export type EphemeraLudicGraphComponentNode = EphemeraLudicGraphComponentNodeBase & {
    hostingKind?: EphemeraHostingKind;
}

/**
 * One covered binding: a `{ host, presence }` pair, not a bare component id (PN-20, decided
 * 2026-09-17). `host` is the covered component's own id; `presence` names *which* of that
 * component's own presence bindings this cover entry means. A bare `host` cannot say that --
 * PN-20's deciding case is a component hosted twice by the same parent (two structurally-equal
 * bindings both naming the same child, whose own two bindings both name the same parent), where
 * `host` alone leaves *which nested binding pairs with which* unstated. `presence` is not
 * redundant with `host`: in a `ludicGraph` it is what keeps the referent local (the covered
 * component is already a node in this presence node's own host graph), where a bare
 * `PRESENCE#{uuid}` would reach into the covered component's own shard.
 */
export type EphemeraPresenceCoverEntry = {
    host: EphemeraLudicGraphComponentNode['universalKey'];
    presence: EphemeraPresenceNodeId;
}

/**
 * A presence binding's extent: an ordered list of explicit entries, never a complement. Every
 * component node of a host is listed by at least one of its bindings (the coverage invariant), so
 * a cover means the same thing whatever its siblings hold. A room's binding into an Area is the
 * carve-out with no members at all.
 */
export type EphemeraPresenceCover = {
    members: EphemeraPresenceCoverEntry[];
}

/**
 * The fixed ids of a host's root bindings (contract, *Base and Unplaced*). Base always exists and takes every
 * context-free add; Unplaced is optional and never has a parent,
 * exists only while it covers something, and holds contents that fell out of every placed binding. Each is unique per host (never across hosts), so a reference to either is
 * host-qualified.
 */
export const BASE_PRESENCE_ID = 'PRESENCE#Base' as EphemeraPresenceNodeId
export const UNPLACED_PRESENCE_ID = 'PRESENCE#Unplaced' as EphemeraPresenceNodeId

/**
 * A presence node (presenceNodes plan / PN-5, 2026-09-15): the reified boundary site that used
 * to be carried as a presence *port*. Unlike the five component arms above, its `universalKey`
 * is a minted `PRESENCE#{uuid}`, not a real component id, and it carries a parent pointer which
 * no component arm has a field for. `kind: 'Present'` is not carried here; `tag: 'Presence'` is
 * already the discriminant, and a second constant field would be a discriminant with no second
 * value.
 *
 * `fromHostPresences` (PR-21, PR-25) is the SET of parent BINDINGS: in each pointer, `host` is the
 * shard to read (one Dynamo read), `presence` is which of that host's bindings this one sits
 * under. The child's pointers govern; each parent's cover is a stored index of them. Empty means a
 * hostless remainder (a room, an unplaced or offline host).
 */
export type EphemeraPresenceParentPointer = {
    host: EphemeraMembershipHostId;
    /** The parent binding this one sits under. Required: a pointer that names only a host is not a stored shape. */
    presence: EphemeraPresenceNodeId;
}

export type EphemeraLudicGraphStructureNode = {
    tag: 'Presence';
    universalKey: EphemeraPresenceNodeId;
    fromHostPresences: EphemeraPresenceParentPointer[];
    cover: EphemeraPresenceCover;
}

/**
 * The union of every kind a `ludicGraph` node list may hold. Partitioned (PN-5) rather than a
 * flat six-arm union, so that call sites which mean "one of the five real components" (e.g.
 * `factory.ts`'s mint-time tag parameters) can say `EphemeraLudicGraphComponentNode['tag']` and
 * have the compiler refuse a structure tag, instead of silently widening alongside this union.
 */
export type EphemeraLudicGraphNode = EphemeraLudicGraphComponentNode | EphemeraLudicGraphStructureNode

/**
 * The kinds a **stored** relational edge or crossing port may carry:
 * the peer and topology kinds only. A member's hosting kind is a field of its node
 * (`EphemeraHostingKind`), never an edge, so none is representable here. One named union, so a
 * later closed peer kind adds a member rather than reopening every site.
 */
export type HostRelationalEdgeKind =
    | 'Custom'                                  // peer kind (AB-54): a label says which relation
    | 'SecuredTo'                               // closed peer kind, no label (directional: subject secured to object); same graph, single leg
    | 'ConnectedTo'                             // topology within ONE whole (symmetric); never decides shard placement
    | 'Justifies'                               // support between two edges of one graph (directional); the only kind whose terminals are edges
export const STORED_RELATIONAL_EDGE_KINDS: ReadonlySet<string> = new Set<HostRelationalEdgeKind>(['Custom', 'SecuredTo', 'ConnectedTo', 'Justifies'])

// `'Present'` retired from this union at presenceNodes Slice 3 (PN-14, decided 2026-09-16: removal
// here with the edge sense, not deferred to Slice 7 with the port sense). No `Present`-kind edge
// was ever constructed by any writer -- the migration moves bucket membership onto `cover`
// instead. The port sense (`EphemeraPresencePortKind`) survived independently until presenceNodes
// Slice 7a, when the presence PORT retired outright (PN-14/PN-23) -- there is no port-kind
// counterpart left to distinguish this removal from.

/**
 * The kind/label pairing, as a discriminated union rather than a flat optional field:
 * **`relationLabel` is what `Custom` exists to make a place for**, and the other six kinds
 * carry no free-text label at all. Stated in the type because it was previously stated only
 * at runtime, in five separate places across four layers, and enforced one-way --- `Custom`
 * required a label, but nothing stopped an `On` edge carrying one.
 *
 * Generic over the kind union so the lanes that already narrowed theirs can reuse it:
 * `PeerRelationalEdgeKind` (ingress) and `HostRelationalEdgeKindPublished` (wire) both
 * instantiate it rather than re-deriving the pairing.
 *
 * Use this form (`kind`) for edge records; use `RelationalKindAndLabel` (`relationKind`) for
 * the DTO lane, which names the same field differently.
 */
export type RelationalEdgeKindAndLabel<K extends string = HostRelationalEdgeKind> =
    | { kind: Exclude<K, 'Custom'> }
    | { kind: 'Custom'; relationLabel: string }

/** `RelationalEdgeKindAndLabel` for the lane that spells the field `relationKind`. */
export type RelationalKindAndLabel<K extends string = HostRelationalEdgeKind> =
    | { relationKind: Exclude<K, 'Custom'> }
    | { relationKind: 'Custom'; relationLabel: string }

/**
 * Project an edge's kind/label pair onto the DTO lane's `relationKind` spelling, for the several
 * call sites that build a relational step or fact out of a stored edge. Takes the fragment rather
 * than any one edge type, so it serves both `HostRelationalEdge` mirrors structurally.
 */
export const relationKindAndLabelOf = (edge: RelationalEdgeKindAndLabel): RelationalKindAndLabel => (
    edge.kind === 'Custom'
        ? { relationKind: 'Custom', relationLabel: edge.relationLabel }
        : { relationKind: edge.kind }
)

/**
 * Re-narrow the kind/label pair when copying it from one DTO onto another. The pair travels
 * together through parse -> plan -> execute -> publish, and spreading it as a unit is what keeps
 * each hop from having to restate the `Custom` branch. Replaces the
 * `relationKind: x.relationKind, ...(x.relationLabel !== undefined ? { relationLabel: ... } : {})`
 * shape that the flat field required at every one of those hops.
 */
export const relationKindAndLabelFrom = (source: RelationalKindAndLabel): RelationalKindAndLabel => (
    source.relationKind === 'Custom'
        ? { relationKind: 'Custom', relationLabel: source.relationLabel }
        : { relationKind: source.relationKind }
)

/** The inverse of `relationKindAndLabelOf`: DTO spelling in, edge spelling out. */
export const edgeKindAndLabelFrom = (source: RelationalKindAndLabel): RelationalEdgeKindAndLabel => {
    if (source.relationKind === 'Custom') {
        return { kind: 'Custom', relationLabel: source.relationLabel }
    }
    return { kind: source.relationKind }
}

/** Re-narrow an edge's own kind/label pair, for copying one edge shape onto another. */
export const edgeKindAndLabelOf = (edge: RelationalEdgeKindAndLabel): RelationalEdgeKindAndLabel => (
    edge.kind === 'Custom'
        ? { kind: 'Custom', relationLabel: edge.relationLabel }
        : { kind: edge.kind }
)

/**
 * `from`/`to` are `EphemeraLudicTerminalId` --- any legal host-kind component or a
 * port-qualified reference on one, matching the terminals the type union above already admits.
 *
 * `edgeId` is **an optional label an edge may carry, and nothing more** (EA-8). The one
 * constructor, `EphemeraLudicGraph.assignEdgeId`, puts a caller-minted id on a single-leg edge
 * in one graph (no Edge record, no reverse index), and no comparison consults one ---
 * `edgesMatch` is still purely structural, so a
 * mixed population of id-bearing and id-less edges behaves today exactly as an all-id-less one
 * does. It is a bare `string`, deliberately *not* a new arm of `EphemeraId`: whether an edge may
 * stand where a *terminal* stands is a separate question (EA-10), and a port-style record layered
 * over this id is how it would be answered.
 *
 * `chainId` is **the leg's statement of which chain it belongs to**, and unlike `edgeId` it is
 * consulted: `edgesMatch` compares it ahead of structure (P8 iteration 1, a **Prototype** ---
 * see that proposal's Status for the classification, the `P8-i1-dependent` tag and the rollback
 * trigger). Identity and reference adhere to the *chain*; hosting, adjacency and the mutation
 * site adhere to the *leg*, which is why the field naming the chain sits on every leg of it.
 * Two legs of one chain therefore share a `chainId` legitimately --- they have different
 * endpoints, so structure still tells them apart, and that is what a chain crossing a boundary
 * looks like from inside. Deliberately **not** built here: an Edge record, a reverse index, and
 * presence for edges. Nothing mints or strips a `chainId` yet; the operations that will are
 * specified but gated on that storage.
 */
type EphemeraLudicRelationalEdgeBase<T extends EphemeraLudicTerminalId = EphemeraLudicTerminalId> = {
    tag: 'Relational';
    from: T;
    to: T;
    edgeId?: string;
    chainId?: string;
}

/**
 * In-host relational edge on room ludicGraph (Phase B establishRelation / dissolveRelation).
 *
 * **The union sits at the top level and the base is intersected into each arm, deliberately.**
 * `Base & (A | B)` does narrow in current TypeScript, but the arms-as-union form is what the
 * guard, the storage adapters and the comparison helpers were all verified against; keep it.
 *
 * **`T` narrows the terminal kinds an edge may carry.** The default is every kind. The ludicCache
 * instantiates it with a terminal type that excludes the own-binding kind
 * (`EphemeraLudicCacheTerminalId`), so a bare `PRESENCE#` terminal on a cache edge is a compile error.
 */
export type EphemeraLudicRelationalEdgeData<T extends EphemeraLudicTerminalId = EphemeraLudicTerminalId> =
    | (EphemeraLudicRelationalEdgeBase<T> & { kind: Exclude<HostRelationalEdgeKind, 'Custom'> })
    | (EphemeraLudicRelationalEdgeBase<T> & { kind: 'Custom'; relationLabel: string })

export const isEphemeraLudicRelationalEdgeData = (value: unknown): value is EphemeraLudicRelationalEdgeData => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }
    // Read through a `Record` view rather than a cast to the target type: the type is now a
    // discriminated union, so `relationLabel` is not a property of the non-`Custom` arm and a
    // cast-then-read would not compile for the very field this guard exists to check.
    const edge = value as Record<string, unknown>
    if (edge.tag !== 'Relational') {
        return false
    }
    if (!isEphemeraLudicTerminalId(edge.from) || !isEphemeraLudicTerminalId(edge.to)) {
        return false
    }
    if (typeof edge.kind !== 'string' || !STORED_RELATIONAL_EDGE_KINDS.has(edge.kind)) {
        return false
    }
    // The edge arm is carried by `Justifies` and by nothing else, and a `Justifies` edge has an
    // edge on both ends. An edge may not name itself; cycles between edges are fine.
    // **Contingent on v1 (one producer: SecuredTo's support between sibling edges).** The
    // both-ends-edges rule is NOT a statement of what `Justifies` means: the capable version has an
    // abstraction (a component) justify an edge, so its source may be a node. Lifting it changes
    // this check and `assertEdgeTerminalsLegal`; see "Owed by the capable version" in
    // `AGENT.edgeAbstractions.planning.md`.
    const fromIsEdge = isEphemeraLudicEdgeTerminal(edge.from)
    const toIsEdge = isEphemeraLudicEdgeTerminal(edge.to)
    if ((edge.kind === 'Justifies') !== (fromIsEdge && toIsEdge) || fromIsEdge !== toIsEdge) {
        return false
    }
    if (isEphemeraLudicEdgeTerminal(edge.from) && isEphemeraLudicEdgeTerminal(edge.to)) {
        const ids = [edge.from.edgeId, edge.to.edgeId]
        if (ids[0] === ids[1] || (edge.edgeId !== undefined && ids.includes(edge.edgeId as string))) {
            return false
        }
    }
    // Absent is the common case and stays legal --- identity is optional per edge (EA-8). A
    // *present* id must be a usable one, on the same reasoning as `relationLabel` below: a guard
    // that admitted an empty string would narrow to a type whose field cannot be read.
    if (edge.edgeId !== undefined && (typeof edge.edgeId !== 'string' || edge.edgeId.length === 0)) {
        return false
    }
    // Same shape of check for `chainId`, and the stakes are higher: this one *is* consulted by
    // comparison, so an unusable value admitted here would decide leg sameness.
    if (edge.chainId !== undefined && (typeof edge.chainId !== 'string' || edge.chainId.length === 0)) {
        return false
    }
    if (edge.kind === 'Custom') {
        return typeof edge.relationLabel === 'string' && edge.relationLabel.length > 0
    }
    // A non-`Custom` edge carrying a label is now *unrepresentable*, so accepting one would make
    // this predicate lie about the value it narrows. Previously such a value passed. Stored rows
    // in that shape are recovered --- with the stray label stripped --- by
    // `extractRelationalEdgesFromStored`'s fallback, so rejecting here loses no data.
    return edge.relationLabel === undefined
}

/**
 * An egress-list entry: a port record, stored interior-side but mixing facts of two scopes.
 * `fromHostId` names the exterior host that refers to this port; it has no interior witness,
 * so --- like `rootId` --- it is recorded, never derived. Which scope owns which field, and
 * what happens when the two disagree, is normative in
 * `lambda/ephemera/dataSource/positions/AGENT.contract.md` ("Port records: field scope and the
 * conflict rule"); the mental model is in that directory's `AGENT.concepts.md`.
 *
 * **Crossing-only as of presenceNodes Slice 7a (PN-14/PN-23).** `EphemeraPresencePortKind`/
 * `EphemeraPresencePort` are retired --- a presence binding is a node
 * (`EphemeraLudicGraphStructureNode`'s `Presence` arm), never a port record, so
 * `EphemeraLudicGraph.ports` now holds only this type. The single-member tombstone type
 * (`EphemeraPresencePortKind = 'Present'`) that used to mark the surviving port sense is gone
 * along with it; PR-15's denotation verdict (an edge landing on a presence binding denotes the
 * part of the object present via that binding) is unaffected, since it was never about the port
 * record.
 */
export type EphemeraCrossingPort = {
    portId: EphemeraCrossingPortId;
    /**
     * The exterior host that refers to this port --- almost always a component id, but a stub
     * port minted for a same-host straddle (`presenceSubGraph.ts`'s `subGraphFromNodes`) can name
     * a **presence node's** own id here when the disqualified endpoint it stubs resolves to a
     * presence binding (presenceNodes Slice 4, PN-6 clause (c)). An authored crossing port never
     * carries one --- only a component graph mints those, and a presence node never allocates a
     * port (PN-4) --- so this widening only ever fires on the stub path.
     */
    fromHostId: EphemeraMembershipHostId | EphemeraPresenceNodeId;
    /** Interior scope: the kind of the edge(s) passing through this port. Authored at mint
     * time, never derived from an edge. */
    kind: HostRelationalEdgeKind;
    /**
     * Exterior scope: the referring edge's `Custom` label, denormalized interior-side the same
     * way `fromHostId` is, since it lives in the parent's shard. Required non-empty when
     * `kind === 'Custom'` (PR-11). No interior counterpart is stored --- the interior edges
     * are siblings of `ports` in one attribute. A crossing port's fan agrees, with the single
     * exterior edge crossing into it, which is exactly what `kind`/`exteriorRelationLabel`
     * denormalize.
     */
    exteriorRelationLabel?: string;
}

/** `EphemeraLudicGraph.ports`' entry type. Kept as the pre-split name (PR-15 / Phase 4 of the
 * port vocabulary split) even though the union it once named has collapsed to one arm
 * (presenceNodes Slice 7a retired the presence branch) --- it is what every call site not
 * narrowed to `EphemeraCrossingPort` directly still imports. */
export type EphemeraLudicGraphPort = EphemeraCrossingPort

/** Host-bound play manipulation JSON (includes hostId). Assemble at Dynamo read boundary. */
export type EphemeraLudicGraphData = {
    hostId: EphemeraMembershipHostId;
    /** The graph's designated root node, present in `nodes` (concepts clause 3). Recorded, never derived --- see `positions/ludicGraph/AGENT.md`. */
    rootId: EphemeraLudicRootId;
    nodes: EphemeraLudicGraphNode[];
    /** Phase B: in-host relational edges on room host graphs; absent or [] when none. */
    edges?: EphemeraLudicRelationalEdgeData[];
    /** The egress list; required and possibly empty, deliberately with no read-boundary default. */
    ports: EphemeraLudicGraphPort[];
}

/** Value of Meta::*.ludicGraph attribute only (hostId omitted; row EphemeraId is authoritative). */
export type EphemeraLudicGraphFieldPayload = Omit<EphemeraLudicGraphData, 'hostId'>

export const isEphemeraLudicGraphComponentNode = (value: unknown): value is EphemeraLudicGraphComponentNode => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const entry = value as EphemeraLudicGraphComponentNode
    if (entry.hostingKind !== undefined && !isEphemeraHostingKind(entry.hostingKind)) {
        return false
    }
    if (entry.tag === 'Character') {
        return isEphemeraCharacterId(entry.universalKey)
    }
    if (entry.tag === 'Object') {
        return isEphemeraObjectId(entry.universalKey)
    }
    if (entry.tag === 'Room') {
        return isEphemeraRoomId(entry.universalKey)
    }
    if (entry.tag === 'Feature') {
        return isEphemeraFeatureId(entry.universalKey)
    }
    if (entry.tag === 'Area') {
        return isEphemeraAreaId(entry.universalKey)
    }
    return false
}

const isEphemeraPresenceCoverEntry = (entry: unknown): entry is EphemeraPresenceCoverEntry => {
    if (!entry || typeof entry !== 'object') {
        return false
    }
    const { host, presence } = entry as EphemeraPresenceCoverEntry
    return typeof host === 'string' && typeof presence === 'string' && isEphemeraPresenceNodeId(presence) && (
        isEphemeraCharacterId(host) || isEphemeraObjectId(host) ||
        isEphemeraRoomId(host) || isEphemeraFeatureId(host) || isEphemeraAreaId(host)
    )
}

export const isEphemeraPresenceCover = (value: unknown): value is EphemeraPresenceCover => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const cover = value as { tag?: unknown; members?: unknown }
    if (cover.tag !== undefined) {
        return false
    }
    return Array.isArray(cover.members) && cover.members.every(isEphemeraPresenceCoverEntry)
}

export const isEphemeraLudicGraphStructureNode = (value: unknown): value is EphemeraLudicGraphStructureNode => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const entry = value as EphemeraLudicGraphStructureNode
    if (entry.tag !== 'Presence') {
        return false
    }
    // A stored host-only `fromHostId` is the retired locator, the single `fromHostPresence` is the
    // retired one-parent shape, and a pointer with no `presence` is the same grain as the first:
    // all are rejected outright rather than read as hostless, so a surviving row reports through
    // `LudicGraphStaleStructureSweep` instead of silently losing its parent.
    return isEphemeraPresenceNodeId(entry.universalKey) &&
        isEphemeraPresenceParentPointerList(entry.fromHostPresences) &&
        !('hostingKind' in entry) &&
        !('fromHostId' in entry) &&
        !('fromHostPresence' in entry) &&
        isEphemeraPresenceCover(entry.cover)
}

/** Empty is legal: a hostless remainder has no parent. Every element must be a well-formed `{ host, presence }`, both required. */
export const isEphemeraPresenceParentPointerList = (value: unknown): value is EphemeraPresenceParentPointer[] => (
    Array.isArray(value) && value.every((pointer) => {
        if (!pointer || typeof pointer !== 'object') {
            return false
        }
        const { host, presence } = pointer as Partial<EphemeraPresenceParentPointer>
        return typeof host === 'string' && isEphemeraMembershipHostId(host) && typeof presence === 'string' && isEphemeraPresenceNodeId(presence)
    })
)

export const isEphemeraLudicGraphNode = (value: unknown): value is EphemeraLudicGraphNode => {
    if (!value || typeof value !== 'object') {
        return false
    }
    // A different shape of thing entirely (e.g. a legacy keyed record) --- kept on the wide
    // guard only, since duplicating it into both arms would make it look like a per-arm rule.
    if ('key' in value) {
        return false
    }
    return isEphemeraLudicGraphComponentNode(value) || isEphemeraLudicGraphStructureNode(value)
}

export const isEphemeraLudicGraphPort = (value: unknown): value is EphemeraLudicGraphPort => {
    if (!value || typeof value !== 'object') {
        return false
    }
    // Read through a `Record` view rather than a cast to the target type: an earlier version of
    // this guard covered a discriminated union (crossing arm plus a since-retired presence arm),
    // and this keeps the same read shape rather than reverting to a plain cast now that only one
    // arm is left.
    const entry = value as Record<string, unknown>
    if (!(
        typeof entry.portId === 'string' &&
        isEphemeraCrossingPortId(entry.portId) &&
        (
            isEphemeraMembershipHostId(entry.fromHostId as EphemeraMembershipHostId) ||
            isEphemeraPresenceNodeId(entry.fromHostId as string)
        )
    )) {
        return false
    }
    // As of presenceNodes Slice 7a (PN-14/PN-23), `EphemeraLudicGraphPort` is `EphemeraCrossingPort`
    // alone --- the presence sense (`EphemeraPresencePortKind`) retired along with the port
    // record, so a port's `kind` domain is exactly the edge Set now.
    if (typeof entry.kind !== 'string' || !STORED_RELATIONAL_EDGE_KINDS.has(entry.kind)) {
        return false
    }
    // Mirrors the edge guard's own conditional one-for-one: the scale change a port
    // records needs the exterior end of it, and a port carrying neither end records nothing.
    if (entry.kind === 'Custom') {
        return typeof entry.exteriorRelationLabel === 'string' && entry.exteriorRelationLabel.length > 0
    }
    if (entry.exteriorRelationLabel !== undefined && typeof entry.exteriorRelationLabel !== 'string') {
        return false
    }
    return true
}

export const isEphemeraLudicGraphFieldPayload = (value: unknown): value is EphemeraLudicGraphFieldPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const graph = value as EphemeraLudicGraphFieldPayload
    if (!isEphemeraLudicOwnedTerminal(graph.rootId)) {
        return false
    }
    if (!Array.isArray(graph.nodes)) {
        return false
    }
    if (!graph.nodes.every((entry) => isEphemeraLudicGraphNode(entry))) {
        return false
    }
    // Concepts clause 3: the designated root must be present in the graph's own node
    // list. Checked by owner, not full terminal equality --- `rootId` is always a bare
    // terminal primitive for a host-bound graph, never a port address, but a stored payload
    // is exactly the thing this guard exists not to assume.
    const rootOwner = ephemeraLudicTerminalOwner(graph.rootId)
    if (!graph.nodes.some((entry) => entry.universalKey === rootOwner)) {
        return false
    }
    // the root carries no hosting kind, and every member's kind must be legal for the host
    // kind. A node cannot see its host, so the per-host rule lives here, where `rootId` is known.
    const rootNode = graph.nodes.find((entry) => entry.universalKey === rootOwner)
    const hostTag = rootNode && rootNode.tag !== 'Presence' ? rootNode.tag : undefined
    for (const entry of graph.nodes) {
        if (entry.tag === 'Presence') {
            continue
        }
        if (entry.universalKey === rootOwner) {
            if (entry.hostingKind !== undefined) {
                return false
            }
            continue
        }
        // Required on every non-root component member (Slice 3): no kind is no longer read as `In`.
        if (entry.hostingKind === undefined || !hostTag || !isHostingKindLegalOnHost(entry.hostingKind, hostTag)) {
            return false
        }
    }
    if ('edges' in graph) {
        const edges = graph.edges
        if (!Array.isArray(edges) || !edges.every((entry) => isEphemeraLudicRelationalEdgeData(entry))) {
            return false
        }
        // An edge terminal naming an `edgeId` no edge of the graph carries is corruption (AGENT.contract.md "Edge persist shape").
        // Checked on the stored graph only: a cache holds the buckets it pulled, so a referrer there
        // may legitimately name an edge in a bucket that was not pulled.
        const ids = new Set(edges.map((entry) => entry.edgeId).filter((id) => id !== undefined))
        if (!edges.every((entry) => [entry.from, entry.to].every((terminal) => !isEphemeraLudicEdgeTerminal(terminal) || ids.has(terminal.edgeId)))) {
            return false
        }
    }
    // The egress list is required and possibly empty, not optional like `edges`
    // --- see `rootId`'s precedent above for why no `??= []` belongs at this boundary.
    if (!Array.isArray(graph.ports) || !graph.ports.every((entry) => isEphemeraLudicGraphPort(entry))) {
        return false
    }
    return true
}

export const isEphemeraLudicGraphData = (value: unknown): value is EphemeraLudicGraphData => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const graph = value as EphemeraLudicGraphData
    if (typeof graph.hostId !== 'string' || !isEphemeraMembershipHostId(graph.hostId)) {
        return false
    }
    return isEphemeraLudicGraphFieldPayload(graph)
}

export type EphemeraMetaRoom = {
    EphemeraId: EphemeraRoomId;
    DataCategory: 'Meta::Room';

    //
    // Existing field used for presence lists and room updates.
    //
    activeCharacters?: EphemeraRoomActiveCharacter[];

    //
    // Play-time membership graph (slice 2+ authority). Character + Object nodes shipped (Object: nodes only).
    //
    ludicGraph?: EphemeraLudicGraphFieldPayload;

    //
    // v1 world-state fields for state-driven, cache-backed Room rendering.
    //
    state?: EphemeraRoomState;
}

export const isEphemeraMetaRoom = (value: any): value is EphemeraMetaRoom => {
    if (!value || typeof value !== 'object') {
        return false
    }
    if (!checkTypes(value, { EphemeraId: 'string', DataCategory: 'string' })) {
        return false
    }
    if (!isEphemeraRoomId(value.EphemeraId) || value.DataCategory !== 'Meta::Room') {
        return false
    }
    if ('state' in value) {
        const state = value.state
        if (!state || typeof state !== 'object') {
            return false
        }
        if (!('marks' in state) || !isEphemeraCacheMarkState(state.marks)) {
            return false
        }
        if ('situationId' in state && typeof state.situationId !== 'string') {
            return false
        }
    }
    if ('activeCharacters' in value) {
        const activeCharacters = value.activeCharacters
        if (!Array.isArray(activeCharacters)) {
            return false
        }
        const ok = activeCharacters.every((entry: any) => (
            entry
            && typeof entry === 'object'
            && checkTypes(entry, { EphemeraId: 'string' }, {
                DisplayName: 'string',
                Name: 'string',
                Color: 'string',
                fileURL: 'string'
            })
            && isEphemeraCharacterId(entry.EphemeraId)
        ))
        if (!ok) {
            return false
        }
    }
    if ('objects' in value) {
        return false
    }
    if ('ludicGraph' in value && !isEphemeraLudicGraphFieldPayload(value.ludicGraph)) {
        return false
    }
    return true
}

//
// Partial projection of the ephemeraDB `Meta::Character` row (same PK/SK as presentation meta).
//
// The full row also carries `RoomStack`, `Name`, `HomeId`, `assets`, and other fields typed for
// lambda `CharacterMeta` / eviction-ladder reads --- not duplicated here. This interface names
// only the positions-owned slice we validate on Dynamo fetch (e.g. `getCharacterLudicGraphFromDynamo`
// projects `ludicGraph` via `Pick<EphemeraMetaCharacter, 'ludicGraph'>`). Do not treat the
// type name as a complete meta document shape.
//
export type EphemeraMetaCharacter = {
    EphemeraId: EphemeraCharacterId;
    DataCategory: 'Meta::Character';

    //
    // Play-time inventory graph (D16 / character host). v1: Object membership nodes only.
    //
    ludicGraph?: EphemeraLudicGraphFieldPayload;
}

/** Validates the positions slice of a `Meta::Character` row; does not assert presentation / ladder fields. */
export const isEphemeraMetaCharacter = (value: any): value is EphemeraMetaCharacter => {
    if (!value || typeof value !== 'object') {
        return false
    }
    if (!checkTypes(value, { EphemeraId: 'string', DataCategory: 'string' })) {
        return false
    }
    if (!isEphemeraCharacterId(value.EphemeraId) || value.DataCategory !== 'Meta::Character') {
        return false
    }
    if ('ludicGraph' in value) {
        const ludicGraph = value.ludicGraph
        if (!isEphemeraLudicGraphFieldPayload(ludicGraph)) {
            return false
        }
        // A character never holds another character (never membership-moved) --- but
        // clause 3 requires the graph's own root to be present in `nodes`, and a character host's
        // root node is necessarily Character-tagged (itself). Exclude the root's own node
        // from this check rather than reading the two rules as in conflict.
        const hasCharacterNode = ludicGraph.nodes.some((node) => node.tag === 'Character' && node.universalKey !== value.EphemeraId)
        if (hasCharacterNode) {
            return false
        }
    }
    return true
}

