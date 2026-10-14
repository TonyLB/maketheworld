import { logLudicCacheRebuild } from './ludicCacheInstrumentation'

describe('logLudicCacheRebuild', () => {
    it('logs one structured line carrying counts, never cache structure', () => {
        const spy = jest.spyOn(console, 'log').mockImplementation(() => {})

        logLudicCacheRebuild({
            seedHostId: 'ROOM#A',
            shardFetchCount: 6,
            maxDepth: 3,
            objectCount: 5,
            wallTimeMs: 42,
        })

        expect(spy).toHaveBeenCalledWith('[mtw.ephemera.ludicCache] rebuild', {
            event: 'rebuild',
            seedHostId: 'ROOM#A',
            shardFetchCount: 6,
            maxDepth: 3,
            objectCount: 5,
            wallTimeMs: 42,
        })

        spy.mockRestore()
    })

    it('carries the persisted read\'s outcome and size, and no walk counts', () => {
        const spy = jest.spyOn(console, 'log').mockImplementation(() => {})

        logLudicCacheRebuild({ seedHostId: 'ROOM#A', objectCount: 5, wallTimeMs: 3, outcome: 'absent', storedBytes: 2048 })

        expect(spy).toHaveBeenCalledWith('[mtw.ephemera.ludicCache] rebuild', {
            event: 'rebuild',
            seedHostId: 'ROOM#A',
            objectCount: 5,
            wallTimeMs: 3,
            outcome: 'absent',
            storedBytes: 2048,
        })

        spy.mockRestore()
    })
})
