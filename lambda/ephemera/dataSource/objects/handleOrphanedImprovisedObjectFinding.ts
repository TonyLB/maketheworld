/**
 * Phase 4 orphan repair: delete existence rows on confirmed Orphaned Improvised Object Finding.
 */
import type { DiagnosticsOrphanedImprovisedObjectFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import { isOrphanedImprovisedObjectFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'

import internalCache from '../../internalCache'
import { destroyImprovisedObject } from './persistImprovisationObject'

export type HandleOrphanedImprovisedObjectFindingDependencies = {
    persistDelete?: typeof destroyImprovisedObject;
    /** Fresh read of the `Meta::Object` row; the kernel's destroy fails on an absent row. */
    metaRowExists?: (objectId: DiagnosticsOrphanedImprovisedObjectFindingEvent['objectId']) => Promise<boolean>;
}

export const handleOrphanedImprovisedObjectFinding = async (
    finding: DiagnosticsOrphanedImprovisedObjectFindingEvent,
    deps?: HandleOrphanedImprovisedObjectFindingDependencies
): Promise<void> => {
    if (!isOrphanedImprovisedObjectFindingEvent(finding)) {
        return
    }

    const persistDelete = deps?.persistDelete ?? destroyImprovisedObject
    const metaRowExists = deps?.metaRowExists ?? (async (objectId) => {
        internalCache.ObjectEphemeraMeta.invalidate(objectId)
        return (await internalCache.ObjectEphemeraMeta.get(objectId)) !== undefined
    })

    // Findings are delivered at-least-once; a repeat after a completed repair finds nothing to destroy.
    if (!(await metaRowExists(finding.objectId))) {
        return
    }
    const deleteResult = await persistDelete({ objectId: finding.objectId })

    if (!deleteResult.ok) {
        console.error('[mtw.ephemera.objects] orphaned improvised object repair delete failed', {
            objectId: finding.objectId,
            diagnosticRunId: finding.diagnosticRunId,
            deleteError: deleteResult.errorMessage,
        })
    }
}
