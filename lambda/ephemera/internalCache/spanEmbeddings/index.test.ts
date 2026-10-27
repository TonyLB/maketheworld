jest.mock('./embedObjectSpan')
import { embedObjectSpan, type EmbedObjectSpanResult } from './embedObjectSpan'
import { SpanEmbeddingsCache, spanEmbeddingKey } from '.'

const embedMock = embedObjectSpan as jest.MockedFunction<typeof embedObjectSpan>

const success = (seed: number): EmbedObjectSpanResult => ({
    success: true,
    embedding: { vector: [seed] } as any,
})

describe('spanEmbeddingKey', () => {
    it('collapses case, whitespace and a leading article', () => {
        expect(spanEmbeddingKey('cup')).toBe('cup')
        expect(spanEmbeddingKey('the cup')).toBe('cup')
        expect(spanEmbeddingKey('  The  Cup ')).toBe('cup')
    })
})

describe('SpanEmbeddingsCache', () => {
    let cache: SpanEmbeddingsCache

    beforeEach(() => {
        jest.resetAllMocks()
        cache = new SpanEmbeddingsCache()
    })

    it('makes one embedder call for spans that differ by article, case or whitespace', async () => {
        embedMock.mockResolvedValue(success(1))

        const results = await Promise.all([cache.get('cup'), cache.get('the cup'), cache.get('  The  Cup ')])

        expect(embedMock).toHaveBeenCalledTimes(1)
        expect(embedMock).toHaveBeenCalledWith('cup')
        expect(results).toEqual([success(1), success(1), success(1)])
    })

    it('shares an in-flight call between concurrent requests', async () => {
        let release: (result: EmbedObjectSpanResult) => void = () => {}
        embedMock.mockReturnValue(new Promise((resolve) => { release = resolve }))

        const first = cache.get('cup')
        const second = cache.get('the cup')
        expect(embedMock).toHaveBeenCalledTimes(1)
        release(success(2))

        expect(await first).toEqual(success(2))
        expect(await second).toEqual(success(2))
        expect(embedMock).toHaveBeenCalledTimes(1)
    })

    it('starts distinct spans in request order before any resolves', async () => {
        embedMock.mockReturnValue(new Promise(() => {}))

        cache.get('cup')
        cache.get('table')
        cache.get('shelf')

        expect(embedMock.mock.calls.map(([span]) => span)).toEqual(['cup', 'table', 'shelf'])
    })

    it('memoizes a { success: false } result', async () => {
        embedMock.mockResolvedValue({ success: false })

        expect(await cache.get('cup')).toEqual({ success: false })
        expect(await cache.get('cup')).toEqual({ success: false })
        expect(embedMock).toHaveBeenCalledTimes(1)
    })

    it('resolves { success: false } for every awaiter when the embedder throws', async () => {
        embedMock.mockRejectedValue(new Error('Bedrock down'))

        const results = await Promise.all([cache.get('cup'), cache.get('the cup')])

        expect(results).toEqual([{ success: false }, { success: false }])
        expect(embedMock).toHaveBeenCalledTimes(1)
    })

    it('passes empty and article-only spans to the embedder, which abstains', async () => {
        embedMock.mockResolvedValue({ success: false })

        expect(await cache.get('   ')).toEqual({ success: false })
        expect(await cache.get('the')).toEqual({ success: false })
        expect(embedMock.mock.calls.map(([span]) => span)).toEqual(['', 'the'])
    })

    it('forgets on clear', async () => {
        embedMock.mockResolvedValue(success(3))

        await cache.get('cup')
        cache.clear()
        await cache.get('cup')

        expect(embedMock).toHaveBeenCalledTimes(2)
    })
})
