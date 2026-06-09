import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ConnectionsCharacterRegisteredEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/connections'
import {
    handleCharacterRegisteredOrientation,
    resolveSessionOrientationContext,
} from './handleCharacterRegisteredOrientation'
import * as affordanceSubscribedEvents from '../affordanceOrchestration/subscribedEvents'
import * as perceptionSubscribedEvents from '../perception/subscribedEvents'
import * as renderSubscribedEvents from '../renderOrchestration/subscribedEvents'

const characterId = 'CHARACTER#c1' as EphemeraCharacterId
const roomId = 'ROOM#r1' as EphemeraRoomId
const perspective = { assetStack: ['ASSET#a'] }
const perspectiveKey = 'pk-orientation'

const baseEvent: ConnectionsCharacterRegisteredEvent = {
    type: 'Character Registered',
    characterId,
    sessionId: 'session-1',
    timestamp: '2026-01-01T00:00:00.000Z',
}

const resolvedDeps = () => ({
    characterMetaGet: jest.fn().mockResolvedValue({
        RoomId: roomId,
        assets: ['ASSET#a'],
    }),
    resolvePerspective: jest.fn().mockResolvedValue({ perspective, perspectiveKey }),
})

describe('resolveSessionOrientationContext', () => {
    it('returns null when CharacterMeta has no RoomId', async () => {
        const result = await resolveSessionOrientationContext(baseEvent, {
            characterMetaGet: jest.fn().mockResolvedValue({ assets: ['ASSET#a'] }),
            resolvePerspective: jest.fn(),
        })
        expect(result).toBeNull()
    })

    it('returns null when perspective resolution is empty', async () => {
        const result = await resolveSessionOrientationContext(baseEvent, {
            characterMetaGet: jest.fn().mockResolvedValue({ RoomId: roomId, assets: [] }),
            resolvePerspective: jest.fn().mockResolvedValue(null),
        })
        expect(result).toBeNull()
    })

    it('returns context with SESSION# target from raw sessionId', async () => {
        const result = await resolveSessionOrientationContext(baseEvent, resolvedDeps())
        expect(result).toEqual({
            characterId,
            roomId,
            perspective,
            perspectiveKey,
            targets: ['SESSION#session-1'],
        })
    })
})

describe('handleCharacterRegisteredOrientation', () => {
    const messageBus = { send: jest.fn() } as any

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('no-ops when room is missing', async () => {
        const threadSpy = jest.spyOn(perceptionSubscribedEvents, 'sendPerceptionThreadRegistered').mockImplementation(() => {})
        const renderSpy = jest.spyOn(renderSubscribedEvents, 'sendRenderRequested').mockImplementation(() => {})

        await handleCharacterRegisteredOrientation(messageBus, baseEvent, 'render', {
            characterMetaGet: jest.fn().mockResolvedValue(undefined),
            resolvePerspective: jest.fn(),
        })

        expect(threadSpy).not.toHaveBeenCalled()
        expect(renderSpy).not.toHaveBeenCalled()
        threadSpy.mockRestore()
        renderSpy.mockRestore()
    })

    it('no-ops when perspective is missing', async () => {
        const threadSpy = jest.spyOn(perceptionSubscribedEvents, 'sendPerceptionThreadRegistered').mockImplementation(() => {})
        const affordanceSpy = jest.spyOn(affordanceSubscribedEvents, 'sendAffordancesRequested').mockImplementation(() => {})

        await handleCharacterRegisteredOrientation(messageBus, baseEvent, 'affordances', {
            characterMetaGet: jest.fn().mockResolvedValue({ RoomId: roomId, assets: [] }),
            resolvePerspective: jest.fn().mockResolvedValue(null),
        })

        expect(threadSpy).not.toHaveBeenCalled()
        expect(affordanceSpy).not.toHaveBeenCalled()
        threadSpy.mockRestore()
        affordanceSpy.mockRestore()
    })

    it('render channel registers sessionOrientationRender and kicks Render Requested without targets', async () => {
        const threadSpy = jest.spyOn(perceptionSubscribedEvents, 'sendPerceptionThreadRegistered').mockImplementation(() => {})
        const renderSpy = jest.spyOn(renderSubscribedEvents, 'sendRenderRequested').mockImplementation(() => {})
        const affordanceSpy = jest.spyOn(affordanceSubscribedEvents, 'sendAffordancesRequested').mockImplementation(() => {})

        await handleCharacterRegisteredOrientation(messageBus, baseEvent, 'render', resolvedDeps())

        expect(threadSpy).toHaveBeenCalledTimes(1)
        expect(threadSpy).toHaveBeenCalledWith(messageBus, roomId, {
            threadKind: 'sessionOrientationRender',
            componentId: roomId,
            perspectiveKey,
            characterId,
            targets: ['SESSION#session-1'],
        })
        expect(renderSpy).toHaveBeenCalledTimes(1)
        expect(renderSpy).toHaveBeenCalledWith(messageBus, roomId, {
            componentId: roomId,
            perspective,
        })
        expect(affordanceSpy).not.toHaveBeenCalled()
        threadSpy.mockRestore()
        renderSpy.mockRestore()
        affordanceSpy.mockRestore()
    })

    it('affordances channel registers sessionOrientationAffordances and kicks Affordances Requested', async () => {
        const threadSpy = jest.spyOn(perceptionSubscribedEvents, 'sendPerceptionThreadRegistered').mockImplementation(() => {})
        const renderSpy = jest.spyOn(renderSubscribedEvents, 'sendRenderRequested').mockImplementation(() => {})
        const affordanceSpy = jest.spyOn(affordanceSubscribedEvents, 'sendAffordancesRequested').mockImplementation(() => {})

        await handleCharacterRegisteredOrientation(messageBus, baseEvent, 'affordances', resolvedDeps())

        expect(threadSpy).toHaveBeenCalledTimes(1)
        expect(threadSpy).toHaveBeenCalledWith(messageBus, roomId, {
            threadKind: 'sessionOrientationAffordances',
            componentId: roomId,
            perspectiveKey,
            characterId,
            targets: ['SESSION#session-1'],
        })
        expect(affordanceSpy).toHaveBeenCalledTimes(1)
        expect(affordanceSpy).toHaveBeenCalledWith(messageBus, roomId, {
            roomId,
            perspective,
            reason: 'roster',
        })
        expect(renderSpy).not.toHaveBeenCalled()
        threadSpy.mockRestore()
        renderSpy.mockRestore()
        affordanceSpy.mockRestore()
    })

    it('tolerates duplicate Character Registered by sending again', async () => {
        const threadSpy = jest.spyOn(perceptionSubscribedEvents, 'sendPerceptionThreadRegistered').mockImplementation(() => {})
        const renderSpy = jest.spyOn(renderSubscribedEvents, 'sendRenderRequested').mockImplementation(() => {})
        const deps = resolvedDeps()

        await handleCharacterRegisteredOrientation(messageBus, baseEvent, 'render', deps)
        await handleCharacterRegisteredOrientation(messageBus, baseEvent, 'render', deps)

        expect(threadSpy).toHaveBeenCalledTimes(2)
        expect(renderSpy).toHaveBeenCalledTimes(2)
        threadSpy.mockRestore()
        renderSpy.mockRestore()
    })
})
