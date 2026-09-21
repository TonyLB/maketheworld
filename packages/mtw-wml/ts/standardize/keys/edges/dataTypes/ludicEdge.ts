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
 * Bearing (Topology, non-traversable) and every Membership/Peer kind: no WML surface tag and no
 * author path yet in this slice -- typed and unit-exercised, unreachable from real authoring,
 * per the lift rule. Endpoints are plain `StandardReferenceData`, not the Exit-specific editable
 * wrapper: there is no schema tag driving Replace/Remove edits on these fields yet.
 */
type StandardLudicRelationalEdgeBase = {
    from: StandardReferenceData
    to: StandardReferenceData
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
    if (!isStandardReferenceData(data.from) || !isStandardReferenceData(data.to)) {
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
