import { StandardReferenceData, isStandardReferenceData } from "./reference"
import { checkAll } from "./typeguards"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { StandardExitEdgeData } from "../../keys/edges/dataTypes/exitEdge"
import { LudicEdgeListData, isLudicEdgeListData } from "../../keys/edges/dataTypes/ludicEdge"

export const LUDIC_GRAPH_NODE_TAGS = ['Area', 'Room', 'Feature', 'Character', 'Object'] as const
export type LudicGraphNodeTag = typeof LUDIC_GRAPH_NODE_TAGS[number]

const LUDIC_GRAPH_NODE_TAG_SET = new Set<string>(LUDIC_GRAPH_NODE_TAGS)

//
// Presence structure nodes (LG-8, alignment with EphemeraLudicGraphStructureNode). Nothing in
// WML authoring mints one of these yet -- Slice 2's asset-mode lint keeps it that way -- but the
// type carries the arm now, per the lift rule (take the type contract in full, defer the
// behavior). `ref` follows the same add/remove-by-sign convention as StandardReferenceData,
// since that is how every other list in this layer represents "is this entry in the list."
//

export type StandardLudicGraphPresenceCoverEntryData = {
    host: StandardReferenceData
    presence: string
}

export type StandardLudicGraphPresenceCoverData =
    | { tag: 'Full' }
    | { tag: 'Enumerated'; members: StandardLudicGraphPresenceCoverEntryData[] }

export type StandardLudicGraphPresenceNodeData = {
    tag: 'Presence'
    universalKey: string
    fromHostId: StandardReferenceData
    cover: StandardLudicGraphPresenceCoverData
    ref?: number
}

export const isStandardLudicGraphPresenceCoverData = (arg: unknown): arg is StandardLudicGraphPresenceCoverData => {
    if (typeof arg !== 'object' || arg === null) {
        return false
    }
    const cover = arg as StandardLudicGraphPresenceCoverData
    if (cover.tag === 'Full') {
        return true
    }
    if (cover.tag !== 'Enumerated') {
        return false
    }
    return Array.isArray(cover.members) && cover.members.every((entry) => (
        !!entry && typeof entry === 'object' &&
        typeof entry.presence === 'string' &&
        isStandardReferenceData(entry.host)
    ))
}

export const isStandardLudicGraphPresenceNodeData = (arg: unknown): arg is StandardLudicGraphPresenceNodeData => {
    if (typeof arg !== 'object' || arg === null) {
        return false
    }
    const node = arg as StandardLudicGraphPresenceNodeData
    if (node.tag !== 'Presence') {
        return false
    }
    return typeof node.universalKey === 'string' &&
        isStandardReferenceData(node.fromHostId) &&
        isStandardLudicGraphPresenceCoverData(node.cover) &&
        (node.ref === undefined || typeof node.ref === 'number')
}

//
// The node list (LG-8): a tagged union mirroring EphemeraLudicGraphNode -- component references
// (the pre-existing ReferenceList arm, unchanged) plus presence structure nodes (new). One field,
// so that the stored-to-wire projection (Slice 4) reshapes nothing.
//

export type StandardLudicGraphNodeData =
    | StandardEditableData<StandardReferenceData>
    | StandardLudicGraphPresenceNodeData

export type LudicGraphNodeListData = StandardLudicGraphNodeData[]

export const isStandardLudicGraphNodeData = (arg: unknown): arg is StandardLudicGraphNodeData => {
    if (isStandardLudicGraphPresenceNodeData(arg)) {
        return true
    }
    return isStandardReferenceData(arg as any)
}

export const isLudicGraphNodeListData = (arg: unknown): arg is LudicGraphNodeListData => (
    Array.isArray(arg) && arg.every(isStandardLudicGraphNodeData)
)

//
// The egress list (ports). Field exists for contract parity (LG-1); no WML write path populates
// it -- ports are minted only by play-time crossing, which never runs through a WML component.
//

export type StandardLudicGraphPortData = {
    portId: string
    fromHostId: StandardReferenceData | string
    kind: string
    exteriorRelationLabel?: string
}

export type LudicGraphPortListData = StandardLudicGraphPortData[]

export const isStandardLudicGraphPortData = (arg: unknown): arg is StandardLudicGraphPortData => {
    if (typeof arg !== 'object' || arg === null) {
        return false
    }
    const port = arg as StandardLudicGraphPortData
    return typeof port.portId === 'string' &&
        (typeof port.fromHostId === 'string' || isStandardReferenceData(port.fromHostId)) &&
        typeof port.kind === 'string' &&
        (port.exteriorRelationLabel === undefined || typeof port.exteriorRelationLabel === 'string')
}

export const isLudicGraphPortListData = (arg: unknown): arg is LudicGraphPortListData => (
    Array.isArray(arg) && arg.every(isStandardLudicGraphPortData)
)

//
// Re-exported so existing importers of the old Exit-only shape keep working; the WML surface tag
// stays <Exit> (LG-9) and this remains the parse target for it.
//
export type { StandardExitEdgeData }
export type ExitEdgeListData = StandardEditableData<StandardExitEdgeData>[]

export type StandardLudicGraphData = {
    rootId?: StandardReferenceData
    nodes?: LudicGraphNodeListData
    edges?: LudicEdgeListData
    ports?: LudicGraphPortListData
}

export const isStandardLudicGraphData = (arg: unknown): arg is StandardLudicGraphData => {
    if (typeof arg !== 'object' || arg === null) {
        return false
    }
    const data = arg as StandardLudicGraphData
    const rootIdValid = !('rootId' in data) || data.rootId === undefined || isStandardReferenceData(data.rootId)
    const nodesValid = !('nodes' in data) || data.nodes === undefined || isLudicGraphNodeListData(data.nodes)
    const edgesValid = !('edges' in data) || data.edges === undefined || isLudicEdgeListData(data.edges)
    const portsValid = !('ports' in data) || data.ports === undefined || isLudicGraphPortListData(data.ports)
    return checkAll(rootIdValid, nodesValid, edgesValid, portsValid)
}

export { LUDIC_GRAPH_NODE_TAG_SET }
