import SourceStream from './sourceStream'
import literalValueTokenizer, { expressionStringLiteralSubTokenizer } from './literal'
import { TokenizeException } from './baseClasses'

describe('literalValueTokenizer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    describe('stringLiteralSubTokenizer', () => {
        it('should return undefined when no match', () => {
            const testStream = new SourceStream('Testing')
            expect(expressionStringLiteralSubTokenizer(testStream)).toBe(undefined)
        })
        it('should tokenize bounded single-quote string literal', () => {
            const testStream = new SourceStream(`'Test'<Room key=(Test)>`)
            expect(expressionStringLiteralSubTokenizer(testStream)).toMatchSnapshot()
        })
        it('should tokenize bounded double-quote string literal', () => {
            const testStream = new SourceStream(`"Test"<Room key=(Test)>`)
            expect(expressionStringLiteralSubTokenizer(testStream)).toMatchSnapshot()
        })
        it('should not break on escaped quotes', () => {
            const testStream = new SourceStream("'\\'Test\\''<Room key=(Test)>")
            expect(expressionStringLiteralSubTokenizer(testStream)).toMatchSnapshot()
        })
        it('should not break on other-numbered quotes', () => {
            const testStream = new SourceStream(`'"Test'<Room key=(Test)>`)
            expect(expressionStringLiteralSubTokenizer(testStream)).toMatchSnapshot()
        })
        it('should return error on unbounded string literal', () => {
            const testStream = new SourceStream(`'Testing"`)
            expect(() => { expressionStringLiteralSubTokenizer(testStream) }).toThrow(TokenizeException)
            expect(testStream.isEndOfSource).toBe(true)
        })
    })
    
    it('should expect double-quoted expressions', () => {
        const testStream = new SourceStream(`"Test"<Room key=(Test)>`)
        expect(literalValueTokenizer(testStream)).toMatchSnapshot()
    })
    it('should reject single-quoted expressions', () => {
        const testStream = new SourceStream(`'Test'<Room key=(Test)>`)
        expect(literalValueTokenizer(testStream)).toBe(undefined)
    })
})
