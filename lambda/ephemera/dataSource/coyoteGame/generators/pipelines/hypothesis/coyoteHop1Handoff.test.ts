import {
    COYOTE_HOP1_HANDOFF_JSON_KEYS,
    parseHop1HandoffFromSelectionBody,
} from './coyoteHop1Handoff'

describe('parseHop1HandoffFromSelectionBody', () => {
    it('parses last ```json fence with paragraphSummary and rubricIssues', () => {
        const raw = [
            '## Scene analysis',
            'Short.',
            '',
            'Some matrix prose…',
            '',
            '```json',
            JSON.stringify({
                [COYOTE_HOP1_HANDOFF_JSON_KEYS.paragraphSummary]:
                    'Use the cliff and anvil together in one trap.',
                [COYOTE_HOP1_HANDOFF_JSON_KEYS.rubricIssues]: ['stableKey ROCK has no role yet'],
            }),
            '```',
        ].join('\n')
        expect(parseHop1HandoffFromSelectionBody(raw)).toEqual({
            ok: true,
            handoff: {
                paragraphSummary: 'Use the cliff and anvil together in one trap.',
                rubricIssues: ['stableKey ROCK has no role yet'],
            },
        })
    })

    it('uses last json fence when multiple ```json blocks exist', () => {
        const inner = JSON.stringify({
            paragraphSummary: 'Chosen plan.',
            rubricIssues: [],
        })
        const raw = `\`\`\`json\n${inner}\n\`\`\`\n\nMiddle.\n\n\`\`\`json\n${JSON.stringify({
            paragraphSummary: 'Later handoff wins.',
            rubricIssues: ['gap'],
        })}\n\`\`\``
        const r = parseHop1HandoffFromSelectionBody(raw)
        expect(r.ok && r.handoff.paragraphSummary).toBe('Later handoff wins.')
        expect(r.ok && r.handoff.rubricIssues).toEqual(['gap'])
    })

    it('returns error when no ```json fence', () => {
        const r = parseHop1HandoffFromSelectionBody('```text\nplain\n```')
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('json')
        }
    })

    it('returns error on invalid JSON inside fence', () => {
        const raw = '```json\n{\n```'
        const r = parseHop1HandoffFromSelectionBody(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('invalid JSON')
        }
    })

    it('returns error when keys are missing or extra', () => {
        expect(
            parseHop1HandoffFromSelectionBody(
                '```json\n' + JSON.stringify({ paragraphSummary: 'x' }) + '\n```'
            ).ok
        ).toBe(false)
        expect(
            parseHop1HandoffFromSelectionBody(
                '```json\n' +
                    JSON.stringify({
                        paragraphSummary: 'x',
                        rubricIssues: [],
                        extra: 'bad',
                    }) +
                    '\n```'
            ).ok
        ).toBe(false)
    })

    it('returns error when rubricIssues is not string array', () => {
        const raw =
            '```json\n' +
            JSON.stringify({ paragraphSummary: 'x', rubricIssues: [1, 2] }) +
            '\n```'
        const r = parseHop1HandoffFromSelectionBody(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('array of strings')
        }
    })
})
