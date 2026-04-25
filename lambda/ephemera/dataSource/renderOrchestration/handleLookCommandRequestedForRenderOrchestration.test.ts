import type { MessageBus } from '../../messageBus/baseClasses'
import * as requestPrep from '../actions/requestFullRoomDescriptionForCharacter'
import * as perceptionSub from '../perception/subscribedEvents'
import * as roSub from './subscribedEvents'
import internalCache from '../../internalCache'
import { handleLookCommandRequestedForRenderOrchestration } from './handleLookCommandRequestedForRenderOrchestration'

jest.mock('../actions/requestFullRoomDescriptionForCharacter', () => ({
    prepareFullRoomDescriptionRenderForCharacter: jest.fn(),
}))

const mockPrepare = requestPrep.prepareFullRoomDescriptionRenderForCharacter as jest.MockedFunction<
    typeof requestPrep.prepareFullRoomDescriptionRenderForCharacter
>

describe('handleLookCommandRequestedForRenderOrchestration', () => {
    const send = jest.fn()
    const flush = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined)
    const bus = { send, flush } as unknown as MessageBus

    beforeEach(() => {
        jest.clearAllMocks()
        mockPrepare.mockResolvedValue({
            roomId: 'ROOM#X',
            characterId: 'CHARACTER#C',
            threadRegisterCommand: {
                threadKind: 'roomDescription',
                componentId: 'ROOM#X',
                perspectiveKey: 'pkey',
                characterId: 'CHARACTER#C',
            },
            renderCommand: {
                componentId: 'ROOM#X',
                perspective: { assetStack: ['ASSET#A'] },
                characterId: 'CHARACTER#C',
                generationContextWml: '<Room />',
            },
        })
    })

    it('flushes only the perception lane, then sendRenderRequested with useDefaultMessageBusLane', async () => {
        const spt = jest.spyOn(perceptionSub, 'sendPerceptionThreadRegistered').mockImplementation(() => {})
        const srr = jest.spyOn(roSub, 'sendRenderRequested').mockImplementation(() => {})
        const getAcrossAssetsSpy = jest
            .spyOn(internalCache.ComponentAssetMeta, 'getAcrossAssets')
            .mockResolvedValue({} as any)

        await handleLookCommandRequestedForRenderOrchestration(bus, {
            type: 'Look Command Requested',
            characterId: 'CHARACTER#C',
            roomId: 'ROOM#X',
            confidence: 1,
        })

        const expectedLane = roSub.lookCommandPerceptionThreadLaneId({ roomId: 'ROOM#X', characterId: 'CHARACTER#C' })
        expect(flush).toHaveBeenCalledTimes(1)
        expect(flush).toHaveBeenCalledWith(expectedLane)
        expect(flush.mock.calls.map((c) => c[0]).join(';')).not.toMatch(/renderOrchestration:/)
        expect(mockPrepare).toHaveBeenCalledWith('CHARACTER#C', 'ROOM#X', { includeGenerationContextWml: false })
        expect(getAcrossAssetsSpy).toHaveBeenCalledWith('ROOM#X', ['ASSET#A'])
        expect(spt).toHaveBeenCalledWith(
            bus,
            'ROOM#X',
            expect.objectContaining({ threadKind: 'roomDescription' }),
            expectedLane
        )
        expect(srr).toHaveBeenCalledWith(
            bus,
            'ROOM#X',
            expect.objectContaining({
                componentId: 'ROOM#X',
                generationContextWml: expect.any(String),
            }),
            { useDefaultMessageBusLane: true }
        )

        spt.mockRestore()
        srr.mockRestore()
        getAcrossAssetsSpy.mockRestore()
    })
})
