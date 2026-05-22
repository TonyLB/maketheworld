export { mergeAuthoritativeAcrossParticipationOrder } from './assemble'
export {
    ComponentAggregateMergedCache,
    createComponentAggregateCacheHandler,
    mergedComponentFromAuthoritative,
} from './factory'
export { aggregatePerspectiveCacheKey } from './keys'
export type {
    AggregateGatewayDeps,
    AggregateParticipationAssemblyDeps,
    ComponentAggregateInternalCacheSlice,
    ComponentDataParticipationLoader,
} from './ports'
export {
    AggregateInputError,
    aggregatePerspectiveExplicit,
    normalizeMergeParticipationOrder,
    participationAssetsInPerspective,
    type AggregatePerspective,
    type AggregatePerspectiveExplicitArgs,
    type MergeParticipationOrder,
    type OrderedAssetStack,
} from './input'
export { mergedComponentResult, type MergedComponentResult, type MergedComponentResultArgs } from './result'
export {
    createAggregateGateway,
    createComponentAggregateGateway,
    type AggregateGateway,
    type ComponentAggregateGatewayBundle,
} from './uncached'
