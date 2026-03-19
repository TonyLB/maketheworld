import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

export type PreviewGenerationPendingEntry = {
    requestId?: string;
};

export const makePreviewGenerationPendingKey = (roomId: EphemeraRoomId, perspectiveId: string): string =>
    `${roomId}::${perspectiveId}`;

/**
 * Per-invocation pending listeners for GenerateRoomPreview (and future preview flows),
 * keyed by room + perspectiveId. Cleared with InternalCache.clear().
 */
export class PreviewGenerationRequestsData {
    private pendingByKey = new Map<string, PreviewGenerationPendingEntry[]>();

    registerPending(params: { roomId: EphemeraRoomId; perspectiveId: string; requestId?: string }): void {
        const key = makePreviewGenerationPendingKey(params.roomId, params.perspectiveId);
        const list = this.pendingByKey.get(key) ?? [];
        if (params.requestId !== undefined) {
            if (list.some((entry) => entry.requestId === params.requestId)) {
                return;
            }
        }
        list.push({ requestId: params.requestId });
        this.pendingByKey.set(key, list);
    }

    getPending(roomId: EphemeraRoomId, perspectiveId: string): ReadonlyArray<PreviewGenerationPendingEntry> {
        const key = makePreviewGenerationPendingKey(roomId, perspectiveId);
        return [...(this.pendingByKey.get(key) ?? [])];
    }

    clear(): void {
        this.pendingByKey.clear();
    }
}
