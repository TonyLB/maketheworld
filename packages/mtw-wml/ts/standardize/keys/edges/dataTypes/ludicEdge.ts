import { StandardEditableData, editWrappedTypeguard } from "@tonylb/mtw-base/ts/editable"
import { StandardReferenceData, isStandardReferenceData } from "../../dataTypes/reference"
import { ExitEdgePayloadData, isExitEdgePayloadData } from "./exitEdge"

//
// LG-9/LG-10: one edge list over three classes of kind. Topology is today's <Exit> plus the
// unauthored Bearing sibling; Membership and Peer mirror ephemera's HostRelationalEdgeKind
// split. `kind` is the sole discriminant -- no `category` field restates it. `edgeId`/`chainId`
// sit on every non-Navigation kind as base fields (LG-10); Navigation keeps its existing `uuid`
// field, which plays the same identity role (the authored uuid IS the edgeId -- one slot, not
// two schemes).
//

export const LUDIC_EDGE_TOPOLOGY_KINDS = ['Navigation', 'Bearing'] as const
export const LUDIC_EDGE_MEMBERSHIP_KINDS = ['In', 'On', 'PartOf'] as const
export const LUDIC_EDGE_PEER_KINDS = ['Under', 'Against', 'Custom'] as const

export type LudicEdgeTopologyKind = typeof LUDIC_EDGE_TOPOLOGY_KINDS[number]
export type LudicEdgeMembershipKind = typeof LUDIC_EDGE_MEMBERSHIP_KINDS[number]
export type LudicEdgePeerKind = typeof LUDIC_EDGE_PEER_KINDS[number]
export type LudicEdgeKind = LudicEdgeTopologyKind | LudicEdgeMembershipKind | LudicEdgePeerKind

const LUDIC_EDGE_KIND_SET = new Set<string>([
    ...LUDIC_EDGE_TOPOLOGY_KINDS,
    ...LUDIC_EDGE_MEMBERSHIP_KINDS,
    ...LUDIC_EDGE_PEER_KINDS,
])

export const isLudicEdgeKind = (value: unknown): value is LudicEdgeKind =>
    typeof value === 'string' && LUDIC_EDGE_KIND_SET.has(value)

/**
 * The only kind with a WML surface tag (`<Exit>`) and an author path in this slice. Endpoints
 * keep the existing Exit-specific Parent-style editable wrapper (Replace/Remove), since that is
 * what authoring `<Exit>` already needs; the stored `uuid` is the field LG-10 identifies as the
 * `edgeId` slot.
 */
export type StandardLudicNavigationEdgeData = {
    kind: 'Navigation'
    uuid: string
    from?: StandardEditableData<StandardReferenceData>
    to?: StandardEditableData<StandardReferenceData>
    payload: ExitEdgePayloadData
}

export const isStandardLudicNavigationEdgeData = (arg: unknown): arg is StandardLudicNavigationEdgeData => {
    if (typeof arg !== 'object' || arg === null) {
        return false
    }
    const data = arg as StandardLudicNavigationEdgeData
    if (data.kind !== 'Navigation') {
        return false
    }
    const referenceEditable = editWrappedTypeguard(isStandardReferenceData)
    if (typeof data.uuid !== 'string') {
        return false
    }
    if ('from' in data && data.from !== undefined && !referenceEditable(data.from)) {
        return false
    }
    if ('to' in data && data.to !== undefined && !referenceEditable(data.to)) {
        return false
    }
    return isExitEdgePayloadData(data.payload)
}

/**
 * LG-11: a relational edge's endpoint, mirroring `EphemeraLudicTerminalId` -- a bare component
 * reference, a port-qualified address on one (a crossing port, or a presence binding's exterior
 * address), or a bare presence-node self-reference (PR-15/PN-6 clause (c): an edge may land
 * directly on one of its own graph's presence bindings, never port-qualified in that case).
 * Stored edges land on all three forms (`AGENT.ludicNetwork.md` sections 2 and 4), so the wire
 * type has to as well or the stored-to-wire projection (Slice 4) silently drops a real terminal
 * -- exactly the failure mode alignment exists to retire. `port` is an opaque string, same as
 * `EphemeraLudicPortAddress.port`: either a minted crossing-port uuid or a `PRESENCE#<uuid>`
 * binding address, undiscriminated here for the same reason it is undiscriminated on the
 * ephemera side (the tag lives on the value, not the type). The presence arm is a distinct
 * `{ presence }` shape, not a bare string, because `StandardReferenceData`'s own bare-string form
 * is a `ComponentUUID` and a presence id is not a component (LG-8's reasoning again, at the edge
 * layer rather than the node layer).
 */
