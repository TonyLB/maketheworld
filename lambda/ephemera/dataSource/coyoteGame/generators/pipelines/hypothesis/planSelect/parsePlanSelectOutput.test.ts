import {
    PLAN_SELECT_OUTPUT_JSON_KEYS,
    parsePlanSelectOutput,
} from './parsePlanSelectOutput'

describe('parsePlanSelectOutput', () => {
    const requiredSections = [
        '## Intent conflicts',
        '- candidate-1 may misread player intent for the shared trigger timing.',
        '## Rubric comparison',
        '- candidate-1 has stronger coverage and coherence.',
        '## Winner selection',
        '- Winner: candidate-1.',
    ]

    it('parses last ```json fence with paragraphSummary and structured planIssues', () => {
        const raw = [
            ...requiredSections,
            '',
            '```json',
            JSON.stringify({
                [PLAN_SELECT_OUTPUT_JSON_KEYS.paragraphSummary]:
                    'Use the cliff and anvil together in one trap.',
                [PLAN_SELECT_OUTPUT_JSON_KEYS.planIssues]: [{
                    code: 'OUTLIER_PROP_UNACCOUNTED',
                    summary: 'stableKey ROCK has no role yet',
                }],
            }),
            '```',
        ].join('\n')
        expect(parsePlanSelectOutput(raw)).toEqual({
            ok: true,
            handoff: {
                paragraphSummary: 'Use the cliff and anvil together in one trap.',
                planIssues: [{
                    code: 'OUTLIER_PROP_UNACCOUNTED',
                    summary: 'stableKey ROCK has no role yet',
                }],
            },
        })
    })

    it('uses last json fence when multiple ```json blocks exist', () => {
        const inner = JSON.stringify({
            paragraphSummary: 'Chosen plan.',
            planIssues: [{ code: 'DIRECTION_AMBIGUOUS', summary: 'Need clearer order.' }],
        })
        const raw = `${requiredSections.join('\n')}\n\n\`\`\`json\n${inner}\n\`\`\`\n\nMiddle.\n\n\`\`\`json\n${JSON.stringify({
            paragraphSummary: 'Later handoff wins.',
            planIssues: [{ code: 'ROLE_CONFLICT', summary: 'gap' }],
        })}\n\`\`\``
        const r = parsePlanSelectOutput(raw)
        expect(r.ok && r.handoff.paragraphSummary).toBe('Later handoff wins.')
        expect(r.ok && r.handoff.planIssues).toEqual([{ code: 'ROLE_CONFLICT', summary: 'gap' }])
    })

    it('parses optional selectedCandidate payload when present', () => {
        const raw = [
            ...requiredSections,
            '',
            '```json',
            JSON.stringify({
                paragraphSummary: 'Selected candidate-2: build a staged fake tunnel detour.',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-2',
                    executionSummary: 'Build a fake tunnel and redirect into it.',
                    tropeAssignments: [{
                        trope: 'Contraption',
                        executionDetail: 'Paint a fake tunnel with staged boards.',
                        members: [{
                            stableKey: 'paint',
                            shortName: 'paint can',
                            room: 'CLIFFBASE',
                            tropeFunction: 'visual lure prep',
                        }],
                    }],
                    outliers: [{
                        stableKey: 'rope',
                        shortName: 'rope',
                        room: 'CLIFFBASE',
                    }],
                },
            }),
            '```',
        ].join('\n')
        expect(parsePlanSelectOutput(raw)).toEqual({
            ok: true,
            handoff: {
                paragraphSummary: 'Selected candidate-2: build a staged fake tunnel detour.',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-2',
                    executionSummary: 'Build a fake tunnel and redirect into it.',
                    tropeAssignments: [{
                        trope: 'Contraption',
                        executionDetail: 'Paint a fake tunnel with staged boards.',
                        members: [{
                            stableKey: 'paint',
                            shortName: 'paint can',
                            room: 'CLIFFBASE',
                            tropeFunction: 'visual lure prep',
                        }],
                    }],
                    outliers: [{
                        stableKey: 'rope',
                        shortName: 'rope',
                        room: 'CLIFFBASE',
                    }],
                },
            },
        })
    })

    it('returns error when no ```json fence', () => {
        const r = parsePlanSelectOutput(`${requiredSections.join('\n')}\n\n\`\`\`text\nplain\n\`\`\``)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('json')
        }
    })

    it('returns error on invalid JSON inside fence', () => {
        const raw = `${requiredSections.join('\n')}\n\n\`\`\`json\n{\n\`\`\``
        const r = parsePlanSelectOutput(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('invalid JSON')
        }
    })

    it('returns error when required keys are missing', () => {
        expect(
            parsePlanSelectOutput(
                `${requiredSections.join('\n')}\n\n\`\`\`json\n${JSON.stringify({ paragraphSummary: 'x' })}\n\`\`\``
            ).ok
        ).toBe(false)
    })

    it('keeps legacy handoff valid with only required v1 keys', () => {
        const r = parsePlanSelectOutput(
            `${requiredSections.join('\n')}\n\n\`\`\`json\n${JSON.stringify({
                paragraphSummary: 'Legacy summary still accepted.',
                planIssues: [],
            })}\n\`\`\``
        )
        expect(r).toEqual({
            ok: true,
            handoff: {
                paragraphSummary: 'Legacy summary still accepted.',
                planIssues: [],
            },
        })
    })

    it('allows additional keys when required keys are present', () => {
        expect(
            parsePlanSelectOutput(
                `${requiredSections.join('\n')}\n\n\`\`\`json\n${JSON.stringify({
                    paragraphSummary: 'x',
                    planIssues: [{
                        code: 'DIRECTION_AMBIGUOUS',
                        summary: 'x',
                        extraIssueField: 'still tolerated',
                    }],
                    extra: 'bad',
                })}\n\`\`\``
            ).ok
        ).toBe(true)
    })

    it('accepts mixed legacy/new handoff fields with selectedCandidate plus tolerated extras', () => {
        const r = parsePlanSelectOutput(
            `${requiredSections.join('\n')}\n\n\`\`\`json\n${JSON.stringify({
                paragraphSummary: 'Selected candidate-1: keep the lane coherent.',
                planIssues: [{ code: 'ROLE_CONFLICT', summary: 'clarify payload order' }],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    executionSummary: 'Keep one staged lane and resolve order.',
                    tropeAssignments: [{
                        trope: 'Contraption',
                        executionDetail: 'Set the lane first.',
                        members: [{
                            stableKey: 'anvil-0',
                            shortName: 'anvil',
                            room: 'CLIFFBASE',
                            tropeFunction: 'payload prep',
                        }],
                    }],
                    outliers: [],
                },
                nonAuthoritativeNote: 'still tolerated',
            })}\n\`\`\``
        )
        expect(r).toEqual({
            ok: true,
            handoff: {
                paragraphSummary: 'Selected candidate-1: keep the lane coherent.',
                planIssues: [{ code: 'ROLE_CONFLICT', summary: 'clarify payload order' }],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    executionSummary: 'Keep one staged lane and resolve order.',
                    tropeAssignments: [{
                        trope: 'Contraption',
                        executionDetail: 'Set the lane first.',
                        members: [{
                            stableKey: 'anvil-0',
                            shortName: 'anvil',
                            room: 'CLIFFBASE',
                            tropeFunction: 'payload prep',
                        }],
                    }],
                    outliers: [],
                },
            },
        })
    })

    it('returns error when planIssues row is not an object', () => {
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({ paragraphSummary: 'x', planIssues: [1, 2] }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('planIssues[0] must be a plain object')
        }
    })

    it('returns error when planIssues row is missing code', () => {
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({ paragraphSummary: 'x', planIssues: [{ summary: 'missing code' }] }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('missing required key: code')
        }
    })

    it('returns error when planIssues code is unknown', () => {
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({ paragraphSummary: 'x', planIssues: [{ code: 'NOT_REAL', summary: 'bad' }] }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('code must be one of')
        }
    })

    it('returns error when planIssues row is missing summary', () => {
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({ paragraphSummary: 'x', planIssues: [{ code: 'ROLE_CONFLICT' }] }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('missing required key: summary')
        }
    })

    it('returns error when planIssues summary is not a string', () => {
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({ paragraphSummary: 'x', planIssues: [{ code: 'ROLE_CONFLICT', summary: 1 }] }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('summary must be a string')
        }
    })

    it('returns error when evidence is not a string array', () => {
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({
                paragraphSummary: 'x',
                planIssues: [{ code: 'ROLE_CONFLICT', summary: 'bad evidence', evidence: [1] }],
            }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('evidence must be an array of strings')
        }
    })

    it('returns row-scoped error when selectedCandidate trope member field is invalid', () => {
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({
                paragraphSummary: 'x',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    executionSummary: 'Summary',
                    tropeAssignments: [{
                        trope: 'Contraption',
                        executionDetail: 'detail',
                        members: [{
                            stableKey: 'anvil',
                            shortName: 'anvil',
                            room: 'CLIFFBASE',
                            tropeFunction: 9,
                        }],
                    }],
                    outliers: [],
                },
            }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('selectedCandidate.tropeAssignments[0].members[0].tropeFunction must be a string')
        }
    })

    it('returns row-scoped error when selectedCandidate outlier row is malformed', () => {
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({
                paragraphSummary: 'x',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    executionSummary: 'Summary',
                    tropeAssignments: [],
                    outliers: [{ stableKey: 'anvil' }],
                },
            }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('selectedCandidate.outliers[0].shortName must be a string')
        }
    })

    it('continues parsing when intent conflicts section is missing', () => {
        const raw = [
            '## Rubric comparison',
            '- candidate-1 is best.',
            '## Winner selection',
            '- Winner: candidate-1.',
            '```json',
            JSON.stringify({ paragraphSummary: 'x', planIssues: [] }),
            '```',
        ].join('\n')
        expect(parsePlanSelectOutput(raw)).toEqual({
            ok: true,
            handoff: { paragraphSummary: 'x', planIssues: [] },
        })
    })

    it('continues parsing when rubric comparison section is missing', () => {
        const raw = [
            '## Intent conflicts',
            '- conflict',
            '## Winner selection',
            '- Winner: candidate-1.',
            '```json',
            JSON.stringify({ paragraphSummary: 'x', planIssues: [] }),
            '```',
        ].join('\n')
        expect(parsePlanSelectOutput(raw)).toEqual({
            ok: true,
            handoff: { paragraphSummary: 'x', planIssues: [] },
        })
    })

    it('accepts single-candidate non-comparative rubric section when heading is present', () => {
        const raw = [
            '## Intent conflicts',
            '- candidate-1 has one unresolved prop-role mismatch.',
            '## Rubric comparison',
            '- candidate-1: baseline checks pass for a solo-candidate run.',
            '## Winner selection',
            '- Winner: candidate-1.',
            '```json',
            JSON.stringify({
                paragraphSummary: 'Selected candidate-1: keep the staged lane and resolve mismatch.',
                planIssues: [{ code: 'TROPE_FUNCTION_MISMATCH', summary: 'anvil role text conflicts with summary verb' }],
            }),
            '```',
        ].join('\n')
        expect(parsePlanSelectOutput(raw)).toEqual({
            ok: true,
            handoff: {
                paragraphSummary: 'Selected candidate-1: keep the staged lane and resolve mismatch.',
                planIssues: [{ code: 'TROPE_FUNCTION_MISMATCH', summary: 'anvil role text conflicts with summary verb' }],
            },
        })
    })

    it('continues parsing when winner selection section is missing', () => {
        const raw = [
            '## Intent conflicts',
            '- conflict',
            '## Rubric comparison',
            '- compare',
            '```json',
            JSON.stringify({ paragraphSummary: 'x', planIssues: [] }),
            '```',
        ].join('\n')
        expect(parsePlanSelectOutput(raw)).toEqual({
            ok: true,
            handoff: { paragraphSummary: 'x', planIssues: [] },
        })
    })

    it('accepts required section headings with case/spacing variation', () => {
        const raw = [
            '##   intent conflicts  ',
            '- conflict',
            '##RUBRIC COMPARISON',
            '- compare',
            '##   Winner Selection',
            '- Winner: candidate-1.',
            '```json',
            JSON.stringify({ paragraphSummary: 'x', planIssues: [] }),
            '```',
        ].join('\n')
        expect(parsePlanSelectOutput(raw)).toEqual({
            ok: true,
            handoff: {
                paragraphSummary: 'x',
                planIssues: [],
            },
        })
    })

    it('accepts required sections when intent conflicts is emitted as a level-3 heading', () => {
        const raw = [
            '### Intent conflicts',
            '- mismatch evidence',
            '## Rubric comparison',
            '**candidate-1:** only candidate present.',
            '## Winner selection',
            'Winner: candidate-1',
            '```json',
            JSON.stringify({ paragraphSummary: 'Selected candidate-1: summary.', planIssues: [] }),
            '```',
        ].join('\n')
        expect(parsePlanSelectOutput(raw)).toEqual({
            ok: true,
            handoff: {
                paragraphSummary: 'Selected candidate-1: summary.',
                planIssues: [],
            },
        })
    })
})
