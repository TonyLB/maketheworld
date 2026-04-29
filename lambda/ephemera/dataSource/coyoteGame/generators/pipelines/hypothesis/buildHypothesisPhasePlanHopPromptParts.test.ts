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
                rubricIssues: ['gap a'],
            },
        })
        const full = parts.invariantPrefix + parts.dynamicSuffix
        expect(full).toContain('Summary line.')
        expect(full).toContain('gap a')
        expect(full).toContain('```json')
        expect(full).toContain('## Combined clustering')
        expect(full).toContain('Candidate candidate-1')
    })
})
