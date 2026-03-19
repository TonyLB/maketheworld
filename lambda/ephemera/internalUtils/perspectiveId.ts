import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import { EphemeraPerspectiveId } from '../renderCache'

export const computePerspectiveId = (assetStack: AssetUUID[]): EphemeraPerspectiveId => {
    return computePerspectiveKey(assetStack)
}

