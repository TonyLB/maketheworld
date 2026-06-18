import {
    buildNarrativeBeatPrompt,
    NARRATIVE_BEAT_NO_GIMMICK_HANDOFF_LINE,
} from './buildNarrativeBeatPrompt'
import { harnessRoomObjects } from '../../../testHarness/coyoteEngineTestFixtures'

describe('buildNarrativeBeatPrompt', () => {
    it('embeds committed plan and seam mapping Markdown', () => {
        const parts = buildNarrativeBeatPrompt({
            roomObjectsByRoom: { 'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']) },
            planSelectOutput: {
                paragraphSummary: 'Summary line.',
                planIssues: [{ code: 'ROLE_CONFLICT', summary: 'gap a' }],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    executionSummary: 'Summary.',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'Detail.',
                            members: [{
                                stableKey: 'anvil-0',
                                shortName: 'anvil',
                                room: 'CLIFFBASE',
                                tropeFunction: 'job',
                            }],
                        },
                    },
                    outliers: [],
                },
            },
        })
        const full = parts.invariantPrefix + parts.dynamicSuffix
        expect(full).toContain('Summary line.')
        expect(full).toContain('gap a')
        expect(full).toContain('plan issues')
        expect(full).toContain('Treat every plan issue as an actionable grounding constraint')
        expect(full).toContain('Intent-signal issue codes')
        expect(full).toContain('Underspecification codes')
        expect(full).toContain('```json')
        expect(full).toContain('## Cartoon play-by-play')
        expect(full).toContain('**`beats`**')
        expect(full).toContain('**`linearizedSequence`**')
        expect(full).toContain('must not include post-plan reversal or aftermath')
        expect(full).not.toContain('tropeSequence')
        expect(full).not.toContain('deconflictionSummary')
        expect(full).not.toContain('**`phases`**')
        expect(full).toContain('## Committed plan')
        expect(full).toContain('## Committed plan Markdown (how to read the grounding block)')
        expect(full).not.toContain('## Combined clustering')
        expect(parts.dynamicSuffix).not.toContain('## Combined clustering')
        expect(parts.dynamicSuffix).not.toContain('### Candidate')
        expect(full).toContain('candidateId: candidate-1')
        expect(full).toContain(NARRATIVE_BEAT_NO_GIMMICK_HANDOFF_LINE)
        expect(full).toContain('When **## Committed plan** lists a **gimmick** line')
        expect(full).toContain('Keep beat ordering and prose aligned with the committed spine')
    })

    it('embeds gimmick line when selectedCandidate includes gimmick', () => {
        const parts = buildNarrativeBeatPrompt({
            roomObjectsByRoom: { 'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']) },
            planSelectOutput: {
                paragraphSummary: 'Summary line.',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    gimmick: 'high speed chase',
                    executionSummary: 'Summary.',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'Detail.',
                            members: [{
                                stableKey: 'anvil-0',
                                shortName: 'anvil',
                                room: 'CLIFFBASE',
                                tropeFunction: 'job',
                            }],
                        },
                    },
                    outliers: [],
                },
            },
        })
        const full = parts.invariantPrefix + parts.dynamicSuffix
        expect(full).toContain('- gimmick: high speed chase')
        expect(full).not.toContain(NARRATIVE_BEAT_NO_GIMMICK_HANDOFF_LINE)
    })

    it('uses fallback spine cue when gimmick is whitespace only', () => {
        const parts = buildNarrativeBeatPrompt({
            roomObjectsByRoom: { 'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']) },
            planSelectOutput: {
                paragraphSummary: 'Summary line.',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    gimmick: '   ',
                    executionSummary: 'Summary.',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'Detail.',
                            members: [{
                                stableKey: 'anvil-0',
                                shortName: 'anvil',
                                room: 'CLIFFBASE',
                                tropeFunction: 'job',
                            }],
                        },
                    },
                    outliers: [],
                },
            },
        })
        const full = parts.invariantPrefix + parts.dynamicSuffix
        expect(full).toContain(NARRATIVE_BEAT_NO_GIMMICK_HANDOFF_LINE)
        expect(full).not.toMatch(/- gimmick:\s+\S/)
    })

    it('does not invent drop-ready wording when staged trope environmentAffordances are present', () => {
        const parts = buildNarrativeBeatPrompt({
            roomObjectsByRoom: {
                'ROOM#VORTEX': [{
                    objectId: 'OBJECT#anvil' as `OBJECT#${string}`,
                    shortName: 'anvil',
                    stableKey: 'anvil',
                    tropeAffinities: [{
                        trope: 'Finishing Move',
                        aptness: 'High',
                        narrowing: 'terminal payload',
                        environmentAffordances: [{ object: 'boulder', roles: ['Contraption'] }],
                    }],
                }],
            },
            planSelectOutput: {
                paragraphSummary: 'Summary line.',
                planIssues: [{ code: 'ROLE_CONFLICT', summary: 'gap a' }],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    executionSummary: 'Summary.',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'Detail.',
                            members: [{
                                stableKey: 'anvil',
                                shortName: 'anvil',
                                room: 'CLIFFBASE',
                                tropeFunction: 'job',
                            }],
                        },
                    },
                    outliers: [],
                },
            },
        })
        const full = parts.invariantPrefix + parts.dynamicSuffix
        expect(full).toContain('member: anvil | anvil | CLIFFBASE | job')
        expect(full).not.toContain('drop-ready')
    })

    it('includes iconic few-shot beats by default', () => {
        const parts = buildNarrativeBeatPrompt({
            roomObjectsByRoom: { 'ROOM#STRAIGHTAWAY': harnessRoomObjects('straightaway', ['rocket skates']) },
            planSelectOutput: {
                paragraphSummary: 'Summary.',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    gimmick: 'high speed chase',
                    executionSummary: 'Chase spine.',
                    tropeAssignments: {},
                    outliers: [],
                },
            },
        })
        expect(parts.invariantPrefix).toContain('rocket-skates-0')
        expect(parts.invariantPrefix).toContain('portable-hole-0')
        expect(parts.invariantPrefix).toContain('chemistry-set')
    })

    it('omits iconic few-shot when includeIconicFewShots is false', () => {
        const parts = buildNarrativeBeatPrompt({
            includeIconicFewShots: false,
            roomObjectsByRoom: { 'ROOM#STRAIGHTAWAY': harnessRoomObjects('straightaway', ['rocket skates']) },
            planSelectOutput: {
                paragraphSummary: 'Summary.',
                planIssues: [],
                selectedCandidate: {
                    candidateId: 'candidate-1',
                    gimmick: 'high speed chase',
                    executionSummary: 'Chase spine.',
                    tropeAssignments: {},
                    outliers: [],
                },
            },
        })
        expect(parts.invariantPrefix).toContain('chemistry-set')
        expect(parts.invariantPrefix).not.toContain('Iconic genre examples')
        expect(parts.invariantPrefix).not.toContain('portable-hole-0')
    })

    it('renders structured selectedCandidate grounding when present', () => {
        const parts = buildNarrativeBeatPrompt({
            roomObjectsByRoom: { 'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil', 'rope']) },
            planSelectOutput: {
                paragraphSummary: 'Summary line.',
                planIssues: [{ code: 'ROLE_CONFLICT', summary: 'gap a' }],
                selectedCandidate: {
                    candidateId: 'candidate-2',
                    executionSummary: 'Use anvil as staged payload and rope as fallback.',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'Rig anvil release timing.',
                            members: [{
                                stableKey: 'anvil-0',
                                shortName: 'anvil',
                                room: 'CLIFFBASE',
                                tropeFunction: 'payload rig',
                            }],
                        },
                    },
                    outliers: [{
                        stableKey: 'rope-1',
                        shortName: 'rope',
                        room: 'CLIFFBASE',
                    }],
                },
            },
        })
        const full = parts.invariantPrefix + parts.dynamicSuffix
        expect(full).toContain('**Selected candidate (authoritative winner payload):**')
        expect(full).toContain('candidateId: candidate-2')
        expect(full).toContain('executionSummary: Use anvil as staged payload and rope as fallback.')
        expect(full).toContain('trope: Contraption')
        expect(full).toContain('member: anvil-0 | anvil | CLIFFBASE | payload rig')
        expect(full).toContain('rope-1 | rope | CLIFFBASE')
    })
})
