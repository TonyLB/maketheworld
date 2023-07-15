import {
    nonLegacyEphemeraDB
} from '@tonylb/mtw-utilities/dist/dynamoDB/index'
import { AssetKey } from '@tonylb/mtw-utilities/dist/types'

export const putAssetNormalized = async ({ assetId, normalForm }) => {
    await nonLegacyEphemeraDB.putItem({
        EphemeraId: AssetKey(assetId),
        DataCategory: 'Meta::AssetNormalized',
        normalForm
    })
}

export default putAssetNormalized
