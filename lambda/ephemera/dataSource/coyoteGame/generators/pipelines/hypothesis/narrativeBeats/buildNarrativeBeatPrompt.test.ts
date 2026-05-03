import { buildNarrativeBeatPrompt } from './buildNarrativeBeatPrompt'
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
        expect(full).toContain('## Committed plan')
        expect(full).toContain('## Committed plan Markdown (how to read the grounding block)')
        expect(full).not.toContain('## Combined clustering')
        expect(parts.dynamicSuffix).not.toContain('## Combined clustering')
        expect(parts.dynamicSuffix).not.toContain('### Candidate')
        expect(full).toContain('candidateId: candidate-1')
    })

    it('keeps phase-plan prompt content unchanged when staged trope environmentAffordances are present', () => {
        const parts = buildNarrativeBeatPrompt({
            roomObjectsByRoom: {
                'ROOM#VORTEX': [{
                    uuid: 'OBJECT#anvil' as `OBJECT#${string}`,
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
