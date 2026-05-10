/**
 * Re-exports Dynamo → StandardComponent helpers from {@link ../assetMeta/dynamoStandardComponents}.
 * Prefer importing from `@tonylb/mtw-gateways/ts/assets/components/assetMeta` for new code.
 */
export type { AuthoritativeComponentData } from '../assetMeta/dynamoStandardComponents'
export {
    authoritativeComponentDataFromUniversalPartitionRows,
    componentRowsFromAuthoritativeComponentData,
    componentRowsFromUniversalPartitionLines,
} from '../assetMeta/dynamoStandardComponents'
