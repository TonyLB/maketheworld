import SourceStream from './sourceStream'
import booleanPropertyTokenizer from './boolean'

describe('booleanPropertyTokenizer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return undefined when no match', () => {
        const testStream = new SourceStream('(Testing)')
        expect(booleanPropertyTokenizer(testStream)).toBe(undefined)
    })
    it('should tokenize true value', () => {
        const testStream = new SourceStream('Test ></Room>')
        expect(booleanPropertyTokenizer(testStream)).toMatchSnapshot()
    })
    it('should tokenize false value', () => {
        const testStream = new SourceStream('!Test ></Room>')
        expect(booleanPropertyTokenizer(testStream)).toMatchSnapshot()
    })
})