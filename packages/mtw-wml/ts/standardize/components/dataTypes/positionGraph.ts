import { ReferenceListData } from "./reference"
import { checkAll, checkTypes } from "./typeguards"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { StandardExitEdgeData, isStandardExitEdgeEnvelope } from "../../keys/edges/dataTypes/exitEdge"

export const POSITION_GRAPH_NODE_TAGS = ['Area', 'Room', 'Feature', 'Character', 'Object'] as const
export type PositionGraphNodeTag = typeof POSITION_GRAPH_NODE_TAGS[number]

export type ExitEdgeListData = StandardEditableData<StandardExitEdgeData>[]

export type StandardPositionGraphData = {
    nodes?: ReferenceListData
    edges?: ExitEdgeListData
}

export const isStandardPositionGraphData = (arg: unknown): arg is StandardPositionGraphData => {
    if (typeof arg !== 'object' || arg === null) {
        return false
    }
    const edgesValid = !('edges' in arg)
        || (Array.isArray((arg as StandardPositionGraphData).edges)
            && (arg as StandardPositionGraphData).edges!.every(isStandardExitEdgeEnvelope))
    return checkAll(
        checkTypes(arg, {}, { nodes: 'referenceList' }),
        edgesValid
    )
}
