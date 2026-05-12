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

    it('maps remainingPlanIssues from JSON fence to handoff.planIssues (deterministic shim)', () => {
        const raw = [
            ...requiredSections,
            '',
            '```json',
            JSON.stringify({
                paragraphSummary: 'Mapped summary.',
                remainingPlanIssues: [{ code: 'ROLE_CONFLICT', summary: 'payload ordering unclear' }],
            }),
            '```',
        ].join('\n')
        expect(parsePlanSelectOutput(raw)).toEqual({
            ok: true,
            handoff: {
                paragraphSummary: 'Mapped summary.',
                planIssues: [{ code: 'ROLE_CONFLICT', summary: 'payload ordering unclear' }],
            },
        })
    })

    it('prefers remainingPlanIssues over legacy planIssues when both keys are present', () => {
        const raw = [
            ...requiredSections,
            '',
            '```json',
            JSON.stringify({
                paragraphSummary: 'Both keys.',
                remainingPlanIssues: [{ code: 'ROLE_CONFLICT', summary: 'from remaining' }],
                planIssues: [{ code: 'DIRECTION_AMBIGUOUS', summary: 'from legacy' }],
            }),
            '```',
        ].join('\n')
        expect(parsePlanSelectOutput(raw)).toEqual({
            ok: true,
            handoff: {
                paragraphSummary: 'Both keys.',
                planIssues: [{ code: 'ROLE_CONFLICT', summary: 'from remaining' }],
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

    it('parses handoff when first ```json is Phase 1 materializedCandidates scratchpad', () => {
        const phase1Scratch = JSON.stringify({
            materializedCandidates: [
                {
                    candidateId: 'candidate-1',
                    gimmick: 'test gimmick',
                    executionSummary: 'Materialized summary.',
                    tropeAssignments: { Contraption: { executionDetail: 'd', members: [] } },
                    outliers: [],
                },
            ],
        })
        const handoffObj = {
            paragraphSummary: 'Selected candidate-1: ok.',
            remainingPlanIssues: [] as Array<{ code: 'ROLE_CONFLICT'; summary: string }>,
        }
        const raw = [
            '## Materialized candidates (Phase 1)',
            '',
            '```json',
            phase1Scratch,
            '```',
            '',
            '- cleanup trace omitted for test',
            '',
            ...requiredSections,
            '',
            '```json',
            JSON.stringify(handoffObj),
            '```',
        ].join('\n')
        expect(parsePlanSelectOutput(raw)).toEqual({
            ok: true,
            handoff: {
                paragraphSummary: 'Selected candidate-1: ok.',
                planIssues: [],
            },
        })
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
                    gimmick: 'misdirection funnel',
                    executionSummary: 'Build a fake tunnel and redirect into it.',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'Paint a fake tunnel with staged boards.',
                            members: [{
                                stableKey: 'paint',
                                shortName: 'paint can',
                                room: 'CLIFFBASE',
                                tropeFunction: 'visual lure prep',
                            }],
                        },
                    },
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
                    gimmick: 'misdirection funnel',
                    executionSummary: 'Build a fake tunnel and redirect into it.',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'Paint a fake tunnel with staged boards.',
                            members: [{
                                stableKey: 'paint',
                                shortName: 'paint can',
                                room: 'CLIFFBASE',
                                tropeFunction: 'visual lure prep',
                            }],
                        },
                    },
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
                    gimmick: 'test gimmick',
                    executionSummary: 'Keep one staged lane and resolve order.',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'Set the lane first.',
                            members: [{
                                stableKey: 'anvil-0',
                                shortName: 'anvil',
                                room: 'CLIFFBASE',
                                tropeFunction: 'payload prep',
                            }],
                        },
                    },
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
                    gimmick: 'test gimmick',
                    executionSummary: 'Keep one staged lane and resolve order.',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'Set the lane first.',
                            members: [{
                                stableKey: 'anvil-0',
                                shortName: 'anvil',
                                room: 'CLIFFBASE',
                                tropeFunction: 'payload prep',
                            }],
                        },
                    },
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

    it('parses optional affordancesProvided on selectedCandidate member rows when valid', () => {
        const affordancesProvided = [{ object: 'crate lid', intended: true as const, roles: ['Contraption' as const] }]
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({
                paragraphSummary: 'x',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    gimmick: 'test gimmick',
                    executionSummary: 'Summary',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'detail',
                            members: [{
                                stableKey: 'anvil',
                                shortName: 'anvil',
                                room: 'CLIFFBASE',
                                tropeFunction: 'payload prep',
                                affordancesProvided,
                            }],
                        },
                    },
                    outliers: [],
                },
            }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r).toEqual({
            ok: true,
            handoff: {
                paragraphSummary: 'x',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    gimmick: 'test gimmick',
                    executionSummary: 'Summary',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'detail',
                            members: [{
                                stableKey: 'anvil',
                                shortName: 'anvil',
                                room: 'CLIFFBASE',
                                tropeFunction: 'payload prep',
                                affordancesProvided,
                            }],
                        },
                    },
                    outliers: [],
                },
            },
        })
    })

    it('parses optional affordancesProvided on selectedCandidate outlier rows when valid', () => {
        const affordancesProvided = [{ object: 'coil spring', roles: ['Contraption' as const] }]
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({
                paragraphSummary: 'x',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    gimmick: 'test gimmick',
                    executionSummary: 'Summary',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'detail',
                            members: [{
                                stableKey: 'skates',
                                shortName: 'skates',
                                room: 'CLIFFBASE',
                                tropeFunction: 'mobility',
                            }],
                        },
                    },
                    outliers: [{
                        stableKey: 'boulder',
                        shortName: 'boulder',
                        room: 'CLIFFBASE',
                        affordancesProvided,
                    }],
                },
            }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r).toEqual({
            ok: true,
            handoff: {
                paragraphSummary: 'x',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    gimmick: 'test gimmick',
                    executionSummary: 'Summary',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'detail',
                            members: [{
                                stableKey: 'skates',
                                shortName: 'skates',
                                room: 'CLIFFBASE',
                                tropeFunction: 'mobility',
                            }],
                        },
                    },
                    outliers: [{
                        stableKey: 'boulder',
                        shortName: 'boulder',
                        room: 'CLIFFBASE',
                        affordancesProvided,
                    }],
                },
            },
        })
    })

    it('parses optional environmentAffordances on selectedCandidate member and outlier rows when valid', () => {
        const environmentAffordances = [{ object: 'long-fall' as const, roles: ['Finishing Move' as const] }]
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({
                paragraphSummary: 'x',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    gimmick: 'test gimmick',
                    executionSummary: 'Summary',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'detail',
                            members: [{
                                stableKey: 'skates',
                                shortName: 'skates',
                                room: 'CLIFFBASE',
                                tropeFunction: 'mobility',
                                environmentAffordances,
                            }],
                        },
                    },
                    outliers: [{
                        stableKey: 'boulder',
                        shortName: 'boulder',
                        room: 'CLIFFBASE',
                        environmentAffordances: [{ object: 'rock-wall', roles: ['Finishing Move'] }],
                    }],
                },
            }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r).toEqual({
            ok: true,
            handoff: {
                paragraphSummary: 'x',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    gimmick: 'test gimmick',
                    executionSummary: 'Summary',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'detail',
                            members: [{
                                stableKey: 'skates',
                                shortName: 'skates',
                                room: 'CLIFFBASE',
                                tropeFunction: 'mobility',
                                environmentAffordances,
                            }],
                        },
                    },
                    outliers: [{
                        stableKey: 'boulder',
                        shortName: 'boulder',
                        room: 'CLIFFBASE',
                        environmentAffordances: [{ object: 'rock-wall', roles: ['Finishing Move'] }],
                    }],
                },
            },
        })
    })

    it('returns row-scoped error when environmentAffordances entry is malformed', () => {
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({
                paragraphSummary: 'x',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    gimmick: 'test gimmick',
                    executionSummary: 'Summary',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'detail',
                            members: [{
                                stableKey: 'anvil',
                                shortName: 'anvil',
                                room: 'CLIFFBASE',
                                tropeFunction: 'payload prep',
                                environmentAffordances: [{ object: 'not-a-catalog-object', roles: ['Contraption'] }],
                            }],
                        },
                    },
                    outliers: [],
                },
            }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('environmentAffordances[0]')
        }
    })

    it('returns row-scoped error when affordancesProvided entry is malformed', () => {
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({
                paragraphSummary: 'x',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    gimmick: 'test gimmick',
                    executionSummary: 'Summary',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'detail',
                            members: [{
                                stableKey: 'anvil',
                                shortName: 'anvil',
                                room: 'CLIFFBASE',
                                tropeFunction: 'payload prep',
                                affordancesProvided: [{ object: 'x', roles: [] }],
                            }],
                        },
                    },
                    outliers: [],
                },
            }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('affordancesProvided[0]')
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
                    gimmick: 'test gimmick',
                    executionSummary: 'Summary',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'detail',
                            members: [{
                                stableKey: 'anvil',
                                shortName: 'anvil',
                                room: 'CLIFFBASE',
                                tropeFunction: 9,
                            }],
                        },
                    },
                    outliers: [],
                },
            }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('selectedCandidate.tropeAssignments.Contraption.members[0].tropeFunction must be a string')
        }
    })

    it('parses materialized affordance stableKeys on selectedCandidate members', () => {
        const environmentAffordances = [{ object: 'long-fall' as const, roles: ['Finishing Move' as const] }]
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({
                paragraphSummary: 'x',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    gimmick: 'test gimmick',
                    executionSummary: 'Summary',
                    tropeAssignments: {
                        'Finishing Move': {
                            executionDetail: 'Coyote beat plus boulder payload.',
                            members: [
                                {
                                    stableKey: 'affordance:coyote',
                                    shortName: 'Coyote',
                                    room: 'CLIFFBASE',
                                    tropeFunction: 'character finishing beat',
                                },
                                {
                                    stableKey: 'affordance:boulder1',
                                    shortName: 'boulder',
                                    room: 'CLIFFBASE',
                                    tropeFunction: 'terminal impact',
                                    environmentAffordances,
                                },
                            ],
                        },
                    },
                    outliers: [],
                },
            }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r).toEqual({
            ok: true,
            handoff: {
                paragraphSummary: 'x',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    gimmick: 'test gimmick',
                    executionSummary: 'Summary',
                    tropeAssignments: {
                        'Finishing Move': {
                            executionDetail: 'Coyote beat plus boulder payload.',
                            members: [
                                {
                                    stableKey: 'affordance:coyote',
                                    shortName: 'Coyote',
                                    room: 'CLIFFBASE',
                                    tropeFunction: 'character finishing beat',
                                },
                                {
                                    stableKey: 'affordance:boulder1',
                                    shortName: 'boulder',
                                    room: 'CLIFFBASE',
                                    tropeFunction: 'terminal impact',
                                    environmentAffordances,
                                },
                            ],
                        },
                    },
                    outliers: [],
                },
            },
        })
    })

    it('narrows trimmed stableKey for materialized affordance members', () => {
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({
                paragraphSummary: 'x',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    gimmick: 'test gimmick',
                    executionSummary: 'Summary',
                    tropeAssignments: {
                        'Finishing Move': {
                            executionDetail: 'detail',
                            members: [{
                                stableKey: '  affordance:coyote  ',
                                shortName: 'Coyote',
                                room: 'CLIFFBASE',
                                tropeFunction: 'finish',
                            }],
                        },
                    },
                    outliers: [],
                },
            }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r.ok).toBe(true)
        if (r.ok && r.handoff.selectedCandidate) {
            const members = r.handoff.selectedCandidate.tropeAssignments['Finishing Move']?.members
            expect(members?.[0]?.stableKey).toBe('affordance:coyote')
        }
    })

    it('returns row-scoped error when materialized stableKey has empty suffix', () => {
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({
                paragraphSummary: 'x',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    gimmick: 'test gimmick',
                    executionSummary: 'Summary',
                    tropeAssignments: {
                        'Finishing Move': {
                            executionDetail: 'detail',
                            members: [{
                                stableKey: 'affordance:',
                                shortName: 'x',
                                room: 'CLIFFBASE',
                                tropeFunction: 'finish',
                            }],
                        },
                    },
                    outliers: [],
                },
            }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('selectedCandidate.tropeAssignments.Finishing Move.members[0].stableKey')
            expect(r.reason).toContain('non-empty suffix')
        }
    })

    it('returns row-scoped error when materialized stableKey suffix has invalid characters', () => {
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({
                paragraphSummary: 'x',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    gimmick: 'test gimmick',
                    executionSummary: 'Summary',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'detail',
                            members: [{
                                stableKey: 'affordance:boulder 2',
                                shortName: 'boulder',
                                room: 'CLIFFBASE',
                                tropeFunction: 'prep',
                            }],
                        },
                    },
                    outliers: [],
                },
            }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('selectedCandidate.tropeAssignments.Contraption.members[0].stableKey')
            expect(r.reason).toContain('suffix must contain only letters')
        }
    })

    it('rejects array-shaped selectedCandidate.tropeAssignments (hard cutover)', () => {
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({
                paragraphSummary: 'x',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    gimmick: 'test gimmick',
                    executionSummary: 'Summary',
                    tropeAssignments: [{
                        trope: 'Contraption',
                        executionDetail: 'detail',
                        members: [{
                            stableKey: 'anvil',
                            shortName: 'anvil',
                            room: 'CLIFFBASE',
                            tropeFunction: 'payload prep',
                        }],
                    }],
                    outliers: [],
                },
            }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('selectedCandidate.tropeAssignments must be a non-array object keyed by trope')
        }
    })

    it('rejects selectedCandidate.tropeAssignments with unknown trope key', () => {
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({
                paragraphSummary: 'x',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    gimmick: 'test gimmick',
                    executionSummary: 'Summary',
                    tropeAssignments: {
                        NotARealTrope: {
                            executionDetail: 'detail',
                            members: [],
                        },
                    },
                    outliers: [],
                },
            }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('selectedCandidate.tropeAssignments has invalid trope key "NotARealTrope"')
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
                    gimmick: 'test gimmick',
                    executionSummary: 'Summary',
                    tropeAssignments: {},
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

    it('parses selectedCandidate when gimmick key is omitted', () => {
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({
                paragraphSummary: 'x',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    executionSummary: 'Summary',
                    tropeAssignments: {},
                    outliers: [],
                },
            }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r).toEqual({
            ok: true,
            handoff: {
                paragraphSummary: 'x',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    executionSummary: 'Summary',
                    tropeAssignments: {},
                    outliers: [],
                },
            },
        })
    })

    it('returns error when gimmick is present but not a string', () => {
        const raw =
            `${requiredSections.join('\n')}\n\n\`\`\`json\n` +
            JSON.stringify({
                paragraphSummary: 'x',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    gimmick: 99,
                    executionSummary: 'Summary',
                    tropeAssignments: {},
                    outliers: [],
                },
            }) +
            '\n```'
        const r = parsePlanSelectOutput(raw)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.reason).toContain('selectedCandidate.gimmick must be a string when present')
        }
    })
})
