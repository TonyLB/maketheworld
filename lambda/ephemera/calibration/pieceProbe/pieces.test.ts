import { pieces } from './pieces'

describe('pieces', () => {
    it('lists both families\' pieces: the oracle\'s rule cell, answered, and the imagination\'s play-by-play and consequences, read', () => {
        expect(Object.keys(pieces).sort()).toEqual(['consequences', 'playByPlay', 'ruleCell'])
        expect(pieces.ruleCell.kind ?? 'answered').toBe('answered')
        expect(pieces.playByPlay.kind).toBe('read')
        expect(pieces.consequences.kind).toBe('read')
    })
})
