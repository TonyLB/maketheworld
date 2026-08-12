import { ReferenceListData } from "./reference"
import { checkAll, checkTypes } from "./typeguards"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { StandardExitEdgeData, isStandardExitEdgeEnvelope } from "../../keys/edges/dataTypes/exitEdge"

export const LUDIC_GRAPH_NODE_TAGS = ['Area', 'Room', 'Feature', 'Character', 'Object'] as const
export type LudicGraphNodeTag = typeof LUDIC_GRAPH_NODE_TAGS[number]

export type ExitEdgeListData = StandardEditableData<StandardExitEdgeData>[]

export type StandardLudicGraphData = {
    nodes?: ReferenceListData
    edges?: ExitEdgeListData
}

export const isStandardLudicGraphData = (arg: unknown): arg is StandardLudicGraphData => {
    if (typeof arg !== 'object' || arg === null) {
        return false
    }
    const edgesValid = !('edges' in arg)
        || (Array.isArray((arg as StandardLudicGraphData).edges)
            && (arg as StandardLudicGraphData).edges!.every(isStandardExitEdgeEnvelope))
    return checkAll(
        checkTypes(arg, {}, { nodes: 'referenceList' }),
        edgesValid
    )
}
