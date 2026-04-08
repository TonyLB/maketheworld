import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraPerspectiveId } from '../renderCache/baseClasses'

export const computePerspectiveId = (assetStack: AssetUUID[]): EphemeraPerspectiveId => {
    return computePerspectiveKey(assetStack)
}

