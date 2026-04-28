import messageBus from '../../../messageBus'
import { isPublishMessage, isPublishWorldLineMessage } from '../../../messageBus/baseClasses'
import type { ParseCommandAcmeOrderResult } from '../baseClasses'
import { runAcmeOrderAffinitiesHarness } from './runAcmeOrderAffinitiesHarness'

jest.mock('../../../messageBus')

const mockMessageBus = messageBus as jest.Mocked<typeof messageBus>

describe('runAcmeOrderAffinitiesHarness', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockMessageBus.send.mockReturnValue(undefined)
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
                affinities: [{ role: 'terminal', aptness: 0.5 }],
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

        expect(mockMessageBus.send).toHaveBeenCalledTimes(1)
        const payload = mockMessageBus.send.mock.calls[0][0]
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

        const payload = mockMessageBus.send.mock.calls[0][0]
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
                affinities: [{ role: 'terminal', aptness: 0.5 }],
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
        const payload = mockMessageBus.send.mock.calls[0][0]
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
        expect(mockMessageBus.send).toHaveBeenCalledTimes(1)
        const payload = mockMessageBus.send.mock.calls[0][0]
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
                    affinities: [{ role: 'terminal', aptness: 0.5 }],
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
        const payload = mockMessageBus.send.mock.calls[0][0]
        if (!isPublishMessage(payload)) {
            throw new Error('expected PublishMessage')
        }
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
                affinities: [{ role: 'terminal', aptness: 0.5 }],
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
        const payloadMsg = mockMessageBus.send.mock.calls[0][0]
        if (!isPublishMessage(payloadMsg)) {
            throw new Error('expected PublishMessage')
        }
        if (!isPublishWorldLineMessage(payloadMsg)) {
            throw new Error('expected WorldMessage or WorldOOCMessage')
        }
        const joined = JSON.stringify(payloadMsg.message)
        expect(joined).toContain('Classify order type (markdown):')
        expect(joined).toContain('Analysis')
        expect(joined).not.toContain('"reasoningMarkdown"')
        expect(joined).toContain('CoR Widget')
    })
})
