import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ConnectionsCharacterRegisteredEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/connections'
import internalCache from '../../internalCache'
import {
    handleCharacterRegisteredOrientation,
    resolveSessionOrientationContext,
} from './handleCharacterRegisteredOrientation'
import * as affordanceOrchestrationHandler from '../affordanceOrchestration/orchestrationHandler'
import * as perceptionSubscribedEvents from '../perception/subscribedEvents'
import * as orchestrationHandler from '../renderOrchestration/orchestrationHandler'
import * as messageOrchestration from '../messageOrchestration'
import * as messageOrchestrationSubscribedEvents from '../messageOrchestration/subscribedEvents'

jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        PerceptionThreads: {
            register: jest.fn(),
        },
    },
}))
jest.mock('../messageOrchestration', () => ({
    registerIngressSlot: jest.fn(),
}))
jest.mock('../messageOrchestration/subscribedEvents', () => ({
    sendMessageBundleDeclared: jest.fn(),
}))

const internalCacheMock = jest.mocked(internalCache, true)
const mockRegisterIngressSlot = messageOrchestration.registerIngressSlot as jest.MockedFunction<typeof messageOrchestration.registerIngressSlot>
const mockSendMessageBundleDeclared = messageOrchestrationSubscribedEvents.sendMessageBundleDeclared as jest.MockedFunction<typeof messageOrchestrationSubscribedEvents.sendMessageBundleDeclared>

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
    resolveCharacterRoomId: jest.fn().mockResolvedValue(roomId),
    characterMetaGet: jest.fn().mockResolvedValue({
        assets: ['ASSET#a'],
    }),
    resolvePerspective: jest.fn().mockResolvedValue({ perspective, perspectiveKey }),
})

const renderStreamEvent = jest.fn().mockResolvedValue(undefined)
const affordanceStreamEvent = jest.fn().mockResolvedValue(undefined)

