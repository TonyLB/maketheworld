import SourceStream from '../../../parser/tokenizer/sourceStream'
import firstTokenizer from './first'

describe('firstTokenizer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return undefined when no match', () => {
        const testStream = new SourceStream('Testing')
        expect(firstTokenizer(testStream)).toBe(undefined)
    })
    it('should tokenize first', () => {
        const testStream = new SourceStream(':first) Test')
        expect(firstTokenizer(testStream)).toMatchSnapshot()
    })
    it('should tokenize first to end of source', () => {
        const testStream = new SourceStream(':first')
        expect(firstTokenizer(testStream)).toMatchSnapshot()
        expect(testStream.isEndOfSource).toBe(true)
    })
})
