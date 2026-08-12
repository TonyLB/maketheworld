import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'

import type { ReferenceListSessionAccessor } from '../foundations/ReferenceList/ReferenceListSessionEditor'
import {
    filterNodesByTag,
    mergeNodesTagSlice,
    LudicGraphNodeTag,
    setAreaLudicGraphNodes
} from './areaEditMutations'

export function areaLudicGraphNodesTagAccessor(
    nodeTag: LudicGraphNodeTag
): ReferenceListSessionAccessor<StandardArea> {
    return {
        getReferenceList: (area) => filterNodesByTag(area.ludicGraph.nodes, nodeTag),
        setReferenceList: (area, tagSlice) => {
            setAreaLudicGraphNodes(
                area,
                mergeNodesTagSlice(area.ludicGraph.nodes, nodeTag, tagSlice)
            )
        }
    }
}