export type StandardLudicTerminalData =
    | StandardReferenceData
    | { owner: StandardReferenceData; port: string }
    | { presence: string }

export const isStandardLudicTerminalData = (arg: unknown): arg is StandardLudicTerminalData => {
    if (isStandardReferenceData(arg)) {
        return true
    }
    if (typeof arg !== 'object' || arg === null) {
        return false
    }
    if ('presence' in arg) {
        const entry = arg as { presence: unknown }
        return typeof entry.presence === 'string' && entry.presence.length > 0
    }
    const address = arg as { owner: unknown; port: unknown }
    return isStandardReferenceData(address.owner) && typeof address.port === 'string' && address.port.length > 0
}

/**
 * Bearing (Topology, non-traversable) and every Membership/Peer kind: no WML surface tag and no
 * author path yet in this slice -- typed and unit-exercised, unreachable from real authoring,
 * per the lift rule. Endpoints are `StandardLudicTerminalData` (LG-11), not the Exit-specific
 * editable wrapper: there is no schema tag driving Replace/Remove edits on these fields yet.
 */
type StandardLudicRelationalEdgeBase = {
    from: StandardLudicTerminalData
    to: StandardLudicTerminalData
    edgeId?: string
    chainId?: string
    ref?: number
}

export type StandardLudicRelationalEdgeData =
    | (StandardLudicRelationalEdgeBase & { kind: Exclude<LudicEdgeKind, 'Navigation' | 'Custom'> })
    | (StandardLudicRelationalEdgeBase & { kind: 'Custom'; relationLabel: string })

const LUDIC_RELATIONAL_EDGE_KIND_SET = new Set<string>([
    ...LUDIC_EDGE_MEMBERSHIP_KINDS,
    ...LUDIC_EDGE_PEER_KINDS,
    'Bearing',
])

export const isStandardLudicRelationalEdgeData = (arg: unknown): arg is StandardLudicRelationalEdgeData => {
    if (typeof arg !== 'object' || arg === null) {
        return false
    }
    const data = arg as StandardLudicRelationalEdgeData
    if (typeof data.kind !== 'string' || !LUDIC_RELATIONAL_EDGE_KIND_SET.has(data.kind)) {
        return false
    }
    if (!isStandardLudicTerminalData(data.from) || !isStandardLudicTerminalData(data.to)) {
        return false
    }
    if (data.edgeId !== undefined && (typeof data.edgeId !== 'string' || data.edgeId.length === 0)) {
        return false
    }
    if (data.chainId !== undefined && (typeof data.chainId !== 'string' || data.chainId.length === 0)) {
        return false
    }
    if (data.ref !== undefined && typeof data.ref !== 'number') {
        return false
    }
    if (data.kind === 'Custom') {
        return typeof data.relationLabel === 'string' && data.relationLabel.length > 0
    }
    return !('relationLabel' in data)
}

export type StandardLudicEdgeData = StandardLudicNavigationEdgeData | StandardLudicRelationalEdgeData

export const isStandardLudicEdgeData = (arg: unknown): arg is StandardLudicEdgeData =>
    isStandardLudicNavigationEdgeData(arg) || isStandardLudicRelationalEdgeData(arg)

export const isStandardLudicEdgeEnvelope = (arg: unknown): arg is StandardEditableData<StandardLudicEdgeData> =>
    editWrappedTypeguard(isStandardLudicEdgeData)(arg)

export type LudicEdgeListData = StandardEditableData<StandardLudicEdgeData>[]

export const isLudicEdgeListData = (arg: unknown): arg is LudicEdgeListData => (
    Array.isArray(arg) && arg.every(isStandardLudicEdgeEnvelope)
)
