import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { EphemeraPerspectiveId } from '../renderCache'

const PERSPECTIVE_PREFIX = 'PERSPECTIVE#' as const

//
// Deterministically compute a perspectiveId from an ordered assetStack.
// Uses a simple 32-bit hash over the joined asset IDs; sufficient for
// equality comparison and filtering (not used as a primary key).
//
export const computePerspectiveId = (assetStack: AssetUUID[]): EphemeraPerspectiveId => {
    const base = assetStack.join('|')
    let hash = 0
    for (let index = 0; index < base.length; index += 1) {
        const charCode = base.charCodeAt(index)
        hash = ((hash << 5) - hash + charCode) | 0
    }
    const hex = (hash >>> 0).toString(16)
    return `${PERSPECTIVE_PREFIX}${hex}`
}

