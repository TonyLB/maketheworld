import messageBus from '../../messageBus'
import { isPublishMessage, isPublishWorldLineMessage } from '../../messageBus/baseClasses'
import type { ParseCommandAcmeOrderResult } from './baseClasses'
import { runAcmeOrderAffinitiesHarness } from './runAcmeOrderAffinitiesHarness'

jest.mock('../../messageBus')

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
                description: 'd',
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
})
