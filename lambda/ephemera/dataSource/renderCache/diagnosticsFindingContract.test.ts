import { isEphemeraRenderCacheFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'

import { healContextFromRenderCacheFinding } from './diagnosticsFindingContract'

describe('healContextFromRenderCacheFinding', () => {
    it('canonicalizes perspective and computes perspectiveKey', () => {
        const finding = {
            type: 'Ephemera RenderCache Finding' as const,
            perspective: ['ASSET#b', 'ASSET#a'] as `ASSET#${string}`[],
            status: 'missing' as const,
            diagnosticRunId: 'run-1',
            timestamp: '2025-01-01T00:00:00.000Z',
            roomIds: ['ROOM#hall'] as import('@tonylb/mtw-interfaces/ts/baseClasses').EphemeraRoomId[],
        }
        expect(isEphemeraRenderCacheFindingEvent(finding)).toBe(true)
        const ctx = healContextFromRenderCacheFinding(finding)
        expect(ctx.assetStack).toEqual(['ASSET#b', 'ASSET#a'])
        expect(ctx.perspectiveKey).toMatch(/^PERSPECTIVE#v1#/)
        expect(ctx.status).toBe('missing')
        expect(ctx.roomIds).toEqual(['ROOM#hall'])
        expect(ctx.diagnosticRunId).toBe('run-1')
    })
})
