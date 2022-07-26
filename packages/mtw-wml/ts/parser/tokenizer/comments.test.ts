import SourceStream from './sourceStream'
import commentTokenizer from './comments'
import { TokenizeException } from './baseClasses'

describe('commentTokenizer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return undefined when no match', () => {
        const testStream = new SourceStream(' Testing')
        expect(commentTokenizer(testStream)).toBe(undefined)
    })
    it('should tokenize a comment-to-end-of-line', () => {
        const testStream = new SourceStream('// Test comment\n<Room key=(Test)>')
        expect(commentTokenizer(testStream)).toMatchSnapshot()
    })
    it('should tokenize a comment-to-end-of-source', () => {
        const testStream = new SourceStream('// Test comment')
        expect(commentTokenizer(testStream)).toMatchSnapshot()
        expect(testStream.isEndOfSource).toBe(true)
    })
    it('should tokenize a bounded comment', () => {
        const testStream = new SourceStream('/* Test comment\n    Multiline comment */<Room key=(Test)>')
        expect(commentTokenizer(testStream)).toMatchSnapshot()
    })
    it('should error on unbounded comment', () => {
        const testStream = new SourceStream('/* Test comment\n    Multiline comment')
        expect(() => {
            commentTokenizer(testStream)
        }).toThrow(TokenizeException)
        expect(testStream.isEndOfSource).toBe(true)
    })
})