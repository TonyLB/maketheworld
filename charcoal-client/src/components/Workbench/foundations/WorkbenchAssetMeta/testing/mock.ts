import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'

import { applyLastUpdateStandardMock } from '../../WorkbenchComponent/testing/mock'

export {
    resetWorkbenchAssetMock,
    seedWorkbenchAsset,
    updateStandardMock,
    applyLastFlushToCommitted,
    applyLastUpdateStandardMock,
    mockWorkbenchReturn
} from '../../WorkbenchComponent/testing/mock'

/** Read asset shortName after the most recent flush mock call. */
export const getFlushedAssetMetaShortName = (baseForm?: StandardForm): string | undefined => {
    const updated = applyLastUpdateStandardMock(baseForm?._clone())
    const shortNameJson = updated.shortName?.toJSON()
    return typeof shortNameJson === 'string' ? shortNameJson : undefined
}

/** Read top-level universal keys after the most recent flush mock call. */
export const getFlushedTopLevelUniversalKeys = (baseForm?: StandardForm): ComponentUUID[] => {
    const updated = applyLastUpdateStandardMock(baseForm?._clone())
    return (updated._topLevel?.payload ?? [])
        .map((ref) => ref.universalKey)
        .filter((key): key is ComponentUUID => key !== undefined)
}
