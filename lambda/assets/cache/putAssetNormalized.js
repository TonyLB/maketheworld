import {
    assetDB,
    ephemeraDB
} from '@tonylb/mtw-utilities/dist/dynamoDB/index'
import { splitType, AssetKey } from '@tonylb/mtw-utilities/dist/types'

export const putAssetNormalized = async ({ assetId, normalForm }) => {
    await ephemeraDB.putItem({
        EphemeraId: AssetKey(assetId),
        DataCategory: 'Meta::AssetNormalized',
        normalForm
    })
}

export default putAssetNormalized
