import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import internalCache from '../internalCache'
import { reseedComponentExamplesFromDiagnostics } from './reseedFromDiagnostics'

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
            header: { type: 'Component Updated' }
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
})
