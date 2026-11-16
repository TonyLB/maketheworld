import { pieces } from './pieces'

describe('pieces', () => {
    it('lists the oracle\'s pieces: the rule and non-rule cells, answered, the step considerations, read, and the trial, a family of read stages; and the imagination\'s play-by-play and consequences, read', () => {
        expect(Object.keys(pieces).sort()).toEqual(['consequences', 'nonRuleCell', 'playByPlay', 'ruleCell', 'stepConsiderations', 'trial'])
        expect(pieces.ruleCell.kind ?? 'answered').toBe('answered')
        expect(pieces.nonRuleCell.kind ?? 'answered').toBe('answered')
        expect(pieces.playByPlay.kind).toBe('read')
        expect(pieces.consequences.kind).toBe('read')
        expect(pieces.stepConsiderations.kind).toBe('read')
        const { trial } = pieces
        expect(trial.kind).toBe('family')
        expect(trial.kind === 'family' && Object.entries(trial.stages).map(([stage, { kind }]) => [stage, kind])).toEqual([['against', 'read'], ['rebuttal', 'read']])
    })
})
