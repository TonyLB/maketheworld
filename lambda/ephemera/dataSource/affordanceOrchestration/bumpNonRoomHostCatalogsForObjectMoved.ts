/**
 * Bump-only, no-push invalidation for `Object Moved` against non-Room hosts (Object/Feature/
 * Character). Mirrors `renderCache/handleExampleInvalidated.ts`'s component-scoped path, but every
 * catalog row for the host bumps unconditionally --- unlike an authored edit, there is no
 * `editAssetId` to filter by; the host's contents changed, so every cached perspective is stale.
 */
import {
    conditionalInvalidateCatalogRow,
    queryCatalogRowsForComponent,
} from '../renderCache/catalogRow'
import type { EphemeraCacheComponentId } from '@tonylb/mtw-gateways/ts/ephemera/renderCache'

export const bumpNonRoomHostCatalogsForObjectMoved = async (
    hostIds: EphemeraCacheComponentId[]
): Promise<void> => {
    await Promise.all(hostIds.map(async (hostId) => {
        const rows = await queryCatalogRowsForComponent(hostId)
        await Promise.all(rows.map((row) => conditionalInvalidateCatalogRow(row)))
    }))
}
