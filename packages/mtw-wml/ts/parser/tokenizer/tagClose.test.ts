import SourceStream from './sourceStream'
import tagCloseTokenizer from './tagClose'

describe('tagCloseTokenizer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return undefined when no match', () => {
        const testStream = new SourceStream('Testing')
        expect(tagCloseTokenizer(testStream)).toBe(undefined)
    })
    it('should tokenize tag close without whitespace', () => {
        const testStream = new SourceStream('</Room><Room key=(ABC)>')
        expect(tagCloseTokenizer(testStream)).toMatchSnapshot()
    })
    it('should tokenize tag close with whitespace', () => {
        const testStream = new SourceStream('</Room   ><Room key=(ABC)>')
        expect(tagCloseTokenizer(testStream)).toMatchSnapshot()
    })
    it('should error when no closing syntax', () => {
        const testStream = new SourceStream('</Room   <Room key=(ABC)>')
        expect(tagCloseTokenizer(testStream)).toMatchSnapshot()
    })
    it('should error when no tag label', () => {
        const testStream = new SourceStream('</ ><Room key=(ABC)>')
        expect(tagCloseTokenizer(testStream)).toMatchSnapshot()
    })
    it('should error when hits end of source', () => {
        const testStream = new SourceStream('</Room')
        expect(tagCloseTokenizer(testStream)).toMatchSnapshot()
    })
})
