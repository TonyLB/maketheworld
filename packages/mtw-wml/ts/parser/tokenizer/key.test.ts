import SourceStream from './sourceStream'
import keyValueTokenizer from './key'
import { TokenizeException } from './baseClasses'

describe('keyValueTokenizer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return undefined when no match', () => {
        const testStream = new SourceStream('Testing')
        expect(keyValueTokenizer(testStream)).toBe(undefined)
    })
    it('should tokenize with whitespace around value', () => {
        const testStream = new SourceStream('( Test )></Room>')
        expect(keyValueTokenizer(testStream)).toMatchSnapshot()
    })
    it('should fail with whitespace within value', () => {
        const testStream = new SourceStream('(Te st)></Room>')
        expect(() => { keyValueTokenizer(testStream) }).toThrow(TokenizeException)
    })
    it('should tokenize without whitespace', () => {
        const testStream = new SourceStream('(Test_1)></Room>')
        expect(keyValueTokenizer(testStream)).toMatchSnapshot()
    })
    it('should reject illegal characters', () => {
        const testStream = new SourceStream('(Test-1)></Room>')
        expect(() => { keyValueTokenizer(testStream) }).toThrow(TokenizeException)
    })
    it('should reject keys that start with a digit', () => {
        const testStream = new SourceStream('(1_Test)></Room>')
        expect(() => { keyValueTokenizer(testStream) }).toThrow(TokenizeException)
    })
})