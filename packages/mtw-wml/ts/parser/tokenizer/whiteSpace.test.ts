import SourceStream from './sourceStream'
import whiteSpaceTokenizer from './whiteSpace'

describe('whiteSpaceTokenizer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return undefined when no match', () => {
        const testStream = new SourceStream('Testing')
        expect(whiteSpaceTokenizer(testStream)).toBe(undefined)
    })
    it('should tokenize whitespace between tags', () => {
        const testStream = new SourceStream(' \n    <Room key=(Test)>')
        expect(whiteSpaceTokenizer(testStream)).toMatchSnapshot()
    })
    it('should tokenize whitespace to end of source', () => {
        const testStream = new SourceStream('    \n\t\t')
        expect(whiteSpaceTokenizer(testStream)).toMatchSnapshot()
        expect(testStream.isEndOfSource).toBe(true)
    })
})