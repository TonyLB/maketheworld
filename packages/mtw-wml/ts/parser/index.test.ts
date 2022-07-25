import parse from '.'
import tokenizer from './tokenizer'
import SourceStream from './tokenizer/sourceStream'

describe('wml parser', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return empty list from no tokens', () => {
        expect(parse([])).toEqual([])
    })
    it('should parse a single tag', () => {
        const testTokens = tokenizer(new SourceStream('<Asset key=(Test)></Asset>'))
        expect(parse(testTokens)).toMatchSnapshot()
    })
})