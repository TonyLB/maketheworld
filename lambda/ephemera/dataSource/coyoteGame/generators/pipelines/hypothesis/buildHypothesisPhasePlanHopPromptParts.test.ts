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
                planIssues: ['gap a'],
            },
        })
        const full = parts.invariantPrefix + parts.dynamicSuffix
        expect(full).toContain('Summary line.')
        expect(full).toContain('gap a')
        expect(full).toContain('```json')
        expect(full).toContain('## Combined clustering')
        expect(full).toContain('Candidate candidate-1')
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
                        environmentAffordances: ['drop-ready'],
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
                planIssues: ['gap a'],
            },
        })
        const full = parts.invariantPrefix + parts.dynamicSuffix
        expect(full).toContain('Candidate candidate-1')
        expect(full).toContain('stableKey:** anvil')
        expect(full).not.toContain('drop-ready')
    })
})
