import parse from './parse'
import SourceStream from '../../parser/tokenizer/sourceStream'
import tokenizer from './tokenize'

describe('wmlQuery select parse', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return empty list on empty source', () => {
        const testTokens = []
        expect(parse(testTokens)).toEqual([])
    })
    it('should parse a single sequence', () => {
        const testTokens = tokenizer(new SourceStream('Asset Room:first Exit'))
        expect(parse(testTokens)).toMatchSnapshot()
    })
    it('should parse a singly nested sub-sequence', () => {
        const testTokens = tokenizer(new SourceStream('(Asset, Story) Room:first Exit'))
        expect(parse(testTokens)).toMatchSnapshot()
    })
    //
    // TODO: Fix buggy results on deeply nested sub-sequence
    //
    it('should parse a deeply nested sub-sequence', () => {
        const testTokens = tokenizer(new SourceStream('(Asset, Story) Room:first Exit, Asset (Room Exit, (Room, Feature) Description)'))
        expect(parse(testTokens)).toMatchSnapshot()
    })

})
