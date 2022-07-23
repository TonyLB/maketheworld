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
    it('should consume successfully', () => {
        const testStream = new SourceStream(testSource)
        testStream.consume('<Asset ')
        expect(testStream.lookAhead('key=(Test)')).toBe(true)
    })
    it('should correctly report endOfSource', () => {
        const testStream = new SourceStream(testSource)
        expect(testStream.isEndOfSource).toBe(false)
        testStream.consume(testSource)
        expect(testStream.isEndOfSource).toBe(true)
    })
})