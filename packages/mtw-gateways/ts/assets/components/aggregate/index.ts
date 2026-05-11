export type { AggregateGatewayDeps } from './ports'
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
export { createAggregateGateway, type AggregateGateway } from './factory'
