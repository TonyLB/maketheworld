import type { AnyAction } from 'redux'
import type { ThunkAction, ThunkDispatch } from 'redux-thunk'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { isSchemaAssetUUID } from '@tonylb/mtw-base/ts/schema'
import type StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'

import type { RootState } from '../../../../store'
import { heartbeat } from '../../../../slices/stateSeekingMachine/ssmHeartbeat'
import { setIntent, updateStandard } from '../../../../slices/personalAssets'

import type { PurgeDisposition } from './confirmPurgeBeforeRemove'

export type PurgeComponentInAssetParams = {
    reference: StandardReference
    disposition: Exclude<PurgeDisposition, 'cancel'>
}

export type PurgeComponentInAssetThunk = ThunkAction<
    Promise<void>,
    RootState,
    unknown,
    AnyAction
>

function componentKeyFromReference(reference: StandardReference): string {
    const universalKey = reference.universalKey
    if (!universalKey) {
        throw new Error('purgeComponentInAsset requires reference.universalKey')
    }
    return universalKey
}

/**
 * Purge a component from the Redux **local** asset draft via removeComponent.
 */
export const purgeComponentInAsset =
    (assetId: AssetUUID) =>
    (params: PurgeComponentInAssetParams): PurgeComponentInAssetThunk =>
    async (dispatch: ThunkDispatch<RootState, unknown, AnyAction>): Promise<void> => {
        if (!isSchemaAssetUUID(assetId)) {
            throw new Error(`Invalid asset id: ${assetId}`)
        }

        const { reference, disposition } = params
        const componentKey = componentKeyFromReference(reference)

        await dispatch(
            updateStandard(assetId)({
                type: 'removeComponent',
                componentKey,
                cascade: disposition === 'cascade'
            })
        )
        dispatch(setIntent({ key: assetId, intent: ['SCHEMADIRTY'] }))
        dispatch(heartbeat)
    }
