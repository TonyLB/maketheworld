import {
    assetDB,
    ephemeraDB
} from 'mtw-utilities/dynamoDB/index.js'
import { splitType, AssetKey } from 'mtw-utilities/types.js'

export const putAssetNormalized = async ({ assetId, normalForm }) => {
    await ephemeraDB.putItem({
        EphemeraId: AssetKey(assetId),
        DataCategory: 'Meta::AssetNormalized',
        normalForm
    })
}

export default putAssetNormalized
