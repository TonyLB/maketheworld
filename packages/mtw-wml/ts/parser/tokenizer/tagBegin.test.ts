import SourceStream from './sourceStream'
import { beginTagOpenTokenizer } from './tagBegin'

describe('beginTagOpenTokenizer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return undefined when no match', () => {
        const testStream = new SourceStream('Testing')
        expect(beginTagOpenTokenizer(testStream)).toBe(undefined)
    })
    it('should tokenize tag open', () => {
        const testStream = new SourceStream('<Room key=(ABC)>')
        expect(beginTagOpenTokenizer(testStream)).toMatchSnapshot()
    })
})