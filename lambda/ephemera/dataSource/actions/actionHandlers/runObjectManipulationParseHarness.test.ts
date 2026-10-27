import messageBus from '../../../messageBus'
import { isPublishMessage, isPublishWorldLineMessage } from '../../../messageBus/baseClasses'
import type { ObjectManipulationParseHarnessFixture } from '../baseClasses'
import type { ParseStageResult } from '../enrich/objectManipulation/parse/runParseStage'
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

const skeletons: Record<string, ParseStageResult> = {
    'carefully get the cup on the table': {
        type: 'success',
        tokens: [
            { type: 'text', text: 'get' },
            { type: 'objectSpan', span: 'cup on the table', stableRefKey: 'ref-1' },
        ],
    },
}

describe('runObjectManipulationParseHarness', () => {
    const runParseStageImpl = jest.fn(async ({ command }: { command: string }) =>
        skeletons[command] ?? { type: 'error' as const, errorMessage: 'no parse' })
    // A manner word keeps a `get` off the fast path, so it reaches Parse; a `put` is claimed.

    beforeEach(() => {
        jest.clearAllMocks()
        mockMessageBus.publish.mockReturnValue(undefined)
    })

    it('runs every fixture and publishes one OOC message with tokens, segmentations and attempts', async () => {
        await runObjectManipulationParseHarness({
            characterId: 'CHARACTER#t',
            messageBus,
            fixtures,
            runParseStageImpl,
            now: () => 0,
        })

        expect(runParseStageImpl).toHaveBeenCalledTimes(1)
        const text = publishedText()
        expect(text).toContain('--- 1/2 [1] C1: carefully get the cup on the table ---')
        expect(text).toContain('Route: LLM (Parse)')
        expect(text).toContain('Parse: text "get" | span "cup on the table"')
        // Parse's words are re-tokenized: its span is cut at "on", and every segmentation is read.
        expect(text).toContain('Tokens: get | cup | on | the | table')
        expect(text).toContain('Skeleton: text "get" | span "cup on the table"')
        expect(text).toContain('Skeleton: text "get" | span "cup" | text "on" | span "the table"')
        expect(text).toContain('Attempt (membership):')
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
            runParseStageImpl,
            now: () => 0,
        })

        expect(runParseStageImpl).not.toHaveBeenCalled()
        expect(publishedText()).toContain('--- 1/1 [2] C4: put the bag in the box ---')
    })

    it('runs free text and reports a Parse error without planning', async () => {
        await runObjectManipulationParseHarness({
            characterId: 'CHARACTER#t',
            messageBus,
            fixtures,
            harnessInvocation: { command: 'frobnicate' },
            runParseStageImpl,
            now: () => 0,
        })

        expect(runParseStageImpl).toHaveBeenCalledWith({ command: 'frobnicate' })
        const text = publishedText()
        expect(text).toContain('[free text]: frobnicate')
        expect(text).toContain('Parse error: no parse')
        expect(text).not.toContain('Tokens:')
    })

    it('shows every segmentation Plan reads from a command the fast path claims, uncut and split, with no Parse call', async () => {
        await runObjectManipulationParseHarness({
            characterId: 'CHARACTER#t',
            messageBus,
            fixtures,
            harnessInvocation: { command: 'take the cup on the table' },
            runParseStageImpl,
            now: () => 0,
        })

        expect(runParseStageImpl).not.toHaveBeenCalled()
        const text = publishedText()
        expect(text).toContain('Route: fast path')
        expect(text).toContain('Skeleton: text "take" | span "the cup on the table"')
        expect(text).toContain('Skeleton: text "take" | span "the cup" | text "on" | span "the table"')
        expect(text).toContain('Attempt (membership):')
        expect(text).toContain('"predicate":"containedBy"')
    })
})
