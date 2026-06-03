import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'

import type { ReferenceListSessionAccessor } from '../foundations/ReferenceList/ReferenceListSessionEditor'
import {
    filterNodesByTag,
    mergeNodesTagSlice,
    PositionGraphNodeTag,
    setAreaPositionGraphNodes
} from './areaEditMutations'

export function areaPositionGraphNodesTagAccessor(
    nodeTag: PositionGraphNodeTag
): ReferenceListSessionAccessor<StandardArea> {
    return {
        getReferenceList: (area) => filterNodesByTag(area.positionGraph.nodes, nodeTag),
        setReferenceList: (area, tagSlice) => {
            setAreaPositionGraphNodes(
                area,
                mergeNodesTagSlice(area.positionGraph.nodes, nodeTag, tagSlice)
            )
        }
    }
}
