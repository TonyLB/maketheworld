import { maybeFetchSidecarString } from './sidecarResolve'

describe('maybeFetchSidecarString', () => {
    describe('inline values', () => {
        it('should return string value as-is', async () => {
            const result = await maybeFetchSidecarString('hello world')
            expect(result).toBe('hello world')
        })

        it('should coerce number to string', async () => {
            const result = await maybeFetchSidecarString(42)
            expect(result).toBe('42')
        })

        it('should return empty string for null', async () => {
            const result = await maybeFetchSidecarString(null)
            expect(result).toBe('')
        })

        it('should return empty string for undefined', async () => {
            const result = await maybeFetchSidecarString(undefined)
            expect(result).toBe('')
        })
    })

    describe('sidecar descriptor', () => {
        it('should fetch from sidecarUrl and return response text', async () => {
            const wmlContent = '<Asset uuid=(test)></Asset>'
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                text: () => Promise.resolve(wmlContent)
            })

            const result = await maybeFetchSidecarString(
                { sidecarUrl: 'https://example.com/sidecar.wml' },
                mockFetch as unknown as typeof fetch
            )

            expect(mockFetch).toHaveBeenCalledWith('https://example.com/sidecar.wml')
            expect(result).toBe(wmlContent)
        })

        it('should throw when fetch returns non-ok response', async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found'
            })

            await expect(
                maybeFetchSidecarString(
                    { sidecarUrl: 'https://example.com/missing' },
                    mockFetch as unknown as typeof fetch
                )
            ).rejects.toThrow('Sidecar fetch failed: 404 Not Found (https://example.com/missing)')
        })

        it('should throw when fetch rejects', async () => {
            const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'))

            await expect(
                maybeFetchSidecarString(
                    { sidecarUrl: 'https://example.com/sidecar' },
                    mockFetch as unknown as typeof fetch
                )
            ).rejects.toThrow('Network error')
        })
    })

    describe('edge cases', () => {
        it('should not treat object without sidecarUrl as sidecar', async () => {
            const result = await maybeFetchSidecarString({ url: 'https://example.com' })
            expect(result).toBe('[object Object]')
        })

        it('should not treat object with non-string sidecarUrl as sidecar', async () => {
            const result = await maybeFetchSidecarString({ sidecarUrl: 123 })
            expect(result).toBe('[object Object]')
        })
    })
})
