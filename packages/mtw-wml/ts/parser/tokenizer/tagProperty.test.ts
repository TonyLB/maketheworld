import SourceStream from './sourceStream'
import tagPropertyTokenizer from './tagProperty'

describe('tagPropertyTokenizer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return undefined when no match', () => {
        const testStream = new SourceStream('(Testing)')
        expect(tagPropertyTokenizer(testStream)).toBe(undefined)
    })
    it('should fail with whitespace within value', () => {
        const testStream = new SourceStream('Test =(ABC)></Room>')
        expect(tagPropertyTokenizer(testStream)).toMatchSnapshot()
    })
    it('should tokenize without whitespace', () => {
        const testStream = new SourceStream('Test=(ABC)></Room>')
        expect(tagPropertyTokenizer(testStream)).toMatchSnapshot()
    })
    it('should tokenize true boolean properties', () => {
        const testStream = new SourceStream('Test ></Room>')
        expect(tagPropertyTokenizer(testStream)).toMatchSnapshot()
    })
    it('should tokenize false boolean properties', () => {
        const testStream = new SourceStream('!Test ></Room>')
        expect(tagPropertyTokenizer(testStream)).toMatchSnapshot()
    })
})