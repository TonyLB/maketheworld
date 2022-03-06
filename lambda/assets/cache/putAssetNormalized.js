import {
    assetDB,
    ephemeraDB
} from '/opt/utilities/dynamoDB/index.js'
import { splitType, AssetKey } from '/opt/utilities/types.js'

export const putAssetNormalized = async ({ assetId, normalForm }) => {
    await ephemeraDB.putItem({
        EphemeraId: AssetKey(assetId),
        DataCategory: 'Meta::AssetNormalized',
        normalForm
    })
}

export default putAssetNormalized
