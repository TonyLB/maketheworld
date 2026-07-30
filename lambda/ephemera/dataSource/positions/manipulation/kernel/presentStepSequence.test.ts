import type { EphemeraCharacterId, EphemeraFeatureId, EphemeraKnowledgeId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { presentStepSequence } from './presentStepSequence'
import type { KernelStep } from './kernelStep'

const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const FEATURE_ID = 'FEATURE#Fountain' as EphemeraFeatureId
const KNOWLEDGE_ID = 'KNOWLEDGE#Lore' as EphemeraKnowledgeId
const OBJECT_ID = 'OBJECT#Tray' as EphemeraObjectId
const OTHER_CHARACTER_ID = 'CHARACTER#Beta' as EphemeraCharacterId

describe('presentStepSequence', () => {
    const streamEvent = jest.fn().mockResolvedValue(undefined)
    const messageBus = { publish: jest.fn() } as any

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('publishes a Look Command Requested event for a room describe step', async () => {
        const steps: KernelStep[] = [{ kind: 'describe', referentId: ROOM_ID, referentKind: 'room' }]

        await presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus })

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

        await presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus })

        expect(streamEvent).toHaveBeenCalledWith(
            expect.objectContaining({ update: expect.objectContaining({ componentId: FEATURE_ID }) })
        )
    })

    it('publishes a Look Command Requested event for a knowledge describe step', async () => {
        const steps: KernelStep[] = [{ kind: 'describe', referentId: KNOWLEDGE_ID, referentKind: 'knowledge' }]

        await presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus })

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

        await presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus })

        expect(streamEvent).toHaveBeenCalledTimes(2)
        expect(streamEvent.mock.calls[0][0].update.componentId).toBe(ROOM_ID)
        expect(streamEvent.mock.calls[1][0].update.componentId).toBe(FEATURE_ID)
    })

    it('publishes a Look Command Requested event for an object describe step (PK-6 stub, shortName only)', async () => {
        const steps: KernelStep[] = [{ kind: 'describe', referentId: OBJECT_ID, referentKind: 'object' }]

        await presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus })

        expect(streamEvent).toHaveBeenCalledWith(
            expect.objectContaining({ update: expect.objectContaining({ componentId: OBJECT_ID }) })
        )
    })

    it('throws a named error for a character describe step rather than silently skipping it', async () => {
        const steps: KernelStep[] = [{ kind: 'describe', referentId: OTHER_CHARACTER_ID, referentKind: 'character' }]

        await expect(presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus })).rejects.toThrow(/not yet supported/)
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('is a clean no-op for an empty step list', async () => {
        await presentStepSequence([], CHARACTER_ID, { streamEvent, messageBus })

        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('is a clean no-op when the shared list has no describe steps at all', async () => {
        const steps: KernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([OBJECT_ID]), fromHostIds: new Set([ROOM_ID]), toHostId: CHARACTER_ID },
        ]

        await presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus })

        expect(streamEvent).not.toHaveBeenCalled()
    })

    describe('narration branch (Phase 2)', () => {
        const ARRIVAL_ROOM_ID = 'ROOM#Arrival' as EphemeraRoomId
        const DEPARTURE_ROOM_ID = 'ROOM#Departure' as EphemeraRoomId

        const slotReports = () => (
            messageBus.publish.mock.calls
                .map((call: any[]) => call[0])
                .filter((message: any) => message?.type === 'StreamingEvent' && message?.header?.type === 'Message Slot Reported')
        )

        it('mover receives their own leave line; arrival-room occupants do not', async () => {
            const captures = new Map([['capture:from', [CHARACTER_ID, OTHER_CHARACTER_ID]]])
            const steps: KernelStep[] = [{
                kind: 'narrate',
                narration: {
                    kind: 'membershipMove',
                    direction: 'leave',
                    characterName: 'Tess',
                    copyKind: 'genericNavigate',
                },
                captureId: 'capture:from',
                bundleId: 'BUNDLE#test',
                slotId: 'leave:ROOM#Departure',
            }]

            await presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus }, captures)

            const reports = slotReports()
            expect(reports).toHaveLength(1)
            const content = await reports[0].getContent()
            expect(content.message.targets).toEqual([CHARACTER_ID, OTHER_CHARACTER_ID])
            expect(content.message.targets).not.toContain(ARRIVAL_ROOM_ID)
            //  The captured roster is the sole audience --- no live-expanding ROOM# target rides
            //  along, which would re-bind delivery terminally (see kernelStep.ts).
            expect(content.message.targets).not.toContain(DEPARTURE_ROOM_ID)
        })

        it('departure-room occupants do not receive the arrive line', async () => {
            const captures = new Map([['capture:to', [CHARACTER_ID]]])
            const steps: KernelStep[] = [{
                kind: 'narrate',
                narration: {
                    kind: 'membershipMove',
                    direction: 'arrive',
                    characterName: 'Tess',
                    copyKind: 'genericNavigate',
                },
                captureId: 'capture:to',
                bundleId: 'BUNDLE#test',
                slotId: 'arrive',
            }]

            await presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus }, captures)

            const reports = slotReports()
            expect(reports).toHaveLength(1)
            const content = await reports[0].getContent()
            expect(content.message.targets).toEqual([CHARACTER_ID])
            expect(content.message.targets).not.toContain(DEPARTURE_ROOM_ID)
            expect(content.message.targets).not.toContain(ARRIVAL_ROOM_ID)
        })

        it('builds message text from the copy-kind ingredients (exitAware leave, connect arrive)', async () => {
            const captures = new Map([
                ['capture:from', [CHARACTER_ID]],
                ['capture:to', [CHARACTER_ID]],
            ])
            const steps: KernelStep[] = [
                {
                    kind: 'narrate',
                    narration: {
                        kind: 'membershipMove',
                        direction: 'leave',
                        characterName: 'Tess',
                        copyKind: 'exitAware',
                        exitName: 'north',
                    },
                    captureId: 'capture:from',
                    bundleId: 'BUNDLE#test',
                    slotId: 'leave:ROOM#Departure',
                },
                {
                    kind: 'narrate',
                    narration: {
                        kind: 'membershipMove',
                        direction: 'arrive',
                        characterName: 'Tess',
                        copyKind: 'connect',
                    },
                    captureId: 'capture:to',
                    bundleId: 'BUNDLE#test',
                    slotId: 'arrive',
                },
            ]

            await presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus }, captures)

            const reports = slotReports()
            const contents = await Promise.all(reports.map((report: any) => report.getContent()))
            expect(contents[0].message.message).toEqual(['Tess left by north exit.'])
            expect(contents[1].message.message).toEqual(['Tess has connected.'])
        })

        it('throws rather than falling back to a live room roster when the captureId has no matching capture', async () => {
            const steps: KernelStep[] = [{
                kind: 'narrate',
                narration: {
                    kind: 'membershipMove',
                    direction: 'leave',
                    characterName: 'Tess',
                    copyKind: 'genericNavigate',
                },
                captureId: 'capture:missing',
                bundleId: 'BUNDLE#test',
                slotId: 'leave:ROOM#Departure',
            }]

            await expect(
                presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus }, new Map())
            ).rejects.toThrow(/capture:missing/)
            expect(slotReports()).toHaveLength(0)
        })

        it('delivers to a genuinely empty captured roster without throwing (empty is not missing)', async () => {
            const captures = new Map<string, EphemeraCharacterId[]>([['capture:from', []]])
            const steps: KernelStep[] = [{
                kind: 'narrate',
                narration: {
                    kind: 'membershipMove',
                    direction: 'leave',
                    characterName: 'Tess',
                    copyKind: 'genericNavigate',
                },
                captureId: 'capture:from',
                bundleId: 'BUNDLE#test',
                slotId: 'leave:ROOM#Departure',
            }]

            await presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus }, captures)

            const reports = slotReports()
            expect(reports).toHaveLength(1)
            const content = await reports[0].getContent()
            expect(content.message.targets).toEqual([])
        })
    })
})
