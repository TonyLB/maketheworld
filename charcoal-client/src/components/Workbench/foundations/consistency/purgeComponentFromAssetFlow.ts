import type { AnyAction } from 'redux'
import type { ThunkDispatch } from 'redux-thunk'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { RootState } from '../../../../store'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'

import { previewPurgeClosure, type PreviewPurgeClosureOptions } from './previewPurgeClosure'
import { confirmPurgeBeforeRemove } from './confirmPurgeBeforeRemove'
import { purgeComponentInAsset } from './purgeComponentInAsset'

export type PurgeComponentFromAssetFlowParams = {
    dispatch: ThunkDispatch<RootState, unknown, AnyAction>
    assetId: AssetUUID
    localStandardForm: StandardForm
    reference: StandardReference
    targetLabel?: string
    previewOptions?: PreviewPurgeClosureOptions
}

/**
 * Preview, confirm, and dispatch explicit purge (removeComponent) for a component.
 */
export async function purgeComponentFromAssetFlow({
    dispatch,
    assetId,
    localStandardForm,
    reference,
    targetLabel,
    previewOptions
}: PurgeComponentFromAssetFlowParams): Promise<void> {
    const preview = previewPurgeClosure(localStandardForm._clone(), reference, previewOptions)
    const disposition = await confirmPurgeBeforeRemove({
        dispatch,
        reference,
        preview,
        targetLabel
    })

    if (disposition === 'cancel') {
        return
    }

    await dispatch(
        purgeComponentInAsset(assetId)({
            reference,
            disposition
        })
    )
}
