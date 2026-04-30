import { buildHypothesisPhasePlanHopPromptParts } from './buildHypothesisPhasePlanHopPromptParts'
import { harnessRoomObjects } from '../../testHarness/coyoteEngineTestFixtures'

describe('buildHypothesisPhasePlanHopPromptParts', () => {
    it('embeds hop-1 handoff and combined clustering Markdown from combined payload', () => {
        const parts = buildHypothesisPhasePlanHopPromptParts({
            roomObjectsByRoom: { 'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']) },
            combined: {
                candidates: [
                    {
                        candidateId: 'candidate-1',
                        executionSummary: 'Summary.',
                        tropeAssignments: [
                            {
                                trope: 'Contraption',
                                executionDetail: 'Detail.',
                                members: [{ identifier: 'anvil-0', tropeFunction: 'job' }],
                            },
                        ],
                        outliers: [],
                    },
                ],
            },
            hop1Handoff: {
                paragraphSummary: 'Summary line.',
                planIssues: [{ code: 'ROLE_CONFLICT', summary: 'gap a' }],
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
        expect(full).toContain('## Combined clustering')
        expect(full).toContain('Candidate candidate-1')
        expect(full).toContain('Selected candidate')
        expect(full).toContain('not provided; use chosen plan summary and plan issues as fallback grounding')
    })

    it('keeps phase-plan prompt content unchanged when staged trope environmentAffordances are present', () => {
        const parts = buildHypothesisPhasePlanHopPromptParts({
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
            combined: {
                candidates: [{
                    candidateId: 'candidate-1',
                    executionSummary: 'Summary.',
                    tropeAssignments: [{
                        trope: 'Contraption',
                        executionDetail: 'Detail.',
                        members: [{ identifier: 'anvil', tropeFunction: 'job' }],
                    }],
                    outliers: [],
                }],
            },
            hop1Handoff: {
                paragraphSummary: 'Summary line.',
                planIssues: [{ code: 'ROLE_CONFLICT', summary: 'gap a' }],
            },
        })
        const full = parts.invariantPrefix + parts.dynamicSuffix
        expect(full).toContain('Candidate candidate-1')
        expect(full).toContain('stableKey:** anvil')
        expect(full).not.toContain('drop-ready')
    })

    it('renders structured selectedCandidate grounding when present', () => {
        const parts = buildHypothesisPhasePlanHopPromptParts({
            roomObjectsByRoom: { 'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil', 'rope']) },
            combined: {
                candidates: [{
                    candidateId: 'candidate-1',
                    executionSummary: 'Summary.',
                    tropeAssignments: [{
                        trope: 'Contraption',
                        executionDetail: 'Detail.',
                        members: [{ identifier: 'anvil-0', tropeFunction: 'job' }],
                    }],
                    outliers: [],
                }],
            },
            hop1Handoff: {
                paragraphSummary: 'Summary line.',
                planIssues: [{ code: 'ROLE_CONFLICT', summary: 'gap a' }],
                selectedCandidate: {
                    candidateId: 'candidate-2',
                    executionSummary: 'Use anvil as staged payload and rope as fallback.',
                    tropeAssignments: [{
                        trope: 'Contraption',
                        executionDetail: 'Rig anvil release timing.',
                        members: [{
                            stableKey: 'anvil-0',
                            shortName: 'anvil',
                            room: 'VORTEX',
                            tropeFunction: 'payload rig',
                        }],
                    }],
                    outliers: [{
                        stableKey: 'rope-1',
                        shortName: 'rope',
                        room: 'VORTEX',
                        tropeFunction: 'trip fallback',
                    }],
                },
            },
        })
        const full = parts.invariantPrefix + parts.dynamicSuffix
        expect(full).toContain('Selected candidate (authoritative winner payload when present)')
        expect(full).toContain('candidateId: candidate-2')
        expect(full).toContain('executionSummary: Use anvil as staged payload and rope as fallback.')
        expect(full).toContain('trope: Contraption')
        expect(full).toContain('member: anvil-0 | anvil | VORTEX | payload rig')
        expect(full).toContain('rope-1 | rope | VORTEX | trip fallback')
    })
})
