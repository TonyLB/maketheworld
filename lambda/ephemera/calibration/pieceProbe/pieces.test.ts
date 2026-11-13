import { pieces } from './pieces'

describe('pieces', () => {
    it('lists both families\' pieces: the oracle\'s rule and non-rule cells, answered, and the imagination\'s play-by-play and consequences, read', () => {
        expect(Object.keys(pieces).sort()).toEqual(['consequences', 'nonRuleCell', 'playByPlay', 'ruleCell'])
        expect(pieces.ruleCell.kind ?? 'answered').toBe('answered')
        expect(pieces.nonRuleCell.kind ?? 'answered').toBe('answered')
        expect(pieces.playByPlay.kind).toBe('read')
        expect(pieces.consequences.kind).toBe('read')
    })
})
