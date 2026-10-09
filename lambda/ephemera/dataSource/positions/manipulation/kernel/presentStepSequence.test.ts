import type { EphemeraCharacterId, EphemeraFeatureId, EphemeraKnowledgeId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

const registerIngressSlot = jest.fn()
const kickPassiveRenderRequestedForCharacterInRoom = jest.fn()
const renderCacheGet = jest.fn()

jest.mock('../../../messageOrchestration', () => ({
    __esModule: true,
    registerIngressSlot: (...args: any[]) => registerIngressSlot(...args),
}))
jest.mock('../../../perception/kickRoomHeaderBroadcast', () => ({
    __esModule: true,
    kickPassiveRenderRequestedForCharacterInRoom: (...args: any[]) => kickPassiveRenderRequestedForCharacterInRoom(...args),
}))
jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: { RenderCache: { get: (...args: any[]) => renderCacheGet(...args) } },
}))

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
                createdTime: expect.any(Number),
                messageId: expect.stringMatching(/^MESSAGE#/),
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
            { kind: 'transferMembership', entityId: OBJECT_ID, fromHostIds: new Set([ROOM_ID]), toHostId: CHARACTER_ID },
            { kind: 'describe', referentId: ROOM_ID, referentKind: 'room' },
            { kind: 'describe', referentId: FEATURE_ID, referentKind: 'feature' },
        ]

        await presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus })

        expect(streamEvent).toHaveBeenCalledTimes(2)
        expect(streamEvent.mock.calls[0][0].update.componentId).toBe(ROOM_ID)
        expect(streamEvent.mock.calls[1][0].update.componentId).toBe(FEATURE_ID)
    })

    it('publishes a Look Command Requested event for an object describe step', async () => {
        const steps: KernelStep[] = [{ kind: 'describe', referentId: OBJECT_ID, referentKind: 'object' }]

        await presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus })

        expect(streamEvent).toHaveBeenCalledWith(
            expect.objectContaining({ update: expect.objectContaining({ componentId: OBJECT_ID }) })
        )
    })

    it('publishes a Look Command Requested event for a character describe step', async () => {
        const steps: KernelStep[] = [{ kind: 'describe', referentId: OTHER_CHARACTER_ID, referentKind: 'character' }]

        await presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus })

        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: CHARACTER_ID,
            header: { type: 'Look Command Requested' },
            update: {
                type: 'Look Command Requested',
                characterId: CHARACTER_ID,
                componentId: OTHER_CHARACTER_ID,
                confidence: 1,
                createdTime: expect.any(Number),
                messageId: expect.stringMatching(/^MESSAGE#/),
            },
        })
    })

    it('is a clean no-op for an empty step list', async () => {
        await presentStepSequence([], CHARACTER_ID, { streamEvent, messageBus })

        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('is a clean no-op when the shared list has no describe steps at all', async () => {
        const steps: KernelStep[] = [
            { kind: 'transferMembership', entityId: OBJECT_ID, fromHostIds: new Set([ROOM_ID]), toHostId: CHARACTER_ID },
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
                .filter((message: any) => message?.type === 'PublishMessage' && message?.displayProtocol === 'WorldMessage')
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
            }]

            await presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus }, captures)

            const reports = slotReports()
            expect(reports).toHaveLength(1)
            const content = { message: reports[0] }
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
            }]

            await presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus }, captures)

            const reports = slotReports()
            expect(reports).toHaveLength(1)
            const content = { message: reports[0] }
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
                },
            ]

            await presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus }, captures)

            const reports = slotReports()
            const contents = reports.map((report: any) => ({ message: report }))
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
            }]

            await presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus }, captures)

            const reports = slotReports()
            expect(reports).toHaveLength(1)
            const content = { message: reports[0] }
            expect(content.message.targets).toEqual([])
        })
    })
    /**
     * Phase 4's second narration family. Copy is preserved verbatim from the retired
     * `publishObjectManipulationPresentation.ts`, so these cases double as the regression pin that
     * the migration changed the *audience* and not the words.
     */
    describe('narration branch --- objectMove family (Phase 4)', () => {
        const slotReports = () => (
            messageBus.publish.mock.calls
                .map((call: any[]) => call[0])
                .filter((message: any) => message?.type === 'PublishMessage' && message?.displayProtocol === 'WorldMessage')
        )

        const objectStep = (
            { verbText = ' picks up ', characterName = 'Alice' }: { verbText?: string, characterName?: string } = {},
            captureId = 'capture:from:ROOM#Cafe'
        ): KernelStep => ({
            kind: 'narrate',
            narration: {
                kind: 'template',
                parts: [{ slot: 'actor' }, { text: verbText }, { ref: 'OBJECT#broom' }],
                actorName: characterName,
                labels: { 'OBJECT#broom': 'broom' },
            },
            captureId,
        })

        const reportedMessage = async () => {
            const reports = slotReports()
            expect(reports).toHaveLength(1)
            const content = { message: reports[0] }
            return content.message
        }

        it('builds take-hold and drop copy', async () => {
            await presentStepSequence(
                [objectStep()],
                CHARACTER_ID,
                { streamEvent, messageBus },
                new Map([['capture:from:ROOM#Cafe', [OTHER_CHARACTER_ID]]])
            )
            expect((await reportedMessage()).message).toEqual(['Alice picks up broom'])

            jest.clearAllMocks()
            await presentStepSequence(
                [objectStep({ verbText: ' drops ' })],
                CHARACTER_ID,
                { streamEvent, messageBus },
                new Map([['capture:from:ROOM#Cafe', [OTHER_CHARACTER_ID]]])
            )
            expect((await reportedMessage()).message).toEqual(['Alice drops broom'])
        })

        it('targets the captured roster, never a bare ROOM# that would re-expand at flush', async () => {
            await presentStepSequence(
                [objectStep()],
                CHARACTER_ID,
                { streamEvent, messageBus },
                new Map([['capture:from:ROOM#Cafe', [CHARACTER_ID, OTHER_CHARACTER_ID]]])
            )
            expect((await reportedMessage()).targets).toEqual([CHARACTER_ID, OTHER_CHARACTER_ID])
        })

        it('an empty captured roster publishes to nobody rather than throwing', async () => {
            // An empty room (or a host with no roster) captures legitimately empty. The step still
            // reports --- an unresolved slot is harmless to the fan-in.
            await presentStepSequence(
                [objectStep({}, 'capture:to')],
                CHARACTER_ID,
                { streamEvent, messageBus },
                new Map<string, EphemeraCharacterId[]>([['capture:to', []]])
            )
            expect((await reportedMessage()).targets).toEqual([])
        })

        it('throws on an unresolvable captureId rather than degrading to an empty audience', async () => {
            await expect(presentStepSequence(
                [objectStep()],
                CHARACTER_ID,
                { streamEvent, messageBus },
                new Map()
            )).rejects.toThrow()
        })
    })

    describe('presentation order', () => {
        const BEAT = 1_700_000_000_000
        const narrate = (direction: 'leave' | 'arrive', captureId: string): KernelStep => ({
            kind: 'narrate',
            narration: { kind: 'membershipMove', direction, characterName: 'Tess', copyKind: 'genericNavigate' },
            captureId,
        })
        const captures = new Map([['capture:from', [CHARACTER_ID]], ['capture:to', [CHARACTER_ID]]])
        const published = () => messageBus.publish.mock.calls.map((call: any[]) => call[0])

        it('stamps entry i at beatAnchorTime + i across narrate and describe steps, each with its own MessageId, and returns the next index', async () => {
            const steps: KernelStep[] = [
                narrate('leave', 'capture:from'),
                { kind: 'describe', referentId: ROOM_ID, referentKind: 'room', header: { perspectiveKey: 'pk', assets: ['ASSET#a'] } },
                narrate('arrive', 'capture:to'),
            ]

            const next = await presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus }, captures, BEAT)

            expect(next).toBe(3)
            const [leave, arrive] = published()
            expect(leave.createdTime).toBe(BEAT)
            expect(arrive.createdTime).toBe(BEAT + 2)
            const [, address, spec] = registerIngressSlot.mock.calls[0]!
            expect(address.createdTime).toBe(BEAT + 1)
            expect(new Set([leave.messageId, arrive.messageId, address.messageId]).size).toBe(3)
            expect(spec).toEqual(expect.objectContaining({
                componentId: ROOM_ID,
                perspectiveKey: 'pk',
                targets: [CHARACTER_ID],
                contentStream: 'render',
                format: 'header',
            }))
        })

        it('kicks the passive render for the header listener with the binding\'s assets', async () => {
            const steps: KernelStep[] = [
                { kind: 'describe', referentId: ROOM_ID, referentKind: 'room', header: { perspectiveKey: 'pk', assets: ['ASSET#a'] } },
            ]

            await presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus }, captures, BEAT)
            const kickoff = registerIngressSlot.mock.calls[0]![3]
            await kickoff()

            expect(kickPassiveRenderRequestedForCharacterInRoom).toHaveBeenCalledWith({
                roomId: ROOM_ID,
                characterId: CHARACTER_ID,
                assets: ['ASSET#a'],
                messageBus,
            })
            expect(streamEvent).not.toHaveBeenCalled()
        })

        it('publishes the static cache header at its stamped place when the header has no perspective key', async () => {
            renderCacheGet.mockResolvedValue([])
            const steps: KernelStep[] = [
                narrate('leave', 'capture:from'),
                { kind: 'describe', referentId: ROOM_ID, referentKind: 'room', header: { perspectiveKey: null, assets: [] } },
            ]

            await presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus }, captures, BEAT)

            expect(registerIngressSlot).not.toHaveBeenCalled()
            const header = published().find((message: any) => message.displayProtocol === 'PerceptionMessage')
            expect(header).toEqual(expect.objectContaining({
                targets: [CHARACTER_ID],
                createdTime: BEAT + 1,
                messageId: expect.stringMatching(/^MESSAGE#/),
                metaData: { componentUUID: ROOM_ID, displayMode: 'header', roomChannel: 'render' },
            }))
        })

        it('forwards the stamped time and MessageId on a full-format look', async () => {
            const steps: KernelStep[] = [
                narrate('leave', 'capture:from'),
                { kind: 'describe', referentId: ROOM_ID, referentKind: 'room' },
            ]

            await presentStepSequence(steps, CHARACTER_ID, { streamEvent, messageBus }, captures, BEAT)

            expect(streamEvent.mock.calls[0][0].update).toEqual(expect.objectContaining({ createdTime: BEAT + 1, messageId: expect.stringMatching(/^MESSAGE#/) }))
        })
    })
})
