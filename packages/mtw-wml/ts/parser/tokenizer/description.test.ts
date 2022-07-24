import SourceStream from './sourceStream'
import descriptionTokenizer from './description'

describe('descriptionTokenizer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return undefined when no match', () => {
        const testStream = new SourceStream('<Room />')
        expect(descriptionTokenizer(testStream)).toBe(undefined)
    })
    it('should tokenize to the next whitespace', () => {
        const testStream = new SourceStream('Test Message</Room>')
        expect(descriptionTokenizer(testStream)).toMatchSnapshot()
    })
    it('should tokenize to the next tag', () => {
        const testStream = new SourceStream('Test</Room>')
        expect(descriptionTokenizer(testStream)).toMatchSnapshot()
    })
    it('should tokenize to end of source', () => {
        const testStream = new SourceStream('Test')
        expect(descriptionTokenizer(testStream)).toMatchSnapshot()
    })
    it('should break description for comments', () => {
        expect(descriptionTokenizer(new SourceStream('Test/*Comment*/'))).toMatchSnapshot()
        expect(descriptionTokenizer(new SourceStream('AnotherTest// Comment'))).toMatchSnapshot()
    })
})