describe('resolveSessionOrientationContext', () => {
    it('returns null when perspective resolution is empty', async () => {
        const result = await resolveSessionOrientationContext(baseEvent, {
            resolveCharacterRoomId: jest.fn().mockResolvedValue(roomId),
            characterMetaGet: jest.fn().mockResolvedValue({ assets: [] }),
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

    it('uses resolveCharacterRoomId instead of legacy CharacterMeta.RoomId', async () => {
        const resolveCharacterRoomId = jest.fn().mockResolvedValue('ROOM#Bridge' as EphemeraRoomId)
        const result = await resolveSessionOrientationContext(baseEvent, {
            ...resolvedDeps(),
            resolveCharacterRoomId,
        })
        expect(resolveCharacterRoomId).toHaveBeenCalledWith(characterId)
        expect(result?.roomId).toBe('ROOM#Bridge')
    })
})

describe('handleCharacterRegisteredOrientation', () => {
    const messageBus = { send: jest.fn(), publish: jest.fn() } as any
    let logSpy: jest.SpiedFunction<typeof console.log>

    beforeEach(() => {
        jest.clearAllMocks()
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
        // registerIngressSlot's kickoff is what actually calls orchestrateRenderRequest in
        // production --- invoke it here so these tests can assert on orchestrateRenderRequest
        // without depending on messageOrchestration's own single-flight mechanics (covered by
        // dataSource/messageOrchestration's own test suite).
        mockRegisterIngressSlot.mockImplementation(async (_bus, _bundleId, _spec, kickoff) => {
            await kickoff?.()
        })
    })

    afterEach(() => {
        logSpy.mockRestore()
    })

    it('no-ops when perspective is missing', async () => {
        const orchestrateSpy = jest.spyOn(orchestrationHandler, 'orchestrateRenderRequest').mockResolvedValue(undefined)

        await handleCharacterRegisteredOrientation(messageBus, baseEvent, 'render', {
            resolveCharacterRoomId: jest.fn().mockResolvedValue(roomId),
            characterMetaGet: jest.fn().mockResolvedValue(undefined),
            resolvePerspective: jest.fn().mockResolvedValue(null),
        }, renderStreamEvent)

        expect(internalCacheMock.PerceptionThreads.register).not.toHaveBeenCalled()
        expect(orchestrateSpy).not.toHaveBeenCalled()
        expect(logSpy).toHaveBeenCalledWith(
            '[mtw.ephemera.connectionsCharacterRegistered] sessionOrientation',
            expect.objectContaining({
                event: 'skip',
                channel: 'render',
                reason: 'no_perspective',
                characterId,
                sessionId: 'session-1',
            })
        )
        orchestrateSpy.mockRestore()
    })

    it('no-ops when perspective is missing on affordances channel', async () => {
        const threadSpy = jest.spyOn(perceptionSubscribedEvents, 'sendPerceptionThreadRegistered').mockImplementation(() => {})
        const affordanceSpy = jest.spyOn(affordanceOrchestrationHandler, 'orchestrateAffordanceRequest').mockResolvedValue(undefined)

        await handleCharacterRegisteredOrientation(messageBus, baseEvent, 'affordances', {
            resolveCharacterRoomId: jest.fn().mockResolvedValue(roomId),
            characterMetaGet: jest.fn().mockResolvedValue({ assets: [] }),
            resolvePerspective: jest.fn().mockResolvedValue(null),
        }, affordanceStreamEvent)

        expect(threadSpy).not.toHaveBeenCalled()
        expect(affordanceSpy).not.toHaveBeenCalled()
        threadSpy.mockRestore()
        affordanceSpy.mockRestore()
    })

    it('render channel declares a bundle, registers an ingress slot (format:header), and calls orchestrateRenderRequest', async () => {
        const orchestrateSpy = jest.spyOn(orchestrationHandler, 'orchestrateRenderRequest').mockResolvedValue(undefined)
        const affordanceSpy = jest.spyOn(affordanceOrchestrationHandler, 'orchestrateAffordanceRequest').mockResolvedValue(undefined)

        await handleCharacterRegisteredOrientation(messageBus, baseEvent, 'render', resolvedDeps(), renderStreamEvent)

        expect(mockSendMessageBundleDeclared).toHaveBeenCalledWith(
            messageBus,
            expect.any(String),
            expect.objectContaining({
                slots: [expect.objectContaining({ slotId: expect.any(String), expectedPublishType: 'PerceptionMessage' })],
            })
        )
        expect(mockRegisterIngressSlot).toHaveBeenCalledWith(
            messageBus,
            expect.any(String),
            expect.objectContaining({
                componentId: roomId,
                perspectiveKey,
                targets: [characterId],
                contentStream: 'render',
                format: 'header',
            }),
            expect.any(Function)
        )
        expect(orchestrateSpy).toHaveBeenCalledWith({
            payload: {
                type: 'RenderRequested',
                componentId: roomId,
                perspective,
            },
            streamEvent: renderStreamEvent,
        })
        expect(affordanceSpy).not.toHaveBeenCalled()
        orchestrateSpy.mockRestore()
        affordanceSpy.mockRestore()
    })

    it('affordances channel registers sessionOrientationAffordances and calls orchestrateAffordanceRequest', async () => {
        const threadSpy = jest.spyOn(perceptionSubscribedEvents, 'sendPerceptionThreadRegistered').mockImplementation(() => {})
        const renderSpy = jest.spyOn(orchestrationHandler, 'orchestrateRenderRequest').mockResolvedValue(undefined)
        const affordanceSpy = jest.spyOn(affordanceOrchestrationHandler, 'orchestrateAffordanceRequest').mockResolvedValue(undefined)

        await handleCharacterRegisteredOrientation(messageBus, baseEvent, 'affordances', resolvedDeps(), affordanceStreamEvent)

        expect(threadSpy).toHaveBeenCalledTimes(1)
        expect(threadSpy).toHaveBeenCalledWith(messageBus, roomId, {
            threadKind: 'sessionOrientationAffordances',
            componentId: roomId,
            perspectiveKey,
            characterId,
            targets: [characterId],
        })
        expect(affordanceSpy).toHaveBeenCalledTimes(1)
        expect(affordanceSpy).toHaveBeenCalledWith({
            payload: {
                type: 'AffordancesRequested',
                roomId,
                perspective,
                reason: 'roster',
            },
            streamEvent: affordanceStreamEvent,
        })
        expect(renderSpy).not.toHaveBeenCalled()
        expect(logSpy).toHaveBeenCalledWith(
            '[mtw.ephemera.connectionsCharacterRegistered] sessionOrientation',
            expect.objectContaining({
                event: 'kicked',
                channel: 'affordances',
                threadKind: 'sessionOrientationAffordances',
                targets: [characterId],
                orchestrationKick: 'orchestrateAffordanceRequest',
            })
        )
        threadSpy.mockRestore()
        renderSpy.mockRestore()
        affordanceSpy.mockRestore()
    })

    it('tolerates duplicate Character Registered by orchestrating again', async () => {
        const orchestrateSpy = jest.spyOn(orchestrationHandler, 'orchestrateRenderRequest').mockResolvedValue(undefined)
        const deps = resolvedDeps()

        await handleCharacterRegisteredOrientation(messageBus, baseEvent, 'render', deps, renderStreamEvent)
        await handleCharacterRegisteredOrientation(messageBus, baseEvent, 'render', deps, renderStreamEvent)

        expect(mockRegisterIngressSlot).toHaveBeenCalledTimes(2)
        expect(orchestrateSpy).toHaveBeenCalledTimes(2)
        orchestrateSpy.mockRestore()
    })
})
