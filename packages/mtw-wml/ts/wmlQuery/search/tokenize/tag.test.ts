import { TokenizeException } from '../../../parser/tokenizer/baseClasses'
import SourceStream from '../../../parser/tokenizer/sourceStream'
import tagTokenizer from './tag'

describe('tagTokenizer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return undefined when no match', () => {
        const testStream = new SourceStream('(Testing)')
        expect(tagTokenizer(testStream)).toBe(undefined)
    })
    it('should tokenize tag', () => {
        const testStream = new SourceStream('Room')
        expect(tagTokenizer(testStream)).toMatchSnapshot()
    })
    it('should throw exception on illegal tag', () => {
        const testStream = new SourceStream('Test')
        expect(() => { tagTokenizer(testStream) }).toThrow(TokenizeException)
    })
})
