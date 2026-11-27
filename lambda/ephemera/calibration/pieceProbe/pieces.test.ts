import { pieces } from './pieces'

describe('pieces', () => {
    it('lists the oracle\'s pieces: the rule and non-rule cells, scene reading, triage and its branch-only arm, answered, the step considerations, read, and the trial, a family of two read stages and two answered ones; and the imagination\'s play-by-play and consequences, read', () => {
        expect(Object.keys(pieces).sort()).toEqual(['consequences', 'nonRuleCell', 'playByPlay', 'ruleCell', 'sceneReading', 'stepConsiderations', 'triage', 'triageBranch', 'trial'])
        expect(pieces.ruleCell.kind ?? 'answered').toBe('answered')
        expect(pieces.nonRuleCell.kind ?? 'answered').toBe('answered')
        expect(pieces.sceneReading.kind ?? 'answered').toBe('answered')
        expect(pieces.playByPlay.kind).toBe('read')
        expect(pieces.consequences.kind).toBe('read')
        expect(pieces.stepConsiderations.kind).toBe('read')
        expect(pieces.triage.kind ?? 'answered').toBe('answered')
        expect(pieces.triageBranch.kind ?? 'answered').toBe('answered')
        const { trial } = pieces
        expect(trial.kind).toBe('family')
        expect(trial.kind === 'family' && Object.entries(trial.stages).map(([stage, { kind }]) => [stage, kind ?? 'answered'])).toEqual([['against', 'read'], ['rebuttal', 'read'], ['verdict', 'answered'], ['ruling', 'answered']])
    })
})
