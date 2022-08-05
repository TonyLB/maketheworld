import tokenizer from '.'
import { TokenizeException } from '../../../parser/tokenizer/baseClasses'
import SourceStream from '../../../parser/tokenizer/sourceStream'

describe('wmlQuery select tokenizer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return empty list on empty source', () => {
        const testStream = new SourceStream('')
        expect(tokenizer(testStream)).toEqual([])
    })
    it('should tokenize a single tag', () => {
        const testStream = new SourceStream('Room')
        expect(tokenizer(testStream)).toMatchSnapshot()
    })
    it('should tokenize a sequence of tags', () => {
        const testStream = new SourceStream('Asset Room Exit')
        expect(tokenizer(testStream)).toMatchSnapshot()
    })
    it('should tokenize a complex sequence', () => {
        const testStream = new SourceStream('(Asset, Story) Room:first Exit[to="ABC"]')
        expect(tokenizer(testStream)).toMatchSnapshot()
    })

})
