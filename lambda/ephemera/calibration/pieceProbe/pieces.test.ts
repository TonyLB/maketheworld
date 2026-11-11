import { pieces } from './pieces'

describe('pieces', () => {
    it('lists both families\' pieces: the oracle\'s rule cell, answered, and the imagination\'s play-by-play, read', () => {
        expect(Object.keys(pieces).sort()).toEqual(['playByPlay', 'ruleCell'])
        expect(pieces.ruleCell.kind ?? 'answered').toBe('answered')
        expect(pieces.playByPlay.kind).toBe('read')
    })
})
