import type { EphemeraCharacterId, EphemeraFeatureId, EphemeraKnowledgeId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { perceiveStepSequence } from './perceiveStepSequence'
import type { KernelStep } from './kernelStep'

const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const FEATURE_ID = 'FEATURE#Fountain' as EphemeraFeatureId
const KNOWLEDGE_ID = 'KNOWLEDGE#Lore' as EphemeraKnowledgeId
const OBJECT_ID = 'OBJECT#Tray' as EphemeraObjectId
const OTHER_CHARACTER_ID = 'CHARACTER#Beta' as EphemeraCharacterId

describe('perceiveStepSequence', () => {
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('publishes a Look Command Requested event for a room describe step', async () => {
        const steps: KernelStep[] = [{ kind: 'describe', referentId: ROOM_ID, referentKind: 'room' }]

        await perceiveStepSequence(steps, CHARACTER_ID, { streamEvent })

        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: CHARACTER_ID,
            header: { type: 'Look Command Requested' },
            update: {
                type: 'Look Command Requested',
                characterId: CHARACTER_ID,
                componentId: ROOM_ID,
                confidence: 1,
            },
        })
    })

    it('publishes a Look Command Requested event for a feature describe step', async () => {
        const steps: KernelStep[] = [{ kind: 'describe', referentId: FEATURE_ID, referentKind: 'feature' }]

        await perceiveStepSequence(steps, CHARACTER_ID, { streamEvent })

        expect(streamEvent).toHaveBeenCalledWith(
            expect.objectContaining({ update: expect.objectContaining({ componentId: FEATURE_ID }) })
        )
    })

    it('publishes a Look Command Requested event for a knowledge describe step', async () => {
        const steps: KernelStep[] = [{ kind: 'describe', referentId: KNOWLEDGE_ID, referentKind: 'knowledge' }]

        await perceiveStepSequence(steps, CHARACTER_ID, { streamEvent })

        expect(streamEvent).toHaveBeenCalledWith(
            expect.objectContaining({ update: expect.objectContaining({ componentId: KNOWLEDGE_ID }) })
        )
    })

    it('publishes one event per describe step, in order, ignoring mutation steps in the same shared list', async () => {
        const steps: KernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([OBJECT_ID]), fromHostIds: new Set([ROOM_ID]), toHostId: CHARACTER_ID },
            { kind: 'describe', referentId: ROOM_ID, referentKind: 'room' },
            { kind: 'describe', referentId: FEATURE_ID, referentKind: 'feature' },
        ]

        await perceiveStepSequence(steps, CHARACTER_ID, { streamEvent })

        expect(streamEvent).toHaveBeenCalledTimes(2)
        expect(streamEvent.mock.calls[0][0].update.componentId).toBe(ROOM_ID)
        expect(streamEvent.mock.calls[1][0].update.componentId).toBe(FEATURE_ID)
    })

    it('publishes a Look Command Requested event for an object describe step (PK-6 stub, shortName only)', async () => {
        const steps: KernelStep[] = [{ kind: 'describe', referentId: OBJECT_ID, referentKind: 'object' }]

        await perceiveStepSequence(steps, CHARACTER_ID, { streamEvent })

        expect(streamEvent).toHaveBeenCalledWith(
            expect.objectContaining({ update: expect.objectContaining({ componentId: OBJECT_ID }) })
        )
    })

    it('throws a named error for a character describe step rather than silently skipping it', async () => {
        const steps: KernelStep[] = [{ kind: 'describe', referentId: OTHER_CHARACTER_ID, referentKind: 'character' }]

        await expect(perceiveStepSequence(steps, CHARACTER_ID, { streamEvent })).rejects.toThrow(/not yet supported/)
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('is a clean no-op for an empty step list', async () => {
        await perceiveStepSequence([], CHARACTER_ID, { streamEvent })

        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('is a clean no-op when the shared list has no describe steps at all', async () => {
        const steps: KernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([OBJECT_ID]), fromHostIds: new Set([ROOM_ID]), toHostId: CHARACTER_ID },
        ]

        await perceiveStepSequence(steps, CHARACTER_ID, { streamEvent })

        expect(streamEvent).not.toHaveBeenCalled()
    })
})
