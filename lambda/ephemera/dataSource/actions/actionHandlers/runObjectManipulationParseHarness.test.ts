import messageBus from '../../../messageBus'
import { isPublishMessage, isPublishWorldLineMessage } from '../../../messageBus/baseClasses'
import type { ObjectManipulationParseHarnessFixture } from '../baseClasses'
import { runObjectManipulationParseHarness } from './runObjectManipulationParseHarness'

jest.mock('../../../messageBus')

const mockMessageBus = messageBus as jest.Mocked<typeof messageBus>

function publishedText(): string {
    expect(mockMessageBus.publish).toHaveBeenCalledTimes(1)
    const payload = mockMessageBus.publish.mock.calls[0][0]
    if (!isPublishMessage(payload) || !isPublishWorldLineMessage(payload)) {
        throw new Error('expected WorldOOCMessage')
    }
    expect(payload.displayProtocol).toBe('WorldOOCMessage')
    expect(payload.targets).toEqual(['CHARACTER#t'])
    return payload.message.filter((item): item is string => typeof item === 'string').join('\n')
}

const fixtures: ObjectManipulationParseHarnessFixture[] = [
    { id: 'one', corpusCase: 'C1', command: 'carefully get the cup on the table' },
    { id: 'two', corpusCase: 'C4', command: 'put the bag in the box' },
]

describe('runObjectManipulationParseHarness', () => {
    // A manner word keeps every template off a `get`, so only the bare exit reading reads it; a `put` is read.

    beforeEach(() => {
        jest.clearAllMocks()
        mockMessageBus.publish.mockReturnValue(undefined)
    })

    it('runs every fixture and publishes one OOC message with tokens, segmentations and attempts', async () => {
        await runObjectManipulationParseHarness({
            characterId: 'CHARACTER#t',
            messageBus,
            fixtures,
        })

        const text = publishedText()
        expect(text).toContain('--- 1/2 [1] C1: carefully get the cup on the table ---')
        expect(text).toContain('Route: bare exit reading only (climbs to classify)')
        expect(text).toContain('Skeleton: span "carefully get the cup on the table"')
        expect(text).toContain('Attempt (navigation):')
        expect(text).toContain('Route: fast path')
        expect(text).toContain('Tokens: put | the | bag | in | the | box')
        expect(text).toContain('Skeleton: text "put" | span "the bag" | text "in" | span "the box"')
        expect(text).toContain('Attempt (containment):')
    })

    it('runs one fixture by index', async () => {
        await runObjectManipulationParseHarness({
            characterId: 'CHARACTER#t',
            messageBus,
            fixtures,
            harnessInvocation: { fixtureIndex1Based: 2 },
        })

        expect(publishedText()).toContain('--- 1/1 [2] C4: put the bag in the box ---')
    })

    it('runs free text no template reads, showing only the bare exit reading', async () => {
        await runObjectManipulationParseHarness({
            characterId: 'CHARACTER#t',
            messageBus,
            fixtures,
            harnessInvocation: { command: 'frobnicate' },
        })

        const text = publishedText()
        expect(text).toContain('[free text]: frobnicate')
        expect(text).toContain('Route: bare exit reading only (climbs to classify)')
        expect(text).toContain('Tokens: frobnicate')
        expect(text).toContain('Readings: 1')
    })

    it('shows every segmentation Plan reads from a command the fast path claims, uncut and split', async () => {
        await runObjectManipulationParseHarness({
            characterId: 'CHARACTER#t',
            messageBus,
            fixtures,
            harnessInvocation: { command: 'take the cup on the table' },
        })

        const text = publishedText()
        expect(text).toContain('Route: fast path')
        expect(text).toContain('Skeleton: text "take" | span "the cup on the table"')
        expect(text).toContain('Skeleton: text "take" | span "the cup" | text "on" | span "the table"')
        expect(text).toContain('Attempt (membership):')
        expect(text).toContain('"predicate":"containedBy"')
    })

    it('shows an intent row\'s result, with no tokens to read', async () => {
        await runObjectManipulationParseHarness({
            characterId: 'CHARACTER#t',
            messageBus,
            fixtures,
            harnessInvocation: { command: 'look' },
        })

        const text = publishedText()
        expect(text).toContain('Route: fast path (LookRoom)')
        expect(text).not.toContain('Tokens:')
    })
})
