/**
 * @deprecated Partition enumerate is maintenance-only. Use {@link ExhaustiveScanCache} and
 * {@link createExhaustiveScanCacheHandler} from `../componentData/exhaustiveScanCache`, or
 * pair-addressed {@link createComponentDataCacheHandler} from `../componentData`.
 */
export {
    ExhaustiveScanCache as AuthoritativeComponentDataCache,
    createExhaustiveScanCacheHandler as createAuthoritativeComponentDataCacheHandler,
} from '../componentData/exhaustiveScanCache'
export type { ExhaustivePartitionAssetDB as AuthoritativeComponentPartitionAssetDB } from '../componentData/exhaustiveScan'
