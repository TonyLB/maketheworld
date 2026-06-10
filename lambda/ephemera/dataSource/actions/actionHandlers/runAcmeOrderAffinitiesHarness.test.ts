import messageBus from '../../../messageBus'
import { isPublishMessage, isPublishWorldLineMessage } from '../../../messageBus/baseClasses'
import type { AcmeOrderAffinitiesHarnessFixture } from '../baseClasses'
import type { ParseCommandAcmeOrderResult } from '../baseClasses'
import { runAcmeOrderAffinitiesHarness } from './runAcmeOrderAffinitiesHarness'

jest.mock('../../../messageBus')

const mockMessageBus = messageBus as jest.Mocked<typeof messageBus>

function findPublishMessagePayload() {
    for (const call of mockMessageBus.publish.mock.calls) {
        const payload = call[0]
        if (isPublishMessage(payload)) {
            return payload
        }
    }
    throw new Error('expected PublishMessage')
}

const harnessValidOrderLine = {
    tropeAffinities: [{ trope: 'Contraption' as const, aptness: 'High' as const, narrowing: 'harness fixture' }],
    tropeAffinitiesFailed: false as const,
}

describe('runAcmeOrderAffinitiesHarness', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockMessageBus.publish.mockReturnValue(undefined)
        mockMessageBus.flush = jest.fn().mockResolvedValue(undefined)
    })

    it('runs parseCommand once per phrase and publishes one OOC message', async () => {
        const parseCommandImpl = jest.fn()

        const acmeOk = (phrase: string): ParseCommandAcmeOrderResult => ({
            type: 'AcmeOrder',
            confidence: 0.9,
            orders: [{
                valid: true,
                name: phrase,
                stableKey: phrase,
                ...harnessValidOrderLine,
            }],
        })

        parseCommandImpl
            .mockResolvedValueOnce(acmeOk('one'))
            .mockResolvedValueOnce(acmeOk('two'))

        await runAcmeOrderAffinitiesHarness({
            characterId: 'CHARACTER#t',
            messageBus,
            phrases: ['one', 'two'],
            parseCommandImpl,
            now: () => 0,
        })

        expect(parseCommandImpl).toHaveBeenCalledTimes(2)
        expect(parseCommandImpl.mock.calls[0][0]).toEqual({ command: 'order one' })
        expect(parseCommandImpl.mock.calls[1][0]).toEqual({ command: 'order two' })

        expect(mockMessageBus.publish).toHaveBeenCalledTimes(1)
        const payload = mockMessageBus.publish.mock.calls[0][0]
        if (!isPublishMessage(payload)) {
            throw new Error('expected PublishMessage')
        }
        if (!isPublishWorldLineMessage(payload)) {
            throw new Error('expected WorldMessage or WorldOOCMessage')
        }
        expect(payload.displayProtocol).toBe('WorldOOCMessage')
        expect(payload.targets).toEqual(['CHARACTER#t'])
        expect(Array.isArray(payload.message)).toBe(true)
        const joined = JSON.stringify(payload.message)
        expect(joined).toContain('--- 1/2 order one ---')
        expect(joined).toContain('--- 2/2 order two ---')
        expect(joined).toContain('AcmeOrder')
        expect(joined).toContain('elapsedMs')
    })

    it('captures thrown parseCommand errors into Error result JSON', async () => {
        const parseCommandImpl = jest.fn().mockRejectedValue(new Error('boom'))

        await runAcmeOrderAffinitiesHarness({
            characterId: 'CHARACTER#x',
            messageBus,
            phrases: ['solo'],
            parseCommandImpl,
            now: () => 0,
        })

        const payload = mockMessageBus.publish.mock.calls[0][0]
        if (!isPublishMessage(payload)) {
            throw new Error('expected PublishMessage')
        }
        if (!isPublishWorldLineMessage(payload)) {
            throw new Error('expected WorldMessage or WorldOOCMessage')
        }
        expect(JSON.stringify(payload.message)).toContain('boom')
    })

    it('runs only selected fixture when harnessInvocation fixture index is provided', async () => {
        const parseCommandImpl = jest.fn().mockResolvedValue({
            type: 'AcmeOrder',
            confidence: 0.8,
            orders: [{
                valid: true,
                name: 'two',
                stableKey: 'two',
                ...harnessValidOrderLine,
            }],
        })

        await runAcmeOrderAffinitiesHarness({
            characterId: 'CHARACTER#single',
            messageBus,
            phrases: ['one', 'two', 'three'],
            harnessInvocation: { mode: 'full', fixtureIndex1Based: 2 },
            parseCommandImpl,
            now: () => 0,
        })

        expect(parseCommandImpl).toHaveBeenCalledTimes(1)
        expect(parseCommandImpl.mock.calls[0][0]).toEqual({ command: 'order two' })
        const payload = mockMessageBus.publish.mock.calls[0][0]
        if (!isPublishMessage(payload)) {
            throw new Error('expected PublishMessage')
        }
        if (!isPublishWorldLineMessage(payload)) {
            throw new Error('expected WorldMessage or WorldOOCMessage')
        }
        expect(JSON.stringify(payload.message)).toContain('--- 1/1 order two ---')
    })

    it('publishes deterministic error and skips work on out-of-range fixture index', async () => {
        const parseCommandImpl = jest.fn()
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn()

        await runAcmeOrderAffinitiesHarness({
            characterId: 'CHARACTER#bad',
            messageBus,
            phrases: ['one', 'two'],
            harnessInvocation: { mode: 'full', fixtureIndex1Based: 3 },
            parseCommandImpl,
            invokeBedrockAcmeOrderEnrichImpl,
            enrichOnly: true,
            now: () => 0,
        })

        expect(parseCommandImpl).not.toHaveBeenCalled()
        expect(invokeBedrockAcmeOrderEnrichImpl).not.toHaveBeenCalled()
        expect(mockMessageBus.publish).toHaveBeenCalledTimes(1)
        const payload = mockMessageBus.publish.mock.calls[0][0]
        if (!isPublishMessage(payload)) {
            throw new Error('expected PublishMessage')
        }
        if (!isPublishWorldLineMessage(payload)) {
            throw new Error('expected WorldMessage or WorldOOCMessage')
        }
        const joined = JSON.stringify(payload.message)
        expect(joined).toContain('Coyote affinities test harness: fixture index must be an integer from 1 to 2 (received 3).')
    })

    it('enrichOnly runs enrich only and does not call parseCommand', async () => {
        const parseCommandImpl = jest.fn()
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({
            success: true,
            body: JSON.stringify({
                lines: [{
                    valid: true,
                    name: 'Test Widget',
                    stableKey: 'test-widget',
                    tropeAffinities: [{ trope: 'Contraption', aptness: 'High', narrowing: 'widget test' }],
                }],
                confidence: 0.95,
            }),
        })

        await runAcmeOrderAffinitiesHarness({
            characterId: 'CHARACTER#t',
            messageBus,
            phrases: ['alpha'],
            enrichOnly: true,
            parseCommandImpl,
            invokeBedrockAcmeOrderEnrichImpl,
            countCoyotePlacedObjectsAcrossRoomsDeps: { getGameRooms: async () => [] },
            now: () => 0,
        })

        expect(parseCommandImpl).not.toHaveBeenCalled()
        expect(invokeBedrockAcmeOrderEnrichImpl).toHaveBeenCalledTimes(1)
        const payload = findPublishMessagePayload()
        if (!isPublishWorldLineMessage(payload)) {
            throw new Error('expected WorldMessage or WorldOOCMessage')
        }
        const joined = JSON.stringify(payload.message)
        expect(joined).toContain('Acme enrich only')
        expect(joined).toContain('Test Widget')
    })

    it('enrichOnly includes chain-of-reason block and JSON when enrich returns Markdown + fence', async () => {
        const parseCommandImpl = jest.fn()
        const payload = JSON.stringify({
            lines: [{
                valid: true,
                name: 'CoR Widget',
                stableKey: 'cor-widget',
                tropeAffinities: [{ trope: 'Contraption', aptness: 'High', narrowing: 'cor widget' }],
            }],
            confidence: 0.9,
        })
        const body = `## Analysis\nValid gadget.\n\n\`\`\`json\n${payload}\n\`\`\``
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({
            success: true,
            body,
        })

        await runAcmeOrderAffinitiesHarness({
            characterId: 'CHARACTER#t',
            messageBus,
            phrases: ['beta'],
            enrichOnly: true,
            parseCommandImpl,
            invokeBedrockAcmeOrderEnrichImpl,
            countCoyotePlacedObjectsAcrossRoomsDeps: { getGameRooms: async () => [] },
            now: () => 0,
        })

        expect(parseCommandImpl).not.toHaveBeenCalled()
        const payloadMsg = findPublishMessagePayload()
        if (!isPublishWorldLineMessage(payloadMsg)) {
            throw new Error('expected WorldMessage or WorldOOCMessage')
        }
        const joined = JSON.stringify(payloadMsg.message)
        expect(joined).toContain('Classify order type (markdown):')
        expect(joined).toContain('Analysis')
        expect(joined).not.toContain('"reasoningMarkdown"')
        expect(joined).toContain('CoR Widget')
    })

    it('verbose harness mode includes raw enrich body when available', async () => {
        const parseCommandWithEnrichReasoningImpl = jest.fn().mockResolvedValue({
            result: {
                type: 'AcmeOrder',
                confidence: 0.9,
                orders: [{
                    valid: true,
                    name: 'Rocket Skates',
                    stableKey: 'rocket-skates',
                    ...harnessValidOrderLine,
                }],
            },
            enrichReasoningMarkdown: 'surface text | gloss: corrected phrase or (none) | physics: yes or no | primary: bucket | finishing-mechanisms: mechanism1, mechanism2 or none | packaging-alts: alt1; alt2 or n/a',
            enrichRawBody: '## Step 1\nrocket skates | (none) | yes | Self-contained | none | n/a\n\n```json\n{"lines":[{"valid":true,"name":"Rocket Skates","stableKey":"rocket-skates","tropeAffinities":[{"trope":"Contraption","aptness":"High","narrowing":"enhance Coyote pursuit speed"}]}]}\n```',
        })

        await runAcmeOrderAffinitiesHarness({
            characterId: 'CHARACTER#verbose',
            messageBus,
            phrases: ['rocket skates'],
            harnessInvocation: { mode: 'full', fixtureIndex1Based: 1, verbose: true },
            parseCommandWithEnrichReasoningImpl,
            now: () => 0,
        })

        const payload = mockMessageBus.publish.mock.calls[0][0]
        if (!isPublishMessage(payload)) {
            throw new Error('expected PublishMessage')
        }
        if (!isPublishWorldLineMessage(payload)) {
            throw new Error('expected WorldMessage or WorldOOCMessage')
        }
        const joined = JSON.stringify(payload.message)
        expect(joined).toContain('Raw enrich body:')
        expect(joined).toContain('```json')
        expect(joined).toContain('\\"tropeAffinities\\"')
    })

    it('uses fixture objects and renders fixture metadata line', async () => {
        const parseCommandImpl = jest.fn().mockResolvedValue({
            type: 'AcmeOrder',
            confidence: 0.8,
            orders: [{
                valid: true,
                name: 'paint',
                stableKey: 'paint',
                ...harnessValidOrderLine,
            }],
        })
        const fixtures: AcmeOrderAffinitiesHarnessFixture[] = [{
            id: 'fx-1',
            commandPhrase: 'paint',
            bucket: 'borderline',
            tags: ['art-supplies'],
            expectedLines: [{
                nameLike: 'paint',
                valid: true,
            }],
            likelyErrors: ['Return no tropeAffinities'],
        }]

        await runAcmeOrderAffinitiesHarness({
            characterId: 'CHARACTER#fixture',
            messageBus,
            fixtures,
            parseCommandImpl,
            now: () => 0,
        })

        expect(parseCommandImpl).toHaveBeenCalledTimes(1)
        expect(parseCommandImpl.mock.calls[0][0]).toEqual({ command: 'order paint' })
        const payload = mockMessageBus.publish.mock.calls[0][0]
        if (!isPublishMessage(payload)) {
            throw new Error('expected PublishMessage')
        }
        if (!isPublishWorldLineMessage(payload)) {
            throw new Error('expected WorldMessage or WorldOOCMessage')
        }
        const joined = JSON.stringify(payload.message)
        expect(joined).toContain('fixtureMetadata:')
        expect(joined).toContain('bucket: borderline')
        expect(joined).toContain('tags: art-supplies')
        expect(joined).toContain('expectedLines: 1')
        expect(joined).toContain('likelyErrors: 1')
    })
})
