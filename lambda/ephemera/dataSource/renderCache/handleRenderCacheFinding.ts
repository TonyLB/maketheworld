/**
 * P7: lazy catalog invalidation on Ephemera RenderCache Finding (diagnostics).
 */
import type { DiagnosticsEphemeraRenderCacheFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import { conditionalInvalidateCatalogRow, getCatalogRow } from './catalogRow'

export const handleRenderCacheFinding = async (
    finding: DiagnosticsEphemeraRenderCacheFindingEvent
): Promise<void> => {
    if (!finding.targetCatalogs.length) {
        return
    }

    await Promise.all(
        finding.targetCatalogs.map(async ({ ephemeraId, perspectiveKey }) => {
            const catalogRow = await getCatalogRow(ephemeraId, perspectiveKey)
            if (!catalogRow) {
                return
            }
            await conditionalInvalidateCatalogRow(catalogRow)
        })
    )
}
