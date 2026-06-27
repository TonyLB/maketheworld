/**
 * Phase 4 orphan repair: delete existence rows on confirmed Orphaned Improvised Object Finding.
 */
import type { DiagnosticsOrphanedImprovisedObjectFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import { isOrphanedImprovisedObjectFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'

import { persistDeleteImprovisationObject } from './persistImprovisationObject'

export type HandleOrphanedImprovisedObjectFindingDependencies = {
    persistDelete?: typeof persistDeleteImprovisationObject;
}

export const handleOrphanedImprovisedObjectFinding = async (
    finding: DiagnosticsOrphanedImprovisedObjectFindingEvent,
    deps?: HandleOrphanedImprovisedObjectFindingDependencies
): Promise<void> => {
    if (!isOrphanedImprovisedObjectFindingEvent(finding)) {
        return
    }

    const persistDelete = deps?.persistDelete ?? persistDeleteImprovisationObject
    const deleteResult = await persistDelete({ objectId: finding.objectId })

    if (!deleteResult.ok) {
        console.error('[mtw.ephemera.objects] orphaned improvised object repair delete failed', {
            objectId: finding.objectId,
            diagnosticRunId: finding.diagnosticRunId,
            deleteError: deleteResult.errorMessage,
        })
    }
}
