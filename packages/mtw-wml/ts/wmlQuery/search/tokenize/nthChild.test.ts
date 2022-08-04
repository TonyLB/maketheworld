import SourceStream from '../../../parser/tokenizer/sourceStream'
import nthChildTokenizer from './nthChild'

describe('nthChildTokenizer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return undefined when no match', () => {
        const testStream = new SourceStream('Testing')
        expect(nthChildTokenizer(testStream)).toBe(undefined)
    })
    it('should tokenize nthChild', () => {
        const testStream = new SourceStream(':nthChild(12) Test')
        expect(nthChildTokenizer(testStream)).toMatchSnapshot()
    })
    it('should tokenize nthChild to end of source', () => {
        const testStream = new SourceStream(':nthChild(6)')
        expect(nthChildTokenizer(testStream)).toMatchSnapshot()
        expect(testStream.isEndOfSource).toBe(true)
    })
})
