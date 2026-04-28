import {
    COYOTE_HOP1_HANDOFF_JSON_KEYS,
    parseHop1HandoffFromSelectionBody,
} from './coyoteHop1Handoff'

describe('parseHop1HandoffFromSelectionBody', () => {
    const requiredSections = [
        '## Conflict catalog',
        '- candidate-1 conflicts with candidate-2 over shared trigger timing.',
        '## Rubric comparison',
        '- candidate-1 has stronger coverage and coherence.',
        '## Winner selection',
        '- Winner: candidate-1.',
    ]

    it('parses last ```json fence with paragraphSummary and rubricIssues', () => {
        const raw = [
            ...requiredSections,
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
        const raw = `${requiredSections.join('\n')}\n\n\`\`\`json\n${inner}\n\`\`\`\n\nMiddle.\n\n\`\`\`json\n${JSON.stringify({
            paragraphSummary: 'Later handoff wins.',
            rubricIssues: ['gap'],
        })}\n\`\`\``
        const r = parseHop1HandoffFromSelectionBody(raw)
        expect(r.ok && r.handoff.paragraphSummary).toBe('Later handoff wins.')
        expect(r.ok && r.handoff.rubricIssues).toEqual(['gap'])
    })

    it('returns error when no ```json fence', () => {
        const r = parseHop1HandoffFromSelectionBody(`${requiredSections.join('\n')}\n\n\`\`\`text\nplain\n\`\`\``)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('json')
        }
    })

    it('returns error on invalid JSON inside fence', () => {
        const raw = `${requiredSections.join('\n')}\n\n\`\`\`json\n{\n\`\`\``
        const r = parseHop1HandoffFromSelectionBody(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('invalid JSON')
        }
    })

    it('returns error when required keys are missing', () => {
        expect(
            parseHop1HandoffFromSelectionBody(
                `${requiredSections.join('\n')}\n\n\`\`\`json\n${JSON.stringify({ paragraphSummary: 'x' })}\n\`\`\``
            ).ok
        ).toBe(false)
    })

    it('allows additional keys when required keys are present', () => {
        expect(
            parseHop1HandoffFromSelectionBody(
                `${requiredSections.join('\n')}\n\n\`\`\`json\n${JSON.stringify({
                    paragraphSummary: 'x',
                    rubricIssues: [],
                    extra: 'bad',
                })}\n\`\`\``
            ).ok
        ).toBe(true)
    })

    it('returns error when rubricIssues is not string array', () => {
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({ paragraphSummary: 'x', rubricIssues: [1, 2] }) +
            '\n```'
        const r = parseHop1HandoffFromSelectionBody(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('array of strings')
        }
    })

    it('returns error when conflict catalog section is missing', () => {
        const raw = [
            '## Rubric comparison',
            '- candidate-1 is best.',
            '## Winner selection',
            '- Winner: candidate-1.',
            '```json',
            JSON.stringify({ paragraphSummary: 'x', rubricIssues: [] }),
            '```',
        ].join('\n')
        const r = parseHop1HandoffFromSelectionBody(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('## Conflict catalog')
        }
    })

    it('returns error when rubric comparison section is missing', () => {
        const raw = [
            '## Conflict catalog',
            '- conflict',
            '## Winner selection',
            '- Winner: candidate-1.',
            '```json',
            JSON.stringify({ paragraphSummary: 'x', rubricIssues: [] }),
            '```',
        ].join('\n')
        const r = parseHop1HandoffFromSelectionBody(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('## Rubric comparison')
        }
    })

    it('returns error when winner selection section is missing', () => {
        const raw = [
            '## Conflict catalog',
            '- conflict',
            '## Rubric comparison',
            '- compare',
            '```json',
            JSON.stringify({ paragraphSummary: 'x', rubricIssues: [] }),
            '```',
        ].join('\n')
        const r = parseHop1HandoffFromSelectionBody(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('## Winner selection')
        }
    })
})
