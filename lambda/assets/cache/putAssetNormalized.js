import {
    assetDB,
    ephemeraDB
} from '@tonylb/mtw-utilities/dynamoDB/index.js'
import { splitType, AssetKey } from '@tonylb/mtw-utilities/types.js'

export const putAssetNormalized = async ({ assetId, normalForm }) => {
    await ephemeraDB.putItem({
        EphemeraId: AssetKey(assetId),
        DataCategory: 'Meta::AssetNormalized',
        normalForm
    })
}

export default putAssetNormalized
