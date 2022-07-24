import SourceStream from './sourceStream'
import { tagOpenBeginTokenizer, tagOpenEndTokenizer } from './tagOpen'

describe('tagOpenBeginTokenizer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return undefined when no match', () => {
        const testStream = new SourceStream('Testing')
        expect(tagOpenBeginTokenizer(testStream)).toBe(undefined)
    })
    it('should tokenize tag open', () => {
        const testStream = new SourceStream('<Room key=(ABC)>')
        expect(tagOpenBeginTokenizer(testStream)).toMatchSnapshot()
    })
})

describe('tagOpenEndTokenizer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return undefined when no match', () => {
        const testStream = new SourceStream('Testing')
        expect(tagOpenEndTokenizer(testStream)).toBe(undefined)
    })
    it('should tokenize non-self-closing tag close', () => {
        const testStream = new SourceStream('></Room>')
        expect(tagOpenEndTokenizer(testStream)).toMatchSnapshot()
    })
    it('should tokenize self-closing tag close', () => {
        const testStream = new SourceStream('/></Room>')
        expect(tagOpenEndTokenizer(testStream)).toMatchSnapshot()
    })
})