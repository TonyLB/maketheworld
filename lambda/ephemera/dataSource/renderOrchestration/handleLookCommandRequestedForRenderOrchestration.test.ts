import type { MessageBus } from '../../messageBus/baseClasses'
import * as requestPrep from '../actions/requestFullRoomDescriptionForCharacter'
import * as perceptionSub from '../perception/subscribedEvents'
import * as roSub from './subscribedEvents'
import internalCache from '../../internalCache'
import { handleLookCommandRequestedForRenderOrchestration } from './handleLookCommandRequestedForRenderOrchestration'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'

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
        const generationContextSpy = jest
            .spyOn(internalCache.GenerationContext, 'get')
            .mockResolvedValue(undefined)

        await handleLookCommandRequestedForRenderOrchestration(bus, {
            type: 'Look Command Requested',
            characterId: 'CHARACTER#C',
            roomId: 'ROOM#X',
            confidence: 1,
        })

        expect(flush).toHaveBeenCalledTimes(1)
        const flushedLane = flush.mock.calls[0][0]
        expect(typeof flushedLane).toBe('string')
        expect(flushedLane).not.toHaveLength(0)
        expect(flushedLane).toMatch(/^lookCommand:perceptionThread:/)
        expect(flush.mock.calls.map((c) => c[0]).join(';')).not.toMatch(/renderOrchestration:/)
        expect(mockPrepare).toHaveBeenCalledWith('CHARACTER#C', 'ROOM#X', { includeGenerationContextWml: false })
        expect(generationContextSpy).toHaveBeenCalledWith('ROOM#X', ['ASSET#A'])
        expect(spt).toHaveBeenCalledWith(
            bus,
            'ROOM#X',
            expect.objectContaining({ threadKind: 'roomDescription' }),
            flushedLane
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
        generationContextSpy.mockRestore()
    })

    it('emits parseable generationContextWml with shortName when GenerationContext has data', async () => {
        const srr = jest.spyOn(roSub, 'sendRenderRequested').mockImplementation(() => {})
        const generationContextSpy = jest
            .spyOn(internalCache.GenerationContext, 'get')
            .mockResolvedValue({
                componentId: 'ROOM#X',
                shortName: new StandardLiteral('Room Name'),
            })

        await handleLookCommandRequestedForRenderOrchestration(bus, {
            type: 'Look Command Requested',
            characterId: 'CHARACTER#C',
            roomId: 'ROOM#X',
            confidence: 1,
        })

        const renderCommand = (srr.mock.calls[0][2] as { generationContextWml: string })
        expect(renderCommand.generationContextWml).toMatch(/<ShortName>Room Name<\/ShortName>/)
        expect(() => new StandardForm(renderCommand.generationContextWml)).not.toThrow()

        srr.mockRestore()
        generationContextSpy.mockRestore()
    })

    it('emits parseable generationContextWml fallback when GenerationContext has no data', async () => {
        const srr = jest.spyOn(roSub, 'sendRenderRequested').mockImplementation(() => {})
        const generationContextSpy = jest
            .spyOn(internalCache.GenerationContext, 'get')
            .mockResolvedValue(undefined)

        await handleLookCommandRequestedForRenderOrchestration(bus, {
            type: 'Look Command Requested',
            characterId: 'CHARACTER#C',
            roomId: 'ROOM#X',
            confidence: 1,
        })

        const renderCommand = (srr.mock.calls[0][2] as { generationContextWml: string })
        expect(renderCommand.generationContextWml).not.toMatch(/<ShortName>/)
        expect(() => new StandardForm(renderCommand.generationContextWml)).not.toThrow()

        srr.mockRestore()
        generationContextSpy.mockRestore()
    })
})
