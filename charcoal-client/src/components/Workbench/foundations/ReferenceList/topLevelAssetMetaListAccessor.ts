import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'

import type { WorkbenchAssetMetaWorking } from '../workbenchMutations'

export const topLevelAssetMetaListAccessor = {
    getReferenceList: (meta: WorkbenchAssetMetaWorking): ReferenceList => meta.topLevel,
    setReferenceList: (meta: WorkbenchAssetMetaWorking, list: ReferenceList): void => {
        meta.topLevel = list
    }
}
