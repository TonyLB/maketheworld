import type { AnyAction } from 'redux'
import type { ThunkAction, ThunkDispatch } from 'redux-thunk'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { isSchemaAssetUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'

import type { RootState } from '../../../../store'
import { heartbeat } from '../../../../slices/stateSeekingMachine/ssmHeartbeat'
import {
    getLocalStandardForm,
    setIntent,
    updateStandard
} from '../../../../slices/personalAssets'
import { materializeComponent, type MaterializeSpec } from './materializeComponent'

export type MaterializeComponentInAssetThunk = ThunkAction<
    Promise<StandardReference>,
    RootState,
    unknown,
    AnyAction
>

/**
 * Eagerly materialize a component on the Redux **local** asset draft (D10).
 * Fast-path when the body is already on the local form (create / reference-existing).
 * Import (`fromAsset`) always dispatches so `addImportToDraft` can update `from`.
 */
export const materializeComponentInAsset =
    (assetId: AssetUUID) =>
    (spec: MaterializeSpec): MaterializeComponentInAssetThunk =>
    async (
        dispatch: ThunkDispatch<RootState, unknown, AnyAction>,
        getState: () => RootState
    ): Promise<StandardReference> => {
        if (!isSchemaAssetUUID(assetId)) {
            throw new Error(`Invalid asset id: ${assetId}`)
        }

        const localData = getLocalStandardForm(assetId)(getState())
        if (localData) {
            const local = new StandardForm(localData)
            const existing = local.byUniversalId[spec.universalKey]
            if (!spec.fromAsset && existing?.reference) {
                return existing.reference
            }
        }

        let ref: StandardReference | undefined
        await dispatch(
            updateStandard(assetId)({
                type: 'updateLocal',
                update: (draft) => {
                    ref = materializeComponent(draft, spec)
                    return draft
                }
            })
        )
        dispatch(setIntent({ key: assetId, intent: ['SCHEMADIRTY'] }))
        dispatch(heartbeat)

        if (!ref) {
            throw new Error(`Could not materialize ${spec.universalKey}`)
        }

        const afterData = getLocalStandardForm(assetId)(getState())
        if (!afterData) {
            throw new Error(`Asset ${assetId} not in personalAssets after materialize`)
        }
        const after = new StandardForm(afterData)
        if (!after.byUniversalId[spec.universalKey]) {
            throw new Error(`Materialize produced no local entry for ${spec.universalKey}`)
        }

        return ref
    }
