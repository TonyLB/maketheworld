import { helpTemplate, homeTemplate, lookTemplate, predictTemplate } from './bareWordTemplates'

describe('lookTemplate', () => {
    it('matches "look" and "l" (case-insensitive) via matchString', () => {
        for (const word of ['look', 'l', 'Look', 'L']) {
            const result = lookTemplate.matchString(word)
            expect(result).toEqual({ type: 'matched', skeleton: [{ type: 'text', text: word }], intent: { type: 'LookRoom', confidence: 1 } })
        }
    })

    it('tolerates leading/trailing whitespace', () => {
        expect(lookTemplate.matchString('  look  ').type).toBe('matched')
    })

    it('rejects near-misses and trailing args', () => {
        expect(lookTemplate.matchString('looks').type).toBe('noMatch')
        expect(lookTemplate.matchString('lookout').type).toBe('noMatch')
        expect(lookTemplate.matchString('look around').type).toBe('noMatch')
    })

    it('matches via matchTokens against a single-text-token skeleton', () => {
        const result = lookTemplate.matchTokens([{ type: 'text', text: 'look' }])
        expect(result).toEqual({ type: 'matched', skeleton: [{ type: 'text', text: 'look' }], intent: { type: 'LookRoom', confidence: 1 } })
    })
})

describe('helpTemplate', () => {
    it('matches "help" case-insensitively', () => {
        const result = helpTemplate.matchString('HELP')
        expect(result).toEqual({ type: 'matched', skeleton: [{ type: 'text', text: 'HELP' }], intent: { type: 'Help', confidence: 1 } })
    })

    it('rejects near-misses', () => {
        expect(helpTemplate.matchString('helper').type).toBe('noMatch')
        expect(helpTemplate.matchString('help me').type).toBe('noMatch')
    })

    it('matches via matchTokens', () => {
        expect(helpTemplate.matchTokens([{ type: 'text', text: 'help' }]).type).toBe('matched')
    })
})

describe('homeTemplate', () => {
    it('matches "home" and emits the Home intent (not HomeIntent)', () => {
        const result = homeTemplate.matchString('home')
        expect(result).toEqual({ type: 'matched', skeleton: [{ type: 'text', text: 'home' }], intent: { type: 'Home', confidence: 1 } })
    })

    it('rejects near-misses', () => {
        expect(homeTemplate.matchString('homely').type).toBe('noMatch')
    })

    it('matches via matchTokens', () => {
        expect(homeTemplate.matchTokens([{ type: 'text', text: 'home' }]).type).toBe('matched')
    })
})

describe('predictTemplate', () => {
    it('matches "predict" but has no "p" alias', () => {
        expect(predictTemplate.matchString('predict').type).toBe('matched')
        expect(predictTemplate.matchString('p').type).toBe('noMatch')
    })

    it('rejects near-misses', () => {
        expect(predictTemplate.matchString('predicts').type).toBe('noMatch')
    })

    it('matches via matchTokens', () => {
        expect(predictTemplate.matchTokens([{ type: 'text', text: 'predict' }]).type).toBe('matched')
    })
})
