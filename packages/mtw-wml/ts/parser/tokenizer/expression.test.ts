import SourceStream from './sourceStream'
import expressionValueTokenizer, { expressionStringLiteralSubTokenizer, expressionTemplateStringSubTokenizer } from './expression'

describe('expressionTokenizer', () => {
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
            expect(expressionStringLiteralSubTokenizer(testStream)).toMatchSnapshot()
            expect(testStream.isEndOfSource).toBe(true)
        })
    })

    describe('templateStringSubTokenizer', () => {
        it('should return undefined when no match', () => {
            const testStream = new SourceStream('Testing')
            expect(expressionTemplateStringSubTokenizer(testStream)).toBe(undefined)
        })
        it('should tokenize nested template strings', () => {
            const testStream = new SourceStream("`Test${value + `}`}`<Room key=(Test)>")
            expect(expressionTemplateStringSubTokenizer(testStream)).toMatchSnapshot()
        })
        it('should not break on escaped quotes', () => {
            const testStream = new SourceStream("`\\`Test\\``<Room key=(Test)>")
            expect(expressionTemplateStringSubTokenizer(testStream)).toMatchSnapshot()
        })
        it('should return error on unbounded string literal', () => {
            const testStream = new SourceStream("`Testing'")
            expect(expressionTemplateStringSubTokenizer(testStream)).toMatchSnapshot()
            expect(testStream.isEndOfSource).toBe(true)
        })
    })

    it('should return undefined when no match', () => {
        const testStream = new SourceStream('Testing')
        expect(expressionValueTokenizer(testStream)).toBe(undefined)
    })
    it('should properly nest string literals', () => {
        const testStream = new SourceStream(`{ return 'Test' + " value}" }<Room key=(Test) />`)
        expect(expressionValueTokenizer(testStream)).toMatchSnapshot()
    })
    it('should properly nest template literals', () => {
        const testStream = new SourceStream("{ return `Test: ${value}` }<Room key=(Test) />")
        expect(expressionValueTokenizer(testStream)).toMatchSnapshot()
    })
    it('should properly nest expressions', () => {
        const testStream = new SourceStream("{ if (value === 'A') { return 'Test' } else { return 'Fail' } }<Room key=(Test) />")
        expect(expressionValueTokenizer(testStream)).toMatchSnapshot()
    })
    
})