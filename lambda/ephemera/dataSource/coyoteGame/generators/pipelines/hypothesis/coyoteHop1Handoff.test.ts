import {
    COYOTE_HOP1_HANDOFF_JSON_KEYS,
    parseHop1HandoffFromSelectionBody,
} from './coyoteHop1Handoff'

describe('parseHop1HandoffFromSelectionBody', () => {
    const requiredSections = [
        '## Intent conflicts',
        '- candidate-1 may misread player intent for the shared trigger timing.',
        '## Rubric comparison',
        '- candidate-1 has stronger coverage and coherence.',
        '## Winner selection',
        '- Winner: candidate-1.',
    ]

    it('parses last ```json fence with paragraphSummary and planIssues', () => {
        const raw = [
            ...requiredSections,
            '',
            '```json',
            JSON.stringify({
                [COYOTE_HOP1_HANDOFF_JSON_KEYS.paragraphSummary]:
                    'Use the cliff and anvil together in one trap.',
                [COYOTE_HOP1_HANDOFF_JSON_KEYS.planIssues]: ['stableKey ROCK has no role yet'],
            }),
            '```',
        ].join('\n')
        expect(parseHop1HandoffFromSelectionBody(raw)).toEqual({
            ok: true,
            handoff: {
                paragraphSummary: 'Use the cliff and anvil together in one trap.',
                planIssues: ['stableKey ROCK has no role yet'],
            },
        })
    })

    it('uses last json fence when multiple ```json blocks exist', () => {
        const inner = JSON.stringify({
            paragraphSummary: 'Chosen plan.',
            planIssues: [],
        })
        const raw = `${requiredSections.join('\n')}\n\n\`\`\`json\n${inner}\n\`\`\`\n\nMiddle.\n\n\`\`\`json\n${JSON.stringify({
            paragraphSummary: 'Later handoff wins.',
            planIssues: ['gap'],
        })}\n\`\`\``
        const r = parseHop1HandoffFromSelectionBody(raw)
        expect(r.ok && r.handoff.paragraphSummary).toBe('Later handoff wins.')
        expect(r.ok && r.handoff.planIssues).toEqual(['gap'])
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
                    planIssues: [],
                    extra: 'bad',
                })}\n\`\`\``
            ).ok
        ).toBe(true)
    })

    it('returns error when planIssues is not string array', () => {
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({ paragraphSummary: 'x', planIssues: [1, 2] }) +
            '\n```'
        const r = parseHop1HandoffFromSelectionBody(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('array of strings')
        }
    })

    it('returns error when intent conflicts section is missing', () => {
        const raw = [
            '## Rubric comparison',
            '- candidate-1 is best.',
            '## Winner selection',
            '- Winner: candidate-1.',
            '```json',
            JSON.stringify({ paragraphSummary: 'x', planIssues: [] }),
            '```',
        ].join('\n')
        const r = parseHop1HandoffFromSelectionBody(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('## Intent conflicts')
        }
    })

    it('returns error when rubric comparison section is missing', () => {
        const raw = [
            '## Intent conflicts',
            '- conflict',
            '## Winner selection',
            '- Winner: candidate-1.',
            '```json',
            JSON.stringify({ paragraphSummary: 'x', planIssues: [] }),
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
            '## Intent conflicts',
            '- conflict',
            '## Rubric comparison',
            '- compare',
            '```json',
            JSON.stringify({ paragraphSummary: 'x', planIssues: [] }),
            '```',
        ].join('\n')
        const r = parseHop1HandoffFromSelectionBody(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('## Winner selection')
        }
    })
})
