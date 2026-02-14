import { 
    LibraryAggregator,
    LibraryEventSerializer,
    LibrarySnapshotExternal,
    AssetAddedExternal,
    AssetRemovedExternal,
    isLibraryExternal
} from './index'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'

describe('Library EventBridge Contracts', () => {
    describe('LibraryAggregator', () => {
        let aggregator: LibraryAggregator

        beforeEach(() => {
            aggregator = new LibraryAggregator()
        })

        describe('createEmpty', () => {
            it('should create an empty snapshot', () => {
                const snapshot = aggregator.createEmpty()
                
                expect(snapshot).toEqual({
                    type: 'Snapshot',
                    assetIds: []
                })
            })
        })

        describe('applyUpdate', () => {
            describe('Asset Added events', () => {
                it('should add a new asset to an empty snapshot', () => {
                    const emptySnapshot = aggregator.createEmpty()
                    const assetId: AssetUUID = 'ASSET#test1'
                    
                    const result = aggregator.applyUpdate(emptySnapshot, {
                        type: 'Asset Added',
                        assetId
                    })

                    expect(result.success).toBe(true)
                    if (result.success) {
                        expect(result.snapshot.assetIds).toHaveLength(1)
                        expect(result.snapshot.assetIds).toContain('ASSET#test1')
                    }
                })

                it('should add multiple assets sequentially', () => {
                    const snapshot = aggregator.createEmpty()
                    
                    const result1 = aggregator.applyUpdate(snapshot, {
                        type: 'Asset Added',
                        assetId: 'ASSET#test1' as AssetUUID
                    })

                    expect(result1.success).toBe(true)
                    if (!result1.success) return

                    const result2 = aggregator.applyUpdate(result1.snapshot, {
                        type: 'Asset Added',
                        assetId: 'ASSET#test2' as AssetUUID
                    })

                    expect(result2.success).toBe(true)
                    if (result2.success) {
                        expect(result2.snapshot.assetIds).toHaveLength(2)
                        expect(result2.snapshot.assetIds).toContain('ASSET#test1')
                        expect(result2.snapshot.assetIds).toContain('ASSET#test2')
                    }
                })

                it('should be idempotent (adding same asset twice does nothing)', () => {
                    const snapshot = aggregator.createEmpty()
                    
                    const result1 = aggregator.applyUpdate(snapshot, {
                        type: 'Asset Added',
                        assetId: 'ASSET#test1' as AssetUUID
                    })

                    expect(result1.success).toBe(true)
                    if (!result1.success) return

                    // Add same asset again
                    const result2 = aggregator.applyUpdate(result1.snapshot, {
                        type: 'Asset Added',
                        assetId: 'ASSET#test1' as AssetUUID
                    })

                    expect(result2.success).toBe(true)
                    if (result2.success) {
                        expect(result2.snapshot.assetIds).toHaveLength(1)
                        expect(result2.snapshot.assetIds).toContain('ASSET#test1')
                    }
                })
            })

            describe('Asset Removed events', () => {
                it('should remove an existing asset', () => {
                    const snapshot = {
                        type: 'Snapshot' as const,
                        assetIds: ['ASSET#test1', 'ASSET#test2', 'ASSET#test3'] as AssetUUID[]
                    }
                    
                    const result = aggregator.applyUpdate(snapshot, {
                        type: 'Asset Removed',
                        assetId: 'ASSET#test2' as AssetUUID
                    })

                    expect(result.success).toBe(true)
                    if (result.success) {
                        expect(result.snapshot.assetIds).toHaveLength(2)
                        expect(result.snapshot.assetIds).toContain('ASSET#test1')
                        expect(result.snapshot.assetIds).toContain('ASSET#test3')
                        expect(result.snapshot.assetIds).not.toContain('ASSET#test2')
                    }
                })

                it('should be idempotent (removing non-existent asset does nothing)', () => {
                    const snapshot = {
                        type: 'Snapshot' as const,
                        assetIds: ['ASSET#test1', 'ASSET#test2'] as AssetUUID[]
                    }
                    
                    const result = aggregator.applyUpdate(snapshot, {
                        type: 'Asset Removed',
                        assetId: 'ASSET#nonexistent' as AssetUUID
                    })

                    expect(result.success).toBe(true)
                    if (result.success) {
                        expect(result.snapshot.assetIds).toHaveLength(2)
                        expect(result.snapshot.assetIds).toEqual(snapshot.assetIds)
                    }
                })

                it('should handle removing the last asset', () => {
                    const snapshot = {
                        type: 'Snapshot' as const,
                        assetIds: ['ASSET#test1'] as AssetUUID[]
                    }
                    
                    const result = aggregator.applyUpdate(snapshot, {
                        type: 'Asset Removed',
                        assetId: 'ASSET#test1' as AssetUUID
                    })

                    expect(result.success).toBe(true)
                    if (result.success) {
                        expect(result.snapshot.assetIds).toHaveLength(0)
                    }
                })
            })

            describe('Snapshot events', () => {
                it('should replace entire snapshot', () => {
                    const oldSnapshot = {
                        type: 'Snapshot' as const,
                        assetIds: ['ASSET#old1', 'ASSET#old2'] as AssetUUID[]
                    }

                    const newSnapshot = {
                        type: 'Snapshot' as const,
                        assetIds: ['ASSET#new1', 'ASSET#new2', 'ASSET#new3'] as AssetUUID[]
                    }
                    
                    const result = aggregator.applyUpdate(oldSnapshot, newSnapshot)

                    expect(result.success).toBe(true)
                    if (result.success) {
                        expect(result.snapshot).toEqual(newSnapshot)
                        expect(result.snapshot.assetIds).toHaveLength(3)
                        expect(result.snapshot.assetIds).not.toContain('ASSET#old1')
                    }
                })

                it('should handle empty snapshot replacement', () => {
                    const oldSnapshot = {
                        type: 'Snapshot' as const,
                        assetIds: ['ASSET#test1', 'ASSET#test2'] as AssetUUID[]
                    }

                    const newSnapshot = {
                        type: 'Snapshot' as const,
                        assetIds: [] as AssetUUID[]
                    }
                    
                    const result = aggregator.applyUpdate(oldSnapshot, newSnapshot)

                    expect(result.success).toBe(true)
                    if (result.success) {
                        expect(result.snapshot.assetIds).toHaveLength(0)
                    }
                })
            })

            describe('Error handling', () => {
                it('should return error for unknown event type', () => {
                    const snapshot = aggregator.createEmpty()
                    
                    const result = aggregator.applyUpdate(snapshot, {
                        type: 'Unknown Event',
                        data: 'invalid'
                    } as any)

                    expect(result.success).toBe(false)
                    if (!result.success) {
                        expect(result.error).toBeInstanceOf(Error)
                        expect(result.error.message).toContain('Unknown update type')
                    }
                })

                it('should return unchanged snapshot on error', () => {
                    const snapshot = {
                        type: 'Snapshot' as const,
                        assetIds: ['ASSET#test1'] as AssetUUID[]
                    }

                    const result = aggregator.applyUpdate(snapshot, {
                        type: 'Invalid Type'
                    } as any)

                    expect(result.success).toBe(false)
                    if (!result.success) {
                        expect(result.snapshot).toBe(snapshot)
                    }
                })
            })

            describe('Immutability', () => {
                it('should not mutate the original snapshot on Asset Added', () => {
                    const originalSnapshot = {
                        type: 'Snapshot' as const,
                        assetIds: ['ASSET#test1'] as AssetUUID[]
                    }
                    const originalLength = originalSnapshot.assetIds.length
                    
                    aggregator.applyUpdate(originalSnapshot, {
                        type: 'Asset Added',
                        assetId: 'ASSET#test2' as AssetUUID
                    })

                    expect(originalSnapshot.assetIds.length).toBe(originalLength)
                    expect(originalSnapshot.assetIds).toEqual(['ASSET#test1'])
                })

                it('should not mutate the original snapshot on Asset Removed', () => {
                    const originalSnapshot = {
                        type: 'Snapshot' as const,
                        assetIds: ['ASSET#test1', 'ASSET#test2'] as AssetUUID[]
                    }
                    const originalIds = [...originalSnapshot.assetIds]
                    
                    aggregator.applyUpdate(originalSnapshot, {
                        type: 'Asset Removed',
                        assetId: 'ASSET#test1' as AssetUUID
                    })

                    expect(originalSnapshot.assetIds).toEqual(originalIds)
                })

                it('should return new array reference', () => {
                    const snapshot = {
                        type: 'Snapshot' as const,
                        assetIds: ['ASSET#test1'] as AssetUUID[]
                    }
                    
                    const result = aggregator.applyUpdate(snapshot, {
                        type: 'Asset Added',
                        assetId: 'ASSET#test2' as AssetUUID
                    })

                    expect(result.success).toBe(true)
                    if (result.success) {
                        expect(result.snapshot.assetIds).not.toBe(snapshot.assetIds)
                    }
                })
            })
        })
    })

    describe('LibraryEventSerializer', () => {
        let serializer: LibraryEventSerializer

        beforeEach(() => {
            serializer = new LibraryEventSerializer()
        })

        const libraryHeader = (type: string) => ({ dataSourceKey: 'mtw.assets.library', streamKey: 'global', timestamp: 0, type })

        describe('serialize', () => {
            it('should serialize Asset Added event', () => {
                const result = serializer.serialize({
                    dataSourceKey: 'mtw.assets.library',
                    streamKey: 'global',
                    update: {
                        type: 'Asset Added',
                        assetId: 'ASSET#test1' as AssetUUID
                    },
                    header: libraryHeader('Asset Added')
                })

                expect(result).toEqual({
                    type: 'Asset Added',
                    assetId: 'ASSET#test1'
                })
            })

            it('should serialize Asset Removed event', () => {
                const result = serializer.serialize({
                    dataSourceKey: 'mtw.assets.library',
                    streamKey: 'global',
                    update: {
                        type: 'Asset Removed',
                        assetId: 'ASSET#test2' as AssetUUID
                    },
                    header: libraryHeader('Asset Removed')
                })

                expect(result).toEqual({
                    type: 'Asset Removed',
                    assetId: 'ASSET#test2'
                })
            })

            it('should throw error for unknown event type', () => {
                expect(() => {
                    serializer.serialize({
                        dataSourceKey: 'mtw.assets.library',
                        streamKey: 'global',
                        update: {
                            type: 'Invalid',
                            data: 'bad'
                        } as any,
                        header: libraryHeader('Invalid')
                    })
                }).toThrow('Unknown streaming event type')
            })
        })

        describe('deserialize', () => {
            it('should deserialize Asset Added event', () => {
                const externalUpdate: AssetAddedExternal = {
                    type: 'Asset Added',
                    assetId: 'ASSET#test1' as AssetUUID
                }

                const result = serializer.deserialize({
                    dataSourceKey: 'mtw.assets.library',
                    streamKey: 'global',
                    externalUpdate,
                    header: libraryHeader('Asset Added')
                })

                expect(result).toEqual({
                    type: 'Asset Added',
                    assetId: 'ASSET#test1'
                })
            })

            it('should deserialize Asset Removed event', () => {
                const externalUpdate: AssetRemovedExternal = {
                    type: 'Asset Removed',
                    assetId: 'ASSET#test2' as AssetUUID
                }

                const result = serializer.deserialize({
                    dataSourceKey: 'mtw.assets.library',
                    streamKey: 'global',
                    externalUpdate,
                    header: libraryHeader('Asset Removed')
                })

                expect(result).toEqual({
                    type: 'Asset Removed',
                    assetId: 'ASSET#test2'
                })
            })

            it('should return null for invalid Asset Added event', () => {
                const externalUpdate = {
                    type: 'Asset Added',
                    assetId: 123 // Invalid: not a string
                } as any

                const result = serializer.deserialize({
                    dataSourceKey: 'mtw.assets.library',
                    streamKey: 'global',
                    externalUpdate,
                    header: libraryHeader('Asset Added')
                })

                expect(result).toBeNull()
            })

            it('should return null for invalid Asset Removed event', () => {
                const externalUpdate = {
                    type: 'Asset Removed',
                    assetId: null // Invalid: not a string
                } as any

                const result = serializer.deserialize({
                    dataSourceKey: 'mtw.assets.library',
                    streamKey: 'global',
                    externalUpdate,
                    header: libraryHeader('Asset Removed')
                })

                expect(result).toBeNull()
            })

            it('should return null for unknown event type', () => {
                const externalUpdate = {
                    type: 'Unknown Type',
                    data: 'invalid'
                } as any

                const result = serializer.deserialize({
                    dataSourceKey: 'mtw.assets.library',
                    streamKey: 'global',
                    externalUpdate,
                    header: libraryHeader('Unknown Type')
                })

                expect(result).toBeNull()
            })
        })

        describe('deserialize when header and payload type disagree - header wins', () => {
            it('should deserialize as Asset Removed when header says Asset Removed but payload has Asset Added shape', () => {
                const externalUpdate: AssetAddedExternal = {
                    type: 'Asset Added',
                    assetId: 'ASSET#test1' as AssetUUID
                }

                const result = serializer.deserialize({
                    dataSourceKey: 'mtw.assets.library',
                    streamKey: 'global',
                    externalUpdate,
                    header: libraryHeader('Asset Removed')
                })

                expect(result).toEqual({
                    type: 'Asset Removed',
                    assetId: 'ASSET#test1'
                })
            })
        })

        describe('serializeSnapshot', () => {
            it('should serialize snapshot with multiple assets', () => {
                const snapshot = {
                    type: 'Snapshot' as const,
                    assetIds: ['ASSET#test1', 'ASSET#test2', 'ASSET#test3'] as AssetUUID[]
                }

                const result = serializer.serializeSnapshot(snapshot)

                expect(result).toEqual({
                    type: 'Snapshot',
                    assetIds: ['ASSET#test1', 'ASSET#test2', 'ASSET#test3']
                })
            })

            it('should serialize empty snapshot', () => {
                const snapshot = {
                    type: 'Snapshot' as const,
                    assetIds: [] as AssetUUID[]
                }

                const result = serializer.serializeSnapshot(snapshot)

                expect(result).toEqual({
                    type: 'Snapshot',
                    assetIds: []
                })
            })

            it('should return new array (not mutate original)', () => {
                const snapshot = {
                    type: 'Snapshot' as const,
                    assetIds: ['ASSET#test1'] as AssetUUID[]
                }

                const result = serializer.serializeSnapshot(snapshot)

                expect(result.assetIds).not.toBe(snapshot.assetIds)
                expect(result.assetIds).toEqual(snapshot.assetIds)
            })
        })

        describe('deserializeSnapshot', () => {
            it('should deserialize snapshot with multiple assets', () => {
                const externalSnapshot: LibrarySnapshotExternal = {
                    type: 'Snapshot',
                    assetIds: ['ASSET#test1', 'ASSET#test2', 'ASSET#test3'] as AssetUUID[]
                }

                const result = serializer.deserializeSnapshot(externalSnapshot)

                expect(result).toEqual({
                    type: 'Snapshot',
                    assetIds: ['ASSET#test1', 'ASSET#test2', 'ASSET#test3']
                })
            })

            it('should deserialize empty snapshot', () => {
                const externalSnapshot: LibrarySnapshotExternal = {
                    type: 'Snapshot',
                    assetIds: [] as AssetUUID[]
                }

                const result = serializer.deserializeSnapshot(externalSnapshot)

                expect(result).toEqual({
                    type: 'Snapshot',
                    assetIds: []
                })
            })

            it('should return null if assetIds is not an array', () => {
                const externalSnapshot = {
                    type: 'Snapshot',
                    assetIds: 'not-an-array'
                } as any

                const result = serializer.deserializeSnapshot(externalSnapshot)

                expect(result).toBeNull()
            })

            it('should return null if assetIds contains non-strings', () => {
                const externalSnapshot = {
                    type: 'Snapshot',
                    assetIds: ['ASSET#test1', 123, 'ASSET#test2']
                } as any

                const result = serializer.deserializeSnapshot(externalSnapshot)

                expect(result).toBeNull()
            })

            it('should return new array (not reference original)', () => {
                const externalSnapshot: LibrarySnapshotExternal = {
                    type: 'Snapshot',
                    assetIds: ['ASSET#test1'] as AssetUUID[]
                }

                const result = serializer.deserializeSnapshot(externalSnapshot)

                expect(result).not.toBeNull()
                expect(result!.assetIds).not.toBe(externalSnapshot.assetIds)
                expect(result!.assetIds).toEqual(externalSnapshot.assetIds)
            })
        })
    })

    describe('isLibraryExternal', () => {
        it('should return true for valid Snapshot event', () => {
            const event: LibrarySnapshotExternal = {
                type: 'Snapshot',
                assetIds: ['ASSET#test1', 'ASSET#test2'] as AssetUUID[]
            }

            expect(isLibraryExternal(event)).toBe(true)
        })

        it('should return true for valid Asset Added event', () => {
            const event: AssetAddedExternal = {
                type: 'Asset Added',
                assetId: 'ASSET#test1' as AssetUUID
            }

            expect(isLibraryExternal(event)).toBe(true)
        })

        it('should return true for valid Asset Removed event', () => {
            const event: AssetRemovedExternal = {
                type: 'Asset Removed',
                assetId: 'ASSET#test1' as AssetUUID
            }

            expect(isLibraryExternal(event)).toBe(true)
        })

        it('should return false for Snapshot with non-array assetIds', () => {
            const event = {
                type: 'Snapshot',
                assetIds: 'not-an-array'
            }

            expect(isLibraryExternal(event)).toBe(false)
        })

        it('should return false for Snapshot with non-string assetIds', () => {
            const event = {
                type: 'Snapshot',
                assetIds: ['ASSET#test1', 123]
            }

            expect(isLibraryExternal(event)).toBe(false)
        })

        it('should return false for Asset Added with non-string assetId', () => {
            const event = {
                type: 'Asset Added',
                assetId: 123
            }

            expect(isLibraryExternal(event)).toBe(false)
        })

        it('should return false for Asset Removed with non-string assetId', () => {
            const event = {
                type: 'Asset Removed',
                assetId: null
            }

            expect(isLibraryExternal(event)).toBe(false)
        })

        it('should return false for unknown event type', () => {
            const event = {
                type: 'Unknown',
                data: 'invalid'
            }

            expect(isLibraryExternal(event)).toBe(false)
        })

        it('should return false for null', () => {
            expect(isLibraryExternal(null)).toBe(false)
        })

        it('should return false for undefined', () => {
            expect(isLibraryExternal(undefined)).toBe(false)
        })

        it('should return false for object without type', () => {
            const event = {
                assetIds: ['ASSET#test1']
            }

            expect(isLibraryExternal(event)).toBe(false)
        })
    })
})

