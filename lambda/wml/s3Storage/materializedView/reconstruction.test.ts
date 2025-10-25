/**
 * Reconstruction Tests
 * 
 * Comprehensive tests for manifest-based reconstruction.
 * Tests various scenarios: empty manifest, snapshot-only, chunks-only, 
 * snapshot+chunks, error handling, both content and auth prefixes.
 */

import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'
import { reconstructFromManifest } from './reconstruction'
import { ManifestChunkEvent, ManifestSnapshotEvent } from '../manifest/baseClasses'

// Mock s3Client
jest.mock('@tonylb/mtw-asset-workspace/ts/clients', () => ({
    s3Client: {
        get: jest.fn(),
        put: jest.fn(),
        putWithTags: jest.fn(),
        copyWithTags: jest.fn(),
        getSize: jest.fn()
    }
}))

const mockS3Get = s3Client.get as jest.MockedFunction<typeof s3Client.get>
const mockS3Put = s3Client.put as jest.MockedFunction<typeof s3Client.put>

describe('reconstructFromManifest', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('Empty manifest scenarios', () => {
        it('should return empty StandardForm for content prefix with no manifest', async () => {
            // Setup: No manifest exists
            mockS3Get.mockRejectedValue({ Code: 'NoSuchKey', name: 'NoSuchKey' })

            // Execute
            const result = await reconstructFromManifest('test.wml/')

            // Verify
            expect(result.type).toBe('content')
            if (result.type === 'content') {
                expect(result.standard.universalKey).toBe('ASSET#test')
                expect(result.standard.toJSON().components).toEqual([])
                expect(result.metadata.snapshotUsed).toBe(false)
                expect(result.metadata.chunksApplied).toBe(0)
            }
        })

        it('should return empty StandardAuthorizationCollection for auth prefix with no manifest', async () => {
            // Setup: No manifest exists
            mockS3Get.mockRejectedValue({ Code: 'NoSuchKey', name: 'NoSuchKey' })

            // Execute
            const result = await reconstructFromManifest('test.auth.wml/')

            // Verify
            expect(result.type).toBe('auth')
            if (result.type === 'auth') {
                expect(result.authorization.key).toBe('test')
                const authJSON = result.authorization.toJSON()
                // toJSON returns { key: string, grants: Array }
                expect(authJSON.key).toBe('test')
                expect(authJSON.grants).toEqual([])
                expect(result.metadata.snapshotUsed).toBe(false)
                expect(result.metadata.chunksApplied).toBe(0)
            }
        })

        it('should return empty content for manifest with no events', async () => {
            // Setup: Empty manifest
            mockS3Get.mockImplementation(async ({ Key }) => {
                if (Key === 'test.wml/manifest-latest.ndjson') {
                    return ''
                }
                throw new Error('Not found')
            })

            // Execute
            const result = await reconstructFromManifest('test.wml/')

            // Verify
            expect(result.type).toBe('content')
            if (result.type === 'content') {
                expect(result.standard.universalKey).toBe('ASSET#test')
                expect(result.metadata.snapshotUsed).toBe(false)
                expect(result.metadata.chunksApplied).toBe(0)
            }
        })
    })

    describe('Chunk-only scenarios', () => {
        it('should apply single chunk to empty baseline', async () => {
            // Setup: Manifest with one chunk
            const chunkEvent: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: '2025-10-20T10:00:00.000Z',
                eventId: 'e1',
                s3Key: 'test.wml/chunks/1729418400000-abc123.wml',
                chunkSize: 100
            }

            mockS3Get.mockImplementation(async ({ Key }) => {
                if (Key === 'test.wml/manifest-latest.ndjson') {
                    return JSON.stringify(chunkEvent)
                }
                if (Key === 'test.wml/chunks/1729418400000-abc123.wml') {
                    return '<Asset uuid=(test)><Room uuid=(lobby)><Name>Lobby</Name></Room></Asset>'
                }
                throw new Error('Not found')
            })

            // Execute
            const result = await reconstructFromManifest('test.wml/')

            // Verify
            expect(result.type).toBe('content')
            if (result.type === 'content') {
                expect(result.standard.universalKey).toBe('ASSET#test')
                expect(result.metadata.snapshotUsed).toBe(false)
                expect(result.metadata.chunksApplied).toBe(1)
                
                // Verify content was merged
                const components = result.standard.toJSON().components
                expect(components.length).toBeGreaterThanOrEqual(1) // At least Room
                expect(components.some(c => c.universalKey === 'ROOM#lobby')).toBe(true)
            }
        })

        it('should apply multiple chunks in chronological order', async () => {
            // Setup: Manifest with multiple chunks
            const events = [
                {
                    type: 'chunk',
                    timestamp: '2025-10-20T10:00:00.000Z',
                    eventId: 'e1',
                    s3Key: 'test.wml/chunks/1729418400000-abc123.wml'
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-20T11:00:00.000Z',
                    eventId: 'e2',
                    s3Key: 'test.wml/chunks/1729422000000-def456.wml'
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-20T12:00:00.000Z',
                    eventId: 'e3',
                    s3Key: 'test.wml/chunks/1729425600000-ghi789.wml'
                }
            ]

            mockS3Get.mockImplementation(async ({ Key }) => {
                if (Key === 'test.wml/manifest-latest.ndjson') {
                    return events.map(e => JSON.stringify(e)).join('\n')
                }
                if (Key === 'test.wml/chunks/1729418400000-abc123.wml') {
                    return '<Asset uuid=(test)><Room uuid=(lobby)><Name>Lobby</Name></Room></Asset>'
                }
                if (Key === 'test.wml/chunks/1729422000000-def456.wml') {
                    return '<Asset uuid=(test)><Feature uuid=(desk)><Name>Desk</Name></Feature></Asset>'
                }
                if (Key === 'test.wml/chunks/1729425600000-ghi789.wml') {
                    return '<Asset uuid=(test)><Knowledge uuid=(lore)><Name>Lore</Name></Knowledge></Asset>'
                }
                throw new Error('Not found')
            })

            // Execute
            const result = await reconstructFromManifest('test.wml/')

            // Verify
            expect(result.type).toBe('content')
            if (result.type === 'content') {
                expect(result.metadata.snapshotUsed).toBe(false)
                expect(result.metadata.chunksApplied).toBe(3)
                
                // Verify all components were merged
                const components = result.standard.toJSON().components
                expect(components.some(c => c.universalKey === 'ROOM#lobby')).toBe(true)
                expect(components.some(c => c.universalKey === 'FEATURE#desk')).toBe(true)
                expect(components.some(c => c.universalKey === 'KNOWLEDGE#lore')).toBe(true)
            }
        })
    })

    describe('Snapshot-only scenarios', () => {
        it('should load from snapshot with no subsequent chunks', async () => {
            // Setup: Manifest with only a snapshot
            const snapshotEvent: ManifestSnapshotEvent = {
                type: 'snapshot',
                timestamp: '2025-10-20T10:00:00.000Z',
                eventId: 'e1',
                s3Key: 'test.wml/snapshots/1729418400000.wml',
                snapshotType: 'manual',
                chunksBeforeSnapshot: 5,
                snapshotSize: 1000
            }

            mockS3Get.mockImplementation(async ({ Key }) => {
                if (Key === 'test.wml/manifest-latest.ndjson') {
                    return JSON.stringify(snapshotEvent)
                }
                if (Key === 'test.wml/snapshots/1729418400000.wml') {
                    return '<Asset uuid=(test)><Room uuid=(lobby)><Name>Lobby</Name></Room><Feature uuid=(desk)><Name>Desk</Name></Feature></Asset>'
                }
                throw new Error('Not found')
            })

            // Execute
            const result = await reconstructFromManifest('test.wml/')

            // Verify
            expect(result.type).toBe('content')
            if (result.type === 'content') {
                expect(result.metadata.snapshotUsed).toBe(true)
                expect(result.metadata.chunksApplied).toBe(0)
                
                // Verify snapshot content was loaded
                const components = result.standard.toJSON().components
                expect(components.some(c => c.universalKey === 'ROOM#lobby')).toBe(true)
                expect(components.some(c => c.universalKey === 'FEATURE#desk')).toBe(true)
            }
        })
    })

    describe('Snapshot + chunks scenarios', () => {
        it('should load snapshot and apply subsequent chunks', async () => {
            // Setup: Manifest with snapshot and chunks
            const events = [
                {
                    type: 'chunk',
                    timestamp: '2025-10-20T09:00:00.000Z',
                    eventId: 'e1',
                    s3Key: 'test.wml/chunks/1729414800000-old.wml'
                },
                {
                    type: 'snapshot',
                    timestamp: '2025-10-20T10:00:00.000Z',
                    eventId: 'e2',
                    s3Key: 'test.wml/snapshots/1729418400000.wml',
                    snapshotType: 'manual',
                    chunksBeforeSnapshot: 1
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-20T11:00:00.000Z',
                    eventId: 'e3',
                    s3Key: 'test.wml/chunks/1729422000000-new1.wml'
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-20T12:00:00.000Z',
                    eventId: 'e4',
                    s3Key: 'test.wml/chunks/1729425600000-new2.wml'
                }
            ]

            mockS3Get.mockImplementation(async ({ Key }) => {
                if (Key === 'test.wml/manifest-latest.ndjson') {
                    return events.map(e => JSON.stringify(e)).join('\n')
                }
                if (Key === 'test.wml/snapshots/1729418400000.wml') {
                    // Snapshot already includes the old chunk content
                    return '<Asset uuid=(test)><Room uuid=(lobby)><Name>Lobby</Name></Room></Asset>'
                }
                if (Key === 'test.wml/chunks/1729422000000-new1.wml') {
                    return '<Asset uuid=(test)><Feature uuid=(desk)><Name>Desk</Name></Feature></Asset>'
                }
                if (Key === 'test.wml/chunks/1729425600000-new2.wml') {
                    return '<Asset uuid=(test)><Knowledge uuid=(lore)><Name>Lore</Name></Knowledge></Asset>'
                }
                throw new Error('Not found')
            })

            // Execute
            const result = await reconstructFromManifest('test.wml/')

            // Verify
            expect(result.type).toBe('content')
            if (result.type === 'content') {
                expect(result.metadata.snapshotUsed).toBe(true)
                expect(result.metadata.chunksApplied).toBe(2) // Only chunks after snapshot
                
                // Verify snapshot + new chunks were merged
                const components = result.standard.toJSON().components
                expect(components.some(c => c.universalKey === 'ROOM#lobby')).toBe(true)
                expect(components.some(c => c.universalKey === 'FEATURE#desk')).toBe(true)
                expect(components.some(c => c.universalKey === 'KNOWLEDGE#lore')).toBe(true)
            }

            // Verify old chunk was NOT loaded (only chunks after snapshot)
            expect(mockS3Get).not.toHaveBeenCalledWith({ Key: 'test.wml/chunks/1729414800000-old.wml' })
        })

        it('should use latest snapshot if multiple exist', async () => {
            // Setup: Manifest with multiple snapshots
            const events = [
                {
                    type: 'snapshot',
                    timestamp: '2025-10-20T08:00:00.000Z',
                    eventId: 'e1',
                    s3Key: 'test.wml/snapshots/1729411200000.wml',
                    snapshotType: 'automatic',
                    chunksBeforeSnapshot: 10
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-20T09:00:00.000Z',
                    eventId: 'e2',
                    s3Key: 'test.wml/chunks/1729414800000-mid.wml'
                },
                {
                    type: 'snapshot',
                    timestamp: '2025-10-20T10:00:00.000Z',
                    eventId: 'e3',
                    s3Key: 'test.wml/snapshots/1729418400000.wml',
                    snapshotType: 'manual',
                    chunksBeforeSnapshot: 1
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-20T11:00:00.000Z',
                    eventId: 'e4',
                    s3Key: 'test.wml/chunks/1729422000000-new.wml'
                }
            ]

            mockS3Get.mockImplementation(async ({ Key }) => {
                if (Key === 'test.wml/manifest-latest.ndjson') {
                    return events.map(e => JSON.stringify(e)).join('\n')
                }
                if (Key === 'test.wml/snapshots/1729418400000.wml') {
                    // Latest snapshot
                    return '<Asset uuid=(test)><Room uuid=(lobby)><Name>Latest Snapshot</Name></Room></Asset>'
                }
                if (Key === 'test.wml/chunks/1729422000000-new.wml') {
                    return '<Asset uuid=(test)><Feature uuid=(desk)><Name>Desk</Name></Feature></Asset>'
                }
                throw new Error('Not found')
            })

            // Execute
            const result = await reconstructFromManifest('test.wml/')

            // Verify
            expect(result.type).toBe('content')
            if (result.type === 'content') {
                expect(result.metadata.snapshotUsed).toBe(true)
                expect(result.metadata.chunksApplied).toBe(1)
                
                // Verify latest snapshot was used (check components directly)
                const components = result.standard.toJSON().components
                const room = components.find(c => c.universalKey === 'ROOM#lobby')
                expect(room).toBeDefined()
            }

            // Verify older snapshot was NOT loaded
            expect(mockS3Get).not.toHaveBeenCalledWith({ Key: 'test.wml/snapshots/1729411200000.wml' })
        })
    })

    describe('Authorization prefix scenarios', () => {
        it('should reconstruct authorization content from auth prefix', async () => {
            // Setup: Auth manifest with chunk
            const chunkEvent: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: '2025-10-20T10:00:00.000Z',
                eventId: 'e1',
                s3Key: 'test.auth.wml/chunks/1729418400000-abc123.wml'
            }

            mockS3Get.mockImplementation(async ({ Key }) => {
                if (Key === 'test.auth.wml/manifest-latest.ndjson') {
                    return JSON.stringify(chunkEvent)
                }
                if (Key === 'test.auth.wml/chunks/1729418400000-abc123.wml') {
                    return '<Asset uuid=(test)><Room key=(lobby)><Grant player=(alice) actions="read" /></Room></Asset>'
                }
                throw new Error('Not found')
            })

            // Execute
            const result = await reconstructFromManifest('test.auth.wml/')

            // Verify
            expect(result.type).toBe('auth')
            if (result.type === 'auth') {
                expect(result.authorization.key).toBe('test')
                expect(result.metadata.snapshotUsed).toBe(false)
                expect(result.metadata.chunksApplied).toBe(1)
            }
        })

        it('should load auth snapshot and apply subsequent auth chunks', async () => {
            // Setup: Auth manifest with snapshot and chunk
            const events = [
                {
                    type: 'snapshot',
                    timestamp: '2025-10-20T10:00:00.000Z',
                    eventId: 'e1',
                    s3Key: 'test.auth.wml/snapshots/1729418400000.wml',
                    snapshotType: 'manual',
                    chunksBeforeSnapshot: 5
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-20T11:00:00.000Z',
                    eventId: 'e2',
                    s3Key: 'test.auth.wml/chunks/1729422000000-new.wml'
                }
            ]

            mockS3Get.mockImplementation(async ({ Key }) => {
                if (Key === 'test.auth.wml/manifest-latest.ndjson') {
                    return events.map(e => JSON.stringify(e)).join('\n')
                }
                if (Key === 'test.auth.wml/snapshots/1729418400000.wml') {
                    return '<Asset uuid=(test)><Room key=(lobby)><Grant player=(alice) actions="read" /></Room></Asset>'
                }
                if (Key === 'test.auth.wml/chunks/1729422000000-new.wml') {
                    return '<Asset uuid=(test)><Feature key=(desk)><Grant player=(alice) actions="read" /></Feature></Asset>'
                }
                throw new Error('Not found')
            })

            // Execute
            const result = await reconstructFromManifest('test.auth.wml/')

            // Verify
            expect(result.type).toBe('auth')
            if (result.type === 'auth') {
                expect(result.metadata.snapshotUsed).toBe(true)
                expect(result.metadata.chunksApplied).toBe(1)
            }
        })
    })

    describe('Error handling', () => {
        it('should handle missing snapshot gracefully', async () => {
            // Setup: Manifest with snapshot that doesn't exist in S3
            const events = [
                {
                    type: 'snapshot',
                    timestamp: '2025-10-20T10:00:00.000Z',
                    eventId: 'e1',
                    s3Key: 'test.wml/snapshots/1729418400000.wml',
                    snapshotType: 'manual',
                    chunksBeforeSnapshot: 5
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-20T11:00:00.000Z',
                    eventId: 'e2',
                    s3Key: 'test.wml/chunks/1729422000000-new.wml'
                }
            ]

            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

            mockS3Get.mockImplementation(async ({ Key }) => {
                if (Key === 'test.wml/manifest-latest.ndjson') {
                    return events.map(e => JSON.stringify(e)).join('\n')
                }
                if (Key === 'test.wml/snapshots/1729418400000.wml') {
                    throw new Error('S3 object not found')
                }
                if (Key === 'test.wml/chunks/1729422000000-new.wml') {
                    return '<Asset uuid=(test)><Room uuid=(lobby)><Name>Lobby</Name></Room></Asset>'
                }
                throw new Error('Not found')
            })

            // Execute
            const result = await reconstructFromManifest('test.wml/')

            // Verify: Should fall back to empty baseline and still apply chunks
            expect(result.type).toBe('content')
            if (result.type === 'content') {
                expect(result.metadata.snapshotUsed).toBe(false) // Snapshot failed to load
                expect(result.metadata.chunksApplied).toBe(1)
                
                // Chunk should still be applied
                const components = result.standard.toJSON().components
                expect(components.some(c => c.universalKey === 'ROOM#lobby')).toBe(true)
            }

            // Verify warning was logged
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Snapshot test.wml/snapshots/1729418400000.wml not found'),
                expect.any(Error)
            )

            consoleWarnSpy.mockRestore()
        })

        it('should skip missing chunks but continue with others', async () => {
            // Setup: Manifest with chunks where one is missing
            const events = [
                {
                    type: 'chunk',
                    timestamp: '2025-10-20T10:00:00.000Z',
                    eventId: 'e1',
                    s3Key: 'test.wml/chunks/1729418400000-good1.wml'
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-20T11:00:00.000Z',
                    eventId: 'e2',
                    s3Key: 'test.wml/chunks/1729422000000-missing.wml'
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-20T12:00:00.000Z',
                    eventId: 'e3',
                    s3Key: 'test.wml/chunks/1729425600000-good2.wml'
                }
            ]

            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

            mockS3Get.mockImplementation(async ({ Key }) => {
                if (Key === 'test.wml/manifest-latest.ndjson') {
                    return events.map(e => JSON.stringify(e)).join('\n')
                }
                if (Key === 'test.wml/chunks/1729418400000-good1.wml') {
                    return '<Asset uuid=(test)><Room uuid=(lobby)><Name>Lobby</Name></Room></Asset>'
                }
                if (Key === 'test.wml/chunks/1729422000000-missing.wml') {
                    throw new Error('S3 object not found')
                }
                if (Key === 'test.wml/chunks/1729425600000-good2.wml') {
                    return '<Asset uuid=(test)><Feature uuid=(desk)><Name>Desk</Name></Feature></Asset>'
                }
                throw new Error('Not found')
            })

            // Execute
            const result = await reconstructFromManifest('test.wml/')

            // Verify: Should apply good chunks, skip missing one
            expect(result.type).toBe('content')
            if (result.type === 'content') {
                expect(result.metadata.chunksApplied).toBe(2) // Only 2 of 3 chunks applied
                
                // Good chunks should be present
                const components = result.standard.toJSON().components
                expect(components.some(c => c.universalKey === 'ROOM#lobby')).toBe(true)
                expect(components.some(c => c.universalKey === 'FEATURE#desk')).toBe(true)
            }

            // Verify warning was logged (download failure)
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to load chunk test.wml/chunks/1729422000000-missing.wml'),
                expect.any(Error)
            )

            consoleWarnSpy.mockRestore()
        })

        it('should skip chunks with corrupt WML but continue with others', async () => {
            // Setup: Manifest with chunks where one has corrupt WML
            const events = [
                {
                    type: 'chunk',
                    timestamp: '2025-10-20T10:00:00.000Z',
                    eventId: 'e1',
                    s3Key: 'test.wml/chunks/1729418400000-good.wml'
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-20T11:00:00.000Z',
                    eventId: 'e2',
                    s3Key: 'test.wml/chunks/1729422000000-corrupt.wml'
                }
            ]

            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

            mockS3Get.mockImplementation(async ({ Key }) => {
                if (Key === 'test.wml/manifest-latest.ndjson') {
                    return events.map(e => JSON.stringify(e)).join('\n')
                }
                if (Key === 'test.wml/chunks/1729418400000-good.wml') {
                    return '<Asset uuid=(test)><Room uuid=(lobby)><Name>Lobby</Name></Room></Asset>'
                }
                if (Key === 'test.wml/chunks/1729422000000-corrupt.wml') {
                    return '<Asset uuid=(test)><Invalid>Corrupt</Invalid></Asset>' // Invalid WML
                }
                throw new Error('Not found')
            })

            // Execute
            const result = await reconstructFromManifest('test.wml/')

            // Verify: Should apply good chunk, skip corrupt one
            expect(result.type).toBe('content')
            if (result.type === 'content') {
                expect(result.metadata.chunksApplied).toBe(1) // Only good chunk applied
                
                // Good chunk should be present
                const components = result.standard.toJSON().components
                expect(components.some(c => c.universalKey === 'ROOM#lobby')).toBe(true)
            }

            consoleWarnSpy.mockRestore()
        })
    })

    describe('Asset UUID extraction', () => {
        it('should handle UUID with ASSET# prefix in prefix', async () => {
            // Setup
            mockS3Get.mockRejectedValue({ Code: 'NoSuchKey', name: 'NoSuchKey' })

            // Execute
            const result = await reconstructFromManifest('ASSET#test.wml/')

            // Verify
            expect(result.type).toBe('content')
            if (result.type === 'content') {
                expect(result.standard.universalKey).toBe('ASSET#test')
            }
        })

        it('should handle UUID without ASSET# prefix in prefix', async () => {
            // Setup
            mockS3Get.mockRejectedValue({ Code: 'NoSuchKey', name: 'NoSuchKey' })

            // Execute
            const result = await reconstructFromManifest('myasset.wml/')

            // Verify
            expect(result.type).toBe('content')
            if (result.type === 'content') {
                expect(result.standard.universalKey).toBe('ASSET#myasset')
            }
        })
    })
})

