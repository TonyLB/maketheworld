import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import internalCache from '../internalCache'
import { reseedComponentExamplesFromDiagnostics } from './reseedFromDiagnostics'
import { DiagnosticsEphemeraRenderCacheFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'

jest.mock('../internalCache', () => ({
    AssetData: { get: jest.fn() },
    ComponentData: { get: jest.fn() }
}))

describe('reseedComponentExamplesFromDiagnostics', () => {
    const mockInternalCache = internalCache as unknown as {
        AssetData: { get: jest.Mock };
        ComponentData: { get: jest.Mock };
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('uses roomIds scope when provided', async () => {
        const room = new StandardRoom({
            tag: 'Room',
            universalKey: 'ROOM#alpha',
            situations: [{ reference: { universalKey: 'SITUATION#one' }, payload: {} } as any]
        } as any)
        mockInternalCache.AssetData.get.mockResolvedValue([{
            AssetId: 'ASSET#primitives',
            standardForm: { _components: [room] }
        }])
        mockInternalCache.ComponentData.get.mockResolvedValue([{
            ComponentId: 'ROOM#alpha',
            byAssets: [{ AssetId: 'ASSET#primitives', component: room }]
        }])
        const streamEvent = jest.fn().mockResolvedValue(undefined)

        await reseedComponentExamplesFromDiagnostics({
            type: 'Ephemera RenderCache Finding',
            perspective: ['ASSET#primitives'],
            status: 'missing',
            diagnosticRunId: 'diag-1',
            timestamp: '2026-04-21T12:00:00.000Z',
            roomIds: ['ROOM#alpha']
        }, streamEvent)

        expect(streamEvent).toHaveBeenCalledTimes(1)
        expect(streamEvent).toHaveBeenCalledWith({
            update: { type: 'Component Updated', component: room },
            streamKey: 'ASSET#primitives',
            header: { type: 'Component Republished' }
        })
    })

    it('resolves eligible rooms from perspective when roomIds are omitted', async () => {
        const roomOne = new StandardRoom({
            tag: 'Room',
            universalKey: 'ROOM#one',
            situations: [{ reference: { universalKey: 'SITUATION#one' }, payload: {} } as any]
        } as any)
        const roomTwo = new StandardRoom({
            tag: 'Room',
            universalKey: 'ROOM#two',
            situations: [{ reference: { universalKey: 'SITUATION#two' }, payload: {} } as any]
        } as any)
        mockInternalCache.AssetData.get.mockResolvedValue([{
            AssetId: 'ASSET#primitives',
            standardForm: { _components: [roomOne, roomTwo] }
        }])
        mockInternalCache.ComponentData.get
            .mockResolvedValueOnce([{ ComponentId: 'ROOM#one', byAssets: [{ AssetId: 'ASSET#primitives', component: roomOne }] }])
            .mockResolvedValueOnce([{ ComponentId: 'ROOM#two', byAssets: [{ AssetId: 'ASSET#primitives', component: roomTwo }] }])
        const streamEvent = jest.fn().mockResolvedValue(undefined)

        await reseedComponentExamplesFromDiagnostics({
            type: 'Ephemera RenderCache Finding',
            perspective: ['ASSET#primitives'],
            status: 'corrupted',
            diagnosticRunId: 'diag-2',
            timestamp: '2026-04-21T12:00:00.000Z'
        }, streamEvent)

        expect(streamEvent).toHaveBeenCalledTimes(2)
    })

    it('does not emit for roomIds outside the perspective-eligible room set', async () => {
        const roomOne = new StandardRoom({
            tag: 'Room',
            universalKey: 'ROOM#one',
            situations: [{ reference: { universalKey: 'SITUATION#one' }, payload: {} } as any]
        } as any)
        mockInternalCache.AssetData.get.mockResolvedValue([{
            AssetId: 'ASSET#primitives',
            standardForm: { _components: [roomOne] }
        }])
        const streamEvent = jest.fn().mockResolvedValue(undefined)

        await reseedComponentExamplesFromDiagnostics({
            type: 'Ephemera RenderCache Finding',
            perspective: ['ASSET#primitives'],
            status: 'missing',
            diagnosticRunId: 'diag-3',
            timestamp: '2026-04-21T12:00:00.000Z',
            roomIds: ['ROOM#two']
        }, streamEvent)

        expect(mockInternalCache.ComponentData.get).not.toHaveBeenCalled()
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('normalizes duplicate and invalid perspective/roomIds before reseed', async () => {
        const room = new StandardRoom({
            tag: 'Room',
            universalKey: 'ROOM#alpha',
            situations: [{ reference: { universalKey: 'SITUATION#one' }, payload: {} } as any]
        } as any)
        mockInternalCache.AssetData.get.mockResolvedValue([{
            AssetId: 'ASSET#primitives',
            standardForm: { _components: [room] }
        }])
        mockInternalCache.ComponentData.get.mockResolvedValue([{
            ComponentId: 'ROOM#alpha',
            byAssets: [{ AssetId: 'ASSET#primitives', component: room }]
        }])
        const streamEvent = jest.fn().mockResolvedValue(undefined)

        await reseedComponentExamplesFromDiagnostics({
            type: 'Ephemera RenderCache Finding',
            perspective: ['ASSET#primitives', 'ASSET#primitives', 'invalid' as any],
            status: 'missing',
            diagnosticRunId: 'diag-4',
            timestamp: '2026-04-21T12:00:00.000Z',
            roomIds: ['ROOM#alpha', 'ROOM#alpha', 'invalid-room' as any]
        }, streamEvent)

        expect(mockInternalCache.AssetData.get).toHaveBeenCalledWith(['ASSET#primitives'])
        expect(mockInternalCache.ComponentData.get).toHaveBeenCalledTimes(1)
        expect(streamEvent).toHaveBeenCalledTimes(1)
    })

    it('is idempotency-safe for repeated findings with the same normalized input', async () => {
        const room = new StandardRoom({
            tag: 'Room',
            universalKey: 'ROOM#alpha',
            situations: [{ reference: { universalKey: 'SITUATION#one' }, payload: {} } as any]
        } as any)
        mockInternalCache.AssetData.get.mockResolvedValue([{
            AssetId: 'ASSET#primitives',
            standardForm: { _components: [room] }
        }])
        mockInternalCache.ComponentData.get.mockResolvedValue([{
            ComponentId: 'ROOM#alpha',
            byAssets: [{ AssetId: 'ASSET#primitives', component: room }]
        }])
        const streamEvent = jest.fn().mockResolvedValue(undefined)
        const finding: DiagnosticsEphemeraRenderCacheFindingEvent = {
            type: 'Ephemera RenderCache Finding' as const,
            perspective: ['ASSET#primitives', 'ASSET#primitives'],
            status: 'corrupted' as const,
            diagnosticRunId: 'diag-5',
            timestamp: '2026-04-21T12:00:00.000Z',
            roomIds: ['ROOM#alpha', 'ROOM#alpha']
        }

        await reseedComponentExamplesFromDiagnostics(finding, streamEvent)
        await reseedComponentExamplesFromDiagnostics(finding, streamEvent)

        expect(streamEvent).toHaveBeenCalledTimes(2)
        expect(streamEvent).toHaveBeenNthCalledWith(1, {
            update: { type: 'Component Updated', component: room },
            streamKey: 'ASSET#primitives',
            header: { type: 'Component Republished' }
        })
        expect(streamEvent).toHaveBeenNthCalledWith(2, {
            update: { type: 'Component Updated', component: room },
            streamKey: 'ASSET#primitives',
            header: { type: 'Component Republished' }
        })
    })
})
