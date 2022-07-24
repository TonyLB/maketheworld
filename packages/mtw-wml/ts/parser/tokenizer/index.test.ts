import SourceStream from './sourceStream'
import tokenizer from '.'

describe('tokenizer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return empty list on empty source', () => {
        const testStream = new SourceStream('')
        expect(tokenizer(testStream)).toEqual([])
    })
    it('should tokenize a single self-closing tag', () => {
        const testStream = new SourceStream('<Room key=(ABC) />')
        expect(tokenizer(testStream)).toMatchSnapshot()
    })
    it('should tokenize a single non-self-closing tag', () => {
        const testStream = new SourceStream('<Room key=(ABC)></Room>')
        expect(tokenizer(testStream)).toMatchSnapshot()
    })
    it('should tokenize nested tags', () => {
        const testSource = `<Asset key=(Test)>
            <Room key=(ABC)>
                <Feature key=(DEF) />
            </Room>
        </Asset>`
        const testStream = new SourceStream(testSource)
        expect(tokenizer(testStream)).toMatchSnapshot()
    })

})
