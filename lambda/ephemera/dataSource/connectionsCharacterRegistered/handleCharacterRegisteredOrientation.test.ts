import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ConnectionsCharacterRegisteredEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/connections'
import internalCache from '../../internalCache'
import {
    handleCharacterRegisteredOrientation,
    resolveSessionOrientationContext,
} from './handleCharacterRegisteredOrientation'
import * as affordanceSubscribedEvents from '../affordanceOrchestration/subscribedEvents'
import * as perceptionSubscribedEvents from '../perception/subscribedEvents'
import * as orchestrationHandler from '../renderOrchestration/orchestrationHandler'

jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        PerceptionThreads: {
            register: jest.fn(),
        },
    },
}))

const internalCacheMock = jest.mocked(internalCache, true)

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

const streamEvent = jest.fn().mockResolvedValue(undefined)

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

    it('returns context with CHARACTER# target for transcript delivery', async () => {
        const result = await resolveSessionOrientationContext(baseEvent, resolvedDeps())
        expect(result).toEqual({
            characterId,
            roomId,
            perspective,
            perspectiveKey,
            targets: [characterId],
        })
    })
})

describe('handleCharacterRegisteredOrientation', () => {
    const messageBus = { send: jest.fn(), publish: jest.fn() } as any
    let logSpy: jest.SpiedFunction<typeof console.log>

    beforeEach(() => {
        jest.clearAllMocks()
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    })

    afterEach(() => {
        logSpy.mockRestore()
    })

    it('no-ops when room is missing', async () => {
        const orchestrateSpy = jest.spyOn(orchestrationHandler, 'orchestrateRenderRequest').mockResolvedValue(undefined)

        await handleCharacterRegisteredOrientation(messageBus, baseEvent, 'render', {
            characterMetaGet: jest.fn().mockResolvedValue(undefined),
            resolvePerspective: jest.fn(),
        }, streamEvent)

        expect(internalCacheMock.PerceptionThreads.register).not.toHaveBeenCalled()
        expect(orchestrateSpy).not.toHaveBeenCalled()
        expect(logSpy).toHaveBeenCalledWith(
            '[mtw.ephemera.connectionsCharacterRegistered] sessionOrientation',
            expect.objectContaining({
                event: 'skip',
                channel: 'render',
                reason: 'no_room',
                characterId,
                sessionId: 'session-1',
            })
        )
        orchestrateSpy.mockRestore()
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

    it('render channel registers sessionOrientationRender and calls orchestrateRenderRequest', async () => {
        const orchestrateSpy = jest.spyOn(orchestrationHandler, 'orchestrateRenderRequest').mockResolvedValue(undefined)
        const affordanceSpy = jest.spyOn(affordanceSubscribedEvents, 'sendAffordancesRequested').mockImplementation(() => {})

        await handleCharacterRegisteredOrientation(messageBus, baseEvent, 'render', resolvedDeps(), streamEvent)

        expect(internalCacheMock.PerceptionThreads.register).toHaveBeenCalledWith({
            threadKind: 'sessionOrientationRender',
            componentId: roomId,
            perspectiveKey,
            characterId,
            targets: [characterId],
        })
        expect(orchestrateSpy).toHaveBeenCalledWith({
            payload: {
                type: 'RenderRequested',
                componentId: roomId,
                perspective,
            },
            streamEvent,
        })
        expect(affordanceSpy).not.toHaveBeenCalled()
        orchestrateSpy.mockRestore()
        affordanceSpy.mockRestore()
    })

    it('affordances channel registers sessionOrientationAffordances and kicks Affordances Requested', async () => {
        const threadSpy = jest.spyOn(perceptionSubscribedEvents, 'sendPerceptionThreadRegistered').mockImplementation(() => {})
        const orchestrateSpy = jest.spyOn(orchestrationHandler, 'orchestrateRenderRequest').mockResolvedValue(undefined)
        const affordanceSpy = jest.spyOn(affordanceSubscribedEvents, 'sendAffordancesRequested').mockImplementation(() => {})

        await handleCharacterRegisteredOrientation(messageBus, baseEvent, 'affordances', resolvedDeps())

        expect(threadSpy).toHaveBeenCalledTimes(1)
        expect(threadSpy).toHaveBeenCalledWith(messageBus, roomId, {
            threadKind: 'sessionOrientationAffordances',
            componentId: roomId,
            perspectiveKey,
            characterId,
            targets: [characterId],
        })
        expect(affordanceSpy).toHaveBeenCalledTimes(1)
        expect(affordanceSpy).toHaveBeenCalledWith(messageBus, roomId, {
            roomId,
            perspective,
            reason: 'roster',
        }, { useDefaultMessageBusLane: true })
        expect(orchestrateSpy).not.toHaveBeenCalled()
        expect(logSpy).toHaveBeenCalledWith(
            '[mtw.ephemera.connectionsCharacterRegistered] sessionOrientation',
            expect.objectContaining({
                event: 'kicked',
                channel: 'affordances',
                threadKind: 'sessionOrientationAffordances',
                targets: [characterId],
            })
        )
        threadSpy.mockRestore()
        orchestrateSpy.mockRestore()
        affordanceSpy.mockRestore()
    })

    it('tolerates duplicate Character Registered by orchestrating again', async () => {
        const orchestrateSpy = jest.spyOn(orchestrationHandler, 'orchestrateRenderRequest').mockResolvedValue(undefined)
        const deps = resolvedDeps()

        await handleCharacterRegisteredOrientation(messageBus, baseEvent, 'render', deps, streamEvent)
        await handleCharacterRegisteredOrientation(messageBus, baseEvent, 'render', deps, streamEvent)

        expect(internalCacheMock.PerceptionThreads.register).toHaveBeenCalledTimes(2)
        expect(orchestrateSpy).toHaveBeenCalledTimes(2)
        orchestrateSpy.mockRestore()
    })
})
