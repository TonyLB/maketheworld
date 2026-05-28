import { ReferenceListData } from "./reference"
import { checkAll, checkTypes } from "./typeguards"

export const POSITION_GRAPH_NODE_TAGS = ['Area', 'Room', 'Feature', 'Character'] as const
export type PositionGraphNodeTag = typeof POSITION_GRAPH_NODE_TAGS[number]

export type StandardPositionGraphData = {
    nodes?: ReferenceListData
}

export const isStandardPositionGraphData = (arg: unknown): arg is StandardPositionGraphData => {
    if (typeof arg !== 'object' || arg === null) {
        return false
    }
    return checkAll(
        checkTypes(arg, {}, { nodes: 'referenceList' })
    )
}
