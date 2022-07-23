import SourceStream from './sourceStream'

describe('SourceStream', () => {
    const testSource = `<Asset key=(Test)>
        <Room key=(entry)></Room>
    </Asset>`

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })
    it('should return lookAhead matches', () => {
        const testStream = new SourceStream(testSource)
        expect(testStream.lookAhead('<Asset')).toBe(true)
        expect(testStream.lookAhead('<Room')).toBe(false)
    })
    it('should consume successfully when given string', () => {
        const testStream = new SourceStream(testSource)
        testStream.consume('<Asset ')
        expect(testStream.lookAhead('key=(Test)')).toBe(true)
    })
    it('should consume successfully when given number', () => {
        const testStream = new SourceStream(testSource)
        expect(testStream.consume(6)).toEqual('<Asset')
        expect(testStream.consume(4)).toEqual(' key')
    })
    it('should successfully consume the entire source', () => {
        const testStream = new SourceStream(testSource)
        testStream.consume('<Asset key=(Test)>\n')
        expect(testStream.consume(undefined)).toEqual(`        <Room key=(entry)></Room>\n    </Asset>`)
        expect(testStream.isEndOfSource).toBe(true)
    })
    it('should correctly report endOfSource', () => {
        const testStream = new SourceStream(testSource)
        expect(testStream.isEndOfSource).toBe(false)
        testStream.consume(testSource)
        expect(testStream.isEndOfSource).toBe(true)
    })
    it('should correctly calculate nextInstante', () => {
        const testStream = new SourceStream(testSource)
        testStream.consume('<Asset')
        expect(testStream.nextInstance(['key', 'test'])).toEqual(1)
        expect(testStream.nextInstance(['Test'])).toEqual(6)
        expect(testStream.nextInstance(['<Asset'])).toEqual(-1)
    })
})