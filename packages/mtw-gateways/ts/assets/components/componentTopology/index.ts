export {
    ComponentTopologyMergedCache,
    createComponentTopologyCacheHandler,
} from './factory'
export { componentTopologyPerspectiveCacheKey } from './keys'
export { assembleRoomTopologyAtPerspective, type AssembleRoomTopologyAtPerspectiveArgs } from './assemble'
export { filterAreaEdgeReferrers } from './referrers'
export {
    validateAssembleRoomTopologyInput,
    type AssembleRoomTopologyInput,
} from './input'
export type { ComponentTopologyAggregatePort, ComponentTopologyInternalCacheSlice } from './ports'
export {
    emptyProjectedRoomTopology,
    projectedRoomTopologyFromExitList,
    type ProjectedRoomTopology,
} from './result'
