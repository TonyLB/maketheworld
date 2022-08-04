import SourceStream from '../../../parser/tokenizer/sourceStream'
import propertyTokenizer from './property'

describe('propertyTokenizer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return undefined when no match', () => {
        const testStream = new SourceStream('Testing')
        expect(propertyTokenizer(testStream)).toBe(undefined)
    })
    it('should tokenize property', () => {
        const testStream = new SourceStream('[key="test"] Test')
        expect(propertyTokenizer(testStream)).toMatchSnapshot()
    })
    it('should tokenize nthChild to end of source', () => {
        const testStream = new SourceStream('[key = "test" ]')
        expect(propertyTokenizer(testStream)).toMatchSnapshot()
        expect(testStream.isEndOfSource).toBe(true)
    })
})
