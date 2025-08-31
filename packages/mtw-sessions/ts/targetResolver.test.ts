import { TargetResolver, InternalCacheWithSessionConnections, ResolvableTarget } from './targetResolver'
import { CacheSessionConnectionsData } from './sessionCache'

describe('TargetResolver', () => {
    let targetResolver: TargetResolver
    let mockInternalCache: jest.Mocked<InternalCacheWithSessionConnections>
    let mockSessionConnections: jest.Mocked<CacheSessionConnectionsData>

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()

        // Create mock session connections
        mockSessionConnections = {
            ConnectionsBySessionId: {},
            clear: jest.fn(),
            get: jest.fn(),
            set: jest.fn()
        } as jest.Mocked<CacheSessionConnectionsData>

        // Create mock internal cache
        mockInternalCache = {
            SessionConnections: mockSessionConnections
        } as jest.Mocked<InternalCacheWithSessionConnections>

        // Create target resolver instance
        targetResolver = new TargetResolver(mockInternalCache)
    })

    describe('constructor', () => {
        it('should create instance with internal cache', () => {
            expect(targetResolver).toBeInstanceOf(TargetResolver)
        })
    })

    describe('resolve', () => {
        it('should resolve empty targets array', async () => {
            const result = await targetResolver.resolve([])
            expect(result).toEqual([])
        })

        it('should resolve only connection targets', async () => {
            const targets: ResolvableTarget[] = ['CONNECTION#conn1', 'CONNECTION#conn2']
            const result = await targetResolver.resolve(targets)
            expect(result).toEqual(['conn1', 'conn2'])
        })

        it('should resolve only session targets', async () => {
            const targets: ResolvableTarget[] = ['SESSION#session1', 'SESSION#session2']
            mockSessionConnections.get.mockResolvedValue(['conn1', 'conn2', 'conn3'])
            
            const result = await targetResolver.resolve(targets)
            
            expect(mockSessionConnections.get).toHaveBeenCalledWith(['session1', 'session2'])
            expect(result).toEqual(['conn1', 'conn2', 'conn3'])
        })

        it('should resolve mixed session and connection targets', async () => {
            const targets: ResolvableTarget[] = [
                'SESSION#session1',
                'CONNECTION#conn1',
                'SESSION#session2'
            ]
            
            mockSessionConnections.get.mockResolvedValue(['conn2', 'conn3'])
            
            const result = await targetResolver.resolve(targets)
            
            expect(mockSessionConnections.get).toHaveBeenCalledWith(['session1', 'session2'])
            expect(result).toEqual(['conn1', 'conn2', 'conn3'])
        })

        it('should handle connection exclusions', async () => {
            const targets: ResolvableTarget[] = [
                'CONNECTION#conn1',
                'CONNECTION#conn2',
                '!CONNECTION#conn2'
            ]
            
            const result = await targetResolver.resolve(targets)
            expect(result).toEqual(['conn1'])
        })

        it('should handle session exclusions by excluding all connections in those sessions', async () => {
            const targets: ResolvableTarget[] = [
                'SESSION#session1',
                'SESSION#session2',
                '!SESSION#session1'
            ]
            
            // First call: resolve session targets (session1, session2)
            // Second call: resolve session exclusions (session1)
            mockSessionConnections.get.mockResolvedValueOnce(['conn1', 'conn2', 'conn3', 'conn4']) // session targets
            mockSessionConnections.get.mockResolvedValueOnce(['conn1', 'conn2']) // session exclusions
            
            const result = await targetResolver.resolve(targets)
            
            // Should call get twice: once for session targets, once for session exclusions
            expect(mockSessionConnections.get).toHaveBeenCalledTimes(2)
            expect(mockSessionConnections.get).toHaveBeenNthCalledWith(1, ['session1', 'session2'])
            expect(mockSessionConnections.get).toHaveBeenNthCalledWith(2, ['session1'])
            
            // session1 connections (conn1, conn2) are excluded, only session2 connections (conn3, conn4) remain
            expect(result).toEqual(['conn3', 'conn4'])
        })

        it('should handle mixed exclusions correctly', async () => {
            const targets: ResolvableTarget[] = [
                'SESSION#session1',
                'CONNECTION#conn1',
                '!SESSION#session1',
                '!CONNECTION#conn1'
            ]
            
            // session1 returns conn2, conn3 (these will be excluded)
            mockSessionConnections.get.mockResolvedValueOnce(['conn2', 'conn3']) // session targets
            mockSessionConnections.get.mockResolvedValueOnce(['conn2', 'conn3']) // session exclusions
            
            const result = await targetResolver.resolve(targets)
            
            // conn1 is explicitly excluded, session1 connections are excluded
            // Result should be empty since all targets are excluded
            expect(result).toEqual([])
        })

        it('should deduplicate connection IDs', async () => {
            const targets: ResolvableTarget[] = [
                'SESSION#session1',
                'CONNECTION#conn1',
                'SESSION#session2'
            ]
            
            // session1 returns conn1, conn2
            // session2 returns conn2, conn3
            // conn1 is also explicitly included
            mockSessionConnections.get.mockResolvedValueOnce(['conn1', 'conn2', 'conn3']) // session targets
            mockSessionConnections.get.mockResolvedValueOnce([]) // no session exclusions
            
            const result = await targetResolver.resolve(targets)
            
            // Should deduplicate conn1 and conn2
            expect(result).toEqual(['conn1', 'conn2', 'conn3'])
        })

        it('should handle undefined session connections gracefully', async () => {
            const targets: ResolvableTarget[] = ['SESSION#session1']
            mockSessionConnections.get.mockResolvedValue(undefined)
            
            const result = await targetResolver.resolve(targets)
            expect(result).toEqual([])
        })

        it('should handle empty session connections gracefully', async () => {
            const targets: ResolvableTarget[] = ['SESSION#session1']
            mockSessionConnections.get.mockResolvedValue([])
            
            const result = await targetResolver.resolve(targets)
            expect(result).toEqual([])
        })

        it('should resolve session targets and exclusions in parallel', async () => {
            const targets: ResolvableTarget[] = [
                'SESSION#session1',
                'SESSION#session2',
                '!SESSION#session3'
            ]
            
            mockSessionConnections.get.mockResolvedValueOnce(['conn1', 'conn2']) // session targets
            mockSessionConnections.get.mockResolvedValueOnce(['conn3', 'conn4']) // session exclusions
            
            const result = await targetResolver.resolve(targets)
            
            // Should make two calls: one for targets, one for exclusions
            expect(mockSessionConnections.get).toHaveBeenCalledTimes(2)
            expect(mockSessionConnections.get).toHaveBeenNthCalledWith(1, ['session1', 'session2'])
            expect(mockSessionConnections.get).toHaveBeenNthCalledWith(2, ['session3'])
            
            // Result should exclude session3 connections
            expect(result).toEqual(['conn1', 'conn2'])
        })
    })

    describe('edge cases', () => {
        it('should handle malformed session targets gracefully', async () => {
            const targets: ResolvableTarget[] = [
                'SESSION#', // Empty session ID
                'SESSION#valid-session'
            ]
            
            mockSessionConnections.get.mockResolvedValueOnce(['conn1'])
            mockSessionConnections.get.mockResolvedValueOnce([]) // no exclusions
            
            const result = await targetResolver.resolve(targets)
            
            // Should handle empty session ID gracefully
            expect(mockSessionConnections.get).toHaveBeenCalledWith(['', 'valid-session'])
            expect(result).toEqual(['conn1'])
        })

        it('should handle malformed connection targets gracefully', async () => {
            const targets: ResolvableTarget[] = [
                'CONNECTION#', // Empty connection ID
                'CONNECTION#valid-conn'
            ]
            
            const result = await targetResolver.resolve(targets)
            
            // Should handle empty connection ID gracefully
            expect(result).toEqual(['', 'valid-conn'])
        })

        it('should handle malformed exclusion targets gracefully', async () => {
            const targets: ResolvableTarget[] = [
                'CONNECTION#conn1',
                '!CONNECTION#', // Empty exclusion
                '!SESSION#' // Empty session exclusion
            ]
            
            mockSessionConnections.get.mockResolvedValue([]) // no session exclusions
            
            const result = await targetResolver.resolve(targets)
            
            // Should handle empty exclusions gracefully
            expect(result).toEqual(['conn1'])
        })

        it('should handle very long target lists', async () => {
            const targets: ResolvableTarget[] = Array.from({ length: 1000 }, (_, i) => 
                `SESSION#session${i}` as ResolvableTarget
            )
            
            mockSessionConnections.get.mockResolvedValueOnce(['conn1'])
            mockSessionConnections.get.mockResolvedValueOnce([]) // no exclusions
            
            const result = await targetResolver.resolve(targets)
            
            expect(mockSessionConnections.get).toHaveBeenCalledWith(
                Array.from({ length: 1000 }, (_, i) => `session${i}`)
            )
            expect(result).toEqual(['conn1'])
        })
    })

    describe('performance characteristics', () => {
        it('should make two database calls for mixed targets and exclusions', async () => {
            const targets: ResolvableTarget[] = [
                'SESSION#session1',
                'SESSION#session2',
                '!SESSION#session3'
            ]
            
            mockSessionConnections.get.mockResolvedValueOnce(['conn1', 'conn2'])
            mockSessionConnections.get.mockResolvedValueOnce(['conn3'])
            
            await targetResolver.resolve(targets)
            
            // Should make two calls: one for targets, one for exclusions
            expect(mockSessionConnections.get).toHaveBeenCalledTimes(2)
            expect(mockSessionConnections.get).toHaveBeenNthCalledWith(1, ['session1', 'session2'])
            expect(mockSessionConnections.get).toHaveBeenNthCalledWith(2, ['session3'])
        })

        it('should handle empty session targets without database calls', async () => {
            const targets: ResolvableTarget[] = ['CONNECTION#conn1']
            
            await targetResolver.resolve(targets)
            
            // Should not make any database calls for connection-only targets
            expect(mockSessionConnections.get).not.toHaveBeenCalled()
        })

        it('should handle empty session exclusions without database calls', async () => {
            const targets: ResolvableTarget[] = ['CONNECTION#conn1', '!CONNECTION#conn2']
            
            await targetResolver.resolve(targets)
            
            // Should not make any database calls for connection-only targets and exclusions
            expect(mockSessionConnections.get).not.toHaveBeenCalled()
        })
    })
})
