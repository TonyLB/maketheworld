import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { DiagnosticsEphemeraRenderCacheFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import {
    canonicalizePerspectiveAssetStack,
    computePerspectiveKey,
} from '@tonylb/mtw-interfaces/ts/perspective'

/**
 * Normalized perspective context for P7 heal (catalog bump on existing Cache:: rows).
 * Target room resolution (finding.roomIds vs blueprint scan) is implemented in the
 * invalidation handler slice, not here.
 */
export type RenderCacheFindingHealContext = {
    assetStack: AssetUUID[];
    perspectiveKey: string;
    status: 'missing' | 'corrupted';
    roomIds?: EphemeraRoomId[];
    diagnosticRunId: string;
}

export function healContextFromRenderCacheFinding(
    finding: DiagnosticsEphemeraRenderCacheFindingEvent
): RenderCacheFindingHealContext {
    const assetStack = canonicalizePerspectiveAssetStack(finding.perspective)
    return {
        assetStack,
        perspectiveKey: computePerspectiveKey(assetStack),
        status: finding.status,
        ...(finding.roomIds !== undefined ? { roomIds: finding.roomIds } : {}),
        diagnosticRunId: finding.diagnosticRunId,
    }
}
