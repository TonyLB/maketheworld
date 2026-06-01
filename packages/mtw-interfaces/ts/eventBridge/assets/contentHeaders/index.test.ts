import {
    ContentHeadersAggregator,
    ContentHeadersEventSerializer,
    ContentHeadersSnapshot,
    ContentHeadersSnapshotExternal,
    ContentHeadersUpdateExternal,
    ZoneUpdatedEventExternal,
    isContentHeadersUpdate,
    isZoneUpdatedEvent,
    isContentHeadersExternal
} from './index'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

function contentHeadersHeader(type: string): StreamingEventHeader {
    return { dataSourceKey: 'mtw.assets.contentHeaders', streamKey: 'test', timestamp: 0, type }
}

function contentHeadersEnvelope<T>(content: T, type: string) {
    return { header: contentHeadersHeader(type), content }
}

describe('ContentHeaders EventBridge Contracts', () => {
    describe('ContentHeadersAggregator', () => {
        let aggregator: ContentHeadersAggregator

        beforeEach(() => {
            aggregator = new ContentHeadersAggregator()
        })

        describe('createEmpty', () => {
            it('should create an empty snapshot', () => {
                const snapshot = aggregator.createEmpty('test')
                
                expect(snapshot).toEqual({
                    assets: []
                })
            })
        })

        describe('applyUpdate', () => {
            describe('Headers Updated events', () => {
                it('should add a new asset when it does not exist', () => {
                    const emptySnapshot = aggregator.createEmpty('test')
                    const standardForm = new StandardForm(deIndentWML(`
                        <Asset uuid=(test)>
                            <Room key=(room1)><ShortName>Test Room</ShortName></Room>
                        </Asset>
                    `))
                    
                    const result = aggregator.applyUpdate(emptySnapshot, contentHeadersEnvelope({
                        assetId: 'ASSET#test',
                        zone: 'Canon',
                        standardForm
                    }, 'Headers Updated'))

                    expect(result.success).toBe(true)
                    if (result.success) {
                        expect(result.snapshot.assets).toHaveLength(1)
                        expect(result.snapshot.assets[0]).toEqual({
                            assetId: 'ASSET#test',
                            zone: 'Canon',
                            standardForm
                        })
                    }
                })

                it('should merge StandardForms when asset already exists', () => {
                    // Create initial snapshot with an asset
                    const initialStandardForm = new StandardForm(deIndentWML(`
                        <Asset uuid=(test)>
                            <Room key=(room1)><ShortName>Room 1</ShortName></Room>
                        </Asset>
                    `))
                    
                    const snapshot = {
                        type: 'Snapshot' as const,
                        assets: [{
                            assetId: 'ASSET#test' as const,
                            zone: 'Canon' as const,
                            standardForm: initialStandardForm
                        }]
                    }

                    // Create update with additional component
                    const updateStandardForm = new StandardForm(deIndentWML(`
                        <Asset uuid=(test)>
                            <Room key=(room2)><ShortName>Room 2</ShortName></Room>
                        </Asset>
                    `))
                    
                    const result = aggregator.applyUpdate(snapshot, contentHeadersEnvelope({
                        assetId: 'ASSET#test',
                        zone: 'Canon',
                        standardForm: updateStandardForm
                    }, 'Headers Updated'))

                    expect(result.success).toBe(true)
                    if (result.success) {
                        expect(result.snapshot.assets).toHaveLength(1)
                        // The merged StandardForm should have both rooms
                        const mergedForm = result.snapshot.assets[0].standardForm
                        expect(mergedForm._components).toHaveLength(2)
                        expect(mergedForm.byId['room1']).toBeDefined()
                        expect(mergedForm.byId['room2']).toBeDefined()
                    }
                })

                it('should handle edits in the update StandardForm (Edits to be Applied mode)', () => {
                    // Create initial snapshot with a room
                    const initialStandardForm = new StandardForm(deIndentWML(`
                        <Asset uuid=(test)>
                            <Room key=(room1)><ShortName>Original Name</ShortName></Room>
                        </Asset>
                    `))
                    
                    const snapshot = {
                        type: 'Snapshot' as const,
                        assets: [{
                            assetId: 'ASSET#test' as const,
                            zone: 'Canon' as const,
                            standardForm: initialStandardForm
                        }]
                    }

                    // Create update with a replace edit
                    const updateStandardForm = new StandardForm(deIndentWML(`
                        <Asset uuid=(test)>
                            <Room key=(room1)>
                                <Replace><ShortName>Original Name</ShortName></Replace>
                                <With><ShortName>Updated Name</ShortName></With>
                            </Room>
                        </Asset>
                    `))
                    
                    const result = aggregator.applyUpdate(snapshot, contentHeadersEnvelope({
                        assetId: 'ASSET#test',
                        zone: 'Canon',
                        standardForm: updateStandardForm
                    }, 'Headers Updated'))

                    expect(result.success).toBe(true)
                    if (result.success) {
                        expect(result.snapshot.assets).toHaveLength(1)
                        // The merged StandardForm should contain the room with the edit components
                        const mergedForm = result.snapshot.assets[0].standardForm
                        const room = mergedForm.byId['room1'] as any
                        expect(room).toBeDefined()
                        // After merge, edits are present in the component structure
                        expect(mergedForm._components).toHaveLength(1)
                    }
                })

                it('should update zone when processing update for existing asset', () => {
                    const initialStandardForm = new StandardForm(deIndentWML(`
                        <Asset uuid=(test)>
                            <Room key=(room1)><ShortName>Test Room</ShortName></Room>
                        </Asset>
                    `))
                    
                    const snapshot = {
                        type: 'Snapshot' as const,
                        assets: [{
                            assetId: 'ASSET#test' as const,
                            zone: 'Canon' as const,
                            standardForm: initialStandardForm
                        }]
                    }

                    const updateStandardForm = new StandardForm(deIndentWML(`
                        <Asset uuid=(test)>
                            <Room key=(room2)><ShortName>Room 2</ShortName></Room>
                        </Asset>
                    `))
                    
                    const result = aggregator.applyUpdate(snapshot, contentHeadersEnvelope({
                        assetId: 'ASSET#test',
                        zone: 'Library',
                        standardForm: updateStandardForm
                    }, 'Headers Updated'))

                    expect(result.success).toBe(true)
                    if (result.success) {
                        expect(result.snapshot.assets[0].zone).toBe('Library')
                    }
                })

                it('should handle multiple different assets', () => {
                    const snapshot = aggregator.createEmpty('test')
                    
                    // Add first asset
                    const result1 = aggregator.applyUpdate(snapshot, contentHeadersEnvelope({
                        assetId: 'ASSET#test1',
                        zone: 'Canon',
                        standardForm: new StandardForm(deIndentWML(`
                            <Asset uuid=(test1)>
                                <Room key=(room1)><ShortName>Room 1</ShortName></Room>
                            </Asset>
                        `))
                    }, 'Headers Updated'))

                    expect(result1.success).toBe(true)
                    if (!result1.success) return

                    // Add second asset
                    const result2 = aggregator.applyUpdate(result1.snapshot, contentHeadersEnvelope({
                        assetId: 'ASSET#test2',
                        zone: 'Library',
                        standardForm: new StandardForm(deIndentWML(`
                            <Asset uuid=(test2)>
                                <Room key=(room2)><ShortName>Room 2</ShortName></Room>
                            </Asset>
                        `))
                    }, 'Headers Updated'))

                    expect(result2.success).toBe(true)
                    if (result2.success) {
                        expect(result2.snapshot.assets).toHaveLength(2)
                        expect(result2.snapshot.assets[0].assetId).toBe('ASSET#test1')
                        expect(result2.snapshot.assets[1].assetId).toBe('ASSET#test2')
                    }
                })
            })

            describe('Zone Updated events', () => {
                it('should update zone for existing asset', () => {
                    const initialStandardForm = new StandardForm(deIndentWML(`
                        <Asset uuid=(test)>
                            <Room key=(room1)><ShortName>Test Room</ShortName></Room>
                        </Asset>
                    `))
                    
                    const snapshot = {
                        type: 'Snapshot' as const,
                        assets: [{
                            assetId: 'ASSET#test' as const,
                            zone: 'Canon' as const,
                            standardForm: initialStandardForm
                        }]
                    }
                    
                    const result = aggregator.applyUpdate(snapshot, contentHeadersEnvelope({
                        assetId: 'ASSET#test',
                        fromZone: 'Canon',
                        toZone: 'Library'
                    }, 'Zone Updated'))

                    expect(result.success).toBe(true)
                    if (result.success) {
                        expect(result.snapshot.assets).toHaveLength(1)
                        expect(result.snapshot.assets[0].zone).toBe('Library')
                        // StandardForm should remain unchanged
                        expect(result.snapshot.assets[0].standardForm).toBe(initialStandardForm)
                    }
                })

                it('should create placeholder when asset does not exist', () => {
                    const snapshot = aggregator.createEmpty('test')
                    
                    const result = aggregator.applyUpdate(snapshot, contentHeadersEnvelope({
                        assetId: 'ASSET#nonexistent',
                        fromZone: 'Canon',
                        toZone: 'Library'
                    }, 'Zone Updated'))

                    expect(result.success).toBe(true)
                    if (result.success) {
                        expect(result.snapshot.assets).toHaveLength(1)
                        expect(result.snapshot.assets[0].assetId).toBe('ASSET#nonexistent')
                        expect(result.snapshot.assets[0].zone).toBe('Library')
                        expect(result.snapshot.assets[0].standardForm).toBeInstanceOf(StandardForm)
                        // Placeholder should have no components
                        expect(result.snapshot.assets[0].standardForm._components).toHaveLength(0)
                    }
                })

                it('should preserve other assets when updating zone', () => {
                    const snapshot = {
                        type: 'Snapshot' as const,
                        assets: [
                            {
                                assetId: 'ASSET#test1' as const,
                                zone: 'Canon' as const,
                                standardForm: new StandardForm(deIndentWML(`
                                    <Asset uuid=(test1)>
                                        <Room key=(room1)><ShortName>Room 1</ShortName></Room>
                                    </Asset>
                                `))
                            },
                            {
                                assetId: 'ASSET#test2' as const,
                                zone: 'Library' as const,
                                standardForm: new StandardForm(deIndentWML(`
                                    <Asset uuid=(test2)>
                                        <Room key=(room2)><ShortName>Room 2</ShortName></Room>
                                    </Asset>
                                `))
                            }
                        ]
                    }
                    
                    const result = aggregator.applyUpdate(snapshot, contentHeadersEnvelope({
                        assetId: 'ASSET#test1',
                        fromZone: 'Canon',
                        toZone: 'Personal'
                    }, 'Zone Updated'))

                    expect(result.success).toBe(true)
                    if (result.success) {
                        expect(result.snapshot.assets).toHaveLength(2)
                        // Find each asset and check its zone (order doesn't matter)
                        const test1 = result.snapshot.assets.find(a => a.assetId === 'ASSET#test1')
                        const test2 = result.snapshot.assets.find(a => a.assetId === 'ASSET#test2')
                        expect(test1?.zone).toBe('Personal')
                        expect(test2?.zone).toBe('Library')
                    }
                })
            })

            describe('Snapshot events', () => {
                it('should replace entire snapshot', () => {
                    const oldSnapshot = {
                        type: 'Snapshot' as const,
                        assets: [{
                            assetId: 'ASSET#old' as const,
                            zone: 'Canon' as const,
                            standardForm: new StandardForm('<Asset uuid=(old)></Asset>')
                        }]
                    }

                    const newSnapshot = {
                        type: 'Snapshot' as const,
                        assets: [{
                            assetId: 'ASSET#new' as const,
                            zone: 'Library' as const,
                            standardForm: new StandardForm('<Asset uuid=(new)></Asset>')
                        }]
                    }
                    
                    const result = aggregator.applyUpdate(oldSnapshot, contentHeadersEnvelope(newSnapshot, 'Snapshot'))

                    expect(result.success).toBe(true)
                    if (result.success) {
                        expect(result.snapshot).toEqual(newSnapshot)
                    }
                })
            })

            describe('Error handling', () => {
                it('should return error when merge fails', () => {
                    // Create a snapshot with a StandardForm
                    const snapshot = {
                        type: 'Snapshot' as const,
                        assets: [{
                            assetId: 'ASSET#test' as const,
                            zone: 'Canon' as const,
                            standardForm: new StandardForm(`<Asset uuid=(test)>
                                <Room key=(room1)><ShortName>Room 1</ShortName></Room>
                            </Asset>`)
                        }]
                    }

                    // Create a malformed StandardForm that will cause merge to throw
                    // We'll mock the merge method to throw an error
                    const updateStandardForm = new StandardForm(`<Asset uuid=(test)>
                        <Room key=(room2)><ShortName>Room 2</ShortName></Room>
                    </Asset>`)
                    
                    // Mock merge to throw an error
                    const originalMerge = snapshot.assets[0].standardForm.merge
                    snapshot.assets[0].standardForm.merge = jest.fn(() => {
                        throw new Error('Merge conflict')
                    })
                    
                    const result = aggregator.applyUpdate(snapshot, contentHeadersEnvelope({
                        assetId: 'ASSET#test',
                        zone: 'Canon',
                        standardForm: updateStandardForm
                    }, 'Headers Updated'))

                    // Restore original merge
                    snapshot.assets[0].standardForm.merge = originalMerge

                    expect(result.success).toBe(false)
                    if (!result.success) {
                        expect(result.error).toBeInstanceOf(Error)
                        expect(result.error.message).toBe('Merge conflict')
                    }
                })

                it('should return unchanged snapshot on error', () => {
                    const snapshot = {
                        type: 'Snapshot' as const,
                        assets: [{
                            assetId: 'ASSET#test' as const,
                            zone: 'Canon' as const,
                            standardForm: new StandardForm('<Asset uuid=(test)></Asset>')
                        }]
                    }

                    // Mock merge to throw an error
                    const originalMerge = snapshot.assets[0].standardForm.merge
                    snapshot.assets[0].standardForm.merge = jest.fn(() => {
                        throw new Error('Merge error')
                    })

                    const result = aggregator.applyUpdate(snapshot, contentHeadersEnvelope({
                        assetId: 'ASSET#test',
                        zone: 'Canon',
                        standardForm: new StandardForm('<Asset uuid=(test)><Room key=(room1)></Room></Asset>')
                    }, 'Headers Updated'))

                    // Restore original merge
                    snapshot.assets[0].standardForm.merge = originalMerge

                    expect(result.success).toBe(false)
                    if (!result.success) {
                        expect(result.snapshot).toBe(snapshot)
                    }
                })
            })

            describe('Immutability', () => {
                it('should not mutate the original snapshot on Headers Updated', () => {
                    const originalSnapshot = {
                        type: 'Snapshot' as const,
                        assets: [{
                            assetId: 'ASSET#test' as const,
                            zone: 'Canon' as const,
                            standardForm: new StandardForm('<Asset uuid=(test)></Asset>')
                        }]
                    }
                    const originalAssetsLength = originalSnapshot.assets.length
                    
                    aggregator.applyUpdate(originalSnapshot, contentHeadersEnvelope({
                        assetId: 'ASSET#new',
                        zone: 'Library',
                        standardForm: new StandardForm('<Asset uuid=(new)></Asset>')
                    }, 'Headers Updated'))

                    expect(originalSnapshot.assets.length).toBe(originalAssetsLength)
                })

                it('should not mutate the original snapshot on Zone Updated', () => {
                    const originalSnapshot = {
                        type: 'Snapshot' as const,
                        assets: [{
                            assetId: 'ASSET#test' as const,
                            zone: 'Canon' as const,
                            standardForm: new StandardForm('<Asset uuid=(test)></Asset>')
                        }]
                    }
                    const originalZone = originalSnapshot.assets[0].zone
                    
                    aggregator.applyUpdate(originalSnapshot, contentHeadersEnvelope({
                        assetId: 'ASSET#test',
                        fromZone: 'Canon',
                        toZone: 'Library'
                    }, 'Zone Updated'))

                    expect(originalSnapshot.assets[0].zone).toBe(originalZone)
                })
            })
        })
    })

    describe('ContentHeadersEventSerializer', () => {
        let serializer: ContentHeadersEventSerializer

        beforeEach(() => {
            serializer = new ContentHeadersEventSerializer()
        })

        describe('serialize', () => {
            it('should serialize Headers Updated event to external format', () => {
                const standardForm = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room key=(room1)><ShortName>Test Room</ShortName></Room>
                    </Asset>
                `))

                const result = serializer.serialize({
                    content: {
                        assetId: 'ASSET#test',
                        zone: 'Canon',
                        standardForm
                    },
                    header: { dataSourceKey: 'mtw.assets.contentHeaders', streamKey: 'global', timestamp: 0, type: 'Headers Updated' }
                })

                expect(result).toEqual({
                    assetId: 'ASSET#test',
                    zone: 'Canon',
                    wml: expect.any(String)
                })

                // Verify WML is correctly serialized
                const external = result as ContentHeadersUpdateExternal
                expect(external.wml).toContain('<Asset uuid=(test)>')
                expect(external.wml).toContain('<Room key=(room1)>')
            })

            it('should serialize Zone Updated event to external format', () => {
                const result = serializer.serialize({
                    content: {
                        assetId: 'ASSET#test',
                        fromZone: 'Canon',
                        toZone: 'Archive'
                    },
                    header: { dataSourceKey: 'mtw.assets.contentHeaders', streamKey: 'global', timestamp: 0, type: 'Zone Updated' }
                })

                expect(result).toEqual({
                    assetId: 'ASSET#test',
                    fromZone: 'Canon',
                    toZone: 'Archive'
                })
            })
        })

        describe('deserialize', () => {
            it('should deserialize Headers Updated event from external format', async () => {
                const externalUpdate: ContentHeadersUpdateExternal = {
                    assetId: 'ASSET#test',
                    zone: 'Canon',
                    wml: '<Asset uuid=(test)><Room key=(room1)><ShortName>Test Room</ShortName></Room></Asset>'
                }

                const result = await serializer.deserialize({
                    content: externalUpdate,
                    header: { dataSourceKey: 'mtw.assets.contentHeaders', streamKey: 'global', timestamp: 0, type: 'Headers Updated' }
                })

                expect(result).not.toBeNull()
                if (!result) return
                expect(isContentHeadersUpdate(result)).toBe(true)
                if (isContentHeadersUpdate(result)) {
                    expect(result.assetId).toBe('ASSET#test')
                    expect(result.zone).toBe('Canon')
                    expect(result.standardForm).toBeInstanceOf(StandardForm)
                }
            })

            it('should deserialize Zone Updated event from external format', async () => {
                const externalUpdate: ZoneUpdatedEventExternal = {
                    assetId: 'ASSET#test',
                    fromZone: 'Canon',
                    toZone: 'Archive'
                }

                const result = await serializer.deserialize({
                    content: externalUpdate,
                    header: { dataSourceKey: 'mtw.assets.contentHeaders', streamKey: 'global', timestamp: 0, type: 'Zone Updated' }
                })

                expect(result).not.toBeNull()
                if (!result) return
                expect(isZoneUpdatedEvent(result)).toBe(true)
                if (isZoneUpdatedEvent(result)) {
                    expect(result.assetId).toBe('ASSET#test')
                    expect(result.fromZone).toBe('Canon')
                    expect(result.toZone).toBe('Archive')
                }
            })
        })

        describe('serialize/deserialize handle Snapshot when header.type is Snapshot', () => {
            it('should serialize Snapshot via main serialize when header.type is Snapshot', () => {
                const snapshot = {
                    type: 'Snapshot' as const,
                    assets: [
                        {
                            assetId: 'ASSET#test1' as const,
                            zone: 'Canon' as const,
                            standardForm: new StandardForm('<Asset uuid=(test1)><Room key=(room1)><ShortName>Room 1</ShortName></Room></Asset>')
                        }
                    ]
                }
                const header = { dataSourceKey: 'mtw.assets.contentHeaders', streamKey: 'test', timestamp: 0, type: 'Snapshot' as const }
                const result = serializer.serialize({ content: snapshot, header }) as ContentHeadersSnapshotExternal
                expect(result.assets).toHaveLength(1)
                expect(result.assets[0].assetId).toBe('ASSET#test1')
                expect(result.assets[0].zone).toBe('Canon')
                expect(result.assets[0].wml).toEqual(expect.any(String))
            })

            it('should deserialize Snapshot via main deserialize when header.type is Snapshot', async () => {
                const externalSnapshot: ContentHeadersSnapshotExternal = {
                    assets: [
                        {
                            assetId: 'ASSET#test1',
                            zone: 'Canon',
                            wml: '<Asset uuid=(test1)><Room key=(room1)><ShortName>Room 1</ShortName></Room></Asset>'
                        }
                    ]
                }
                const header = { dataSourceKey: 'mtw.assets.contentHeaders', streamKey: 'test', timestamp: 0, type: 'Snapshot' as const }
                const result = await serializer.deserialize({ content: externalSnapshot, header }) as ContentHeadersSnapshot | null
                expect(result).not.toBeNull()
                expect(result!.assets).toHaveLength(1)
                expect(result!.assets[0].assetId).toBe('ASSET#test1')
                expect(result!.assets[0].zone).toBe('Canon')
                expect(result!.assets[0].standardForm).toBeInstanceOf(StandardForm)
            })
        })

        describe('serialize Snapshot', () => {
            it('should serialize snapshot to external format', () => {
                const snapshot = {
                    type: 'Snapshot' as const,
                    assets: [
                        {
                            assetId: 'ASSET#test1' as const,
                            zone: 'Canon' as const,
                            standardForm: new StandardForm('<Asset uuid=(test1)><Room key=(room1)><ShortName>Room 1</ShortName></Room></Asset>')
                        },
                        {
                            assetId: 'ASSET#test2' as const,
                            zone: 'Library' as const,
                            standardForm: new StandardForm('<Asset uuid=(test2)><Room key=(room2)><ShortName>Room 2</ShortName></Room></Asset>')
                        }
                    ]
                }
                const header = { dataSourceKey: 'mtw.assets.contentHeaders', streamKey: 'test', timestamp: 0, type: 'Snapshot' as const }

                const result = serializer.serialize({ content: snapshot, header })

                expect(result).toEqual({
                    assets: [
                        {
                            assetId: 'ASSET#test1',
                            zone: 'Canon',
                            wml: expect.any(String)
                        },
                        {
                            assetId: 'ASSET#test2',
                            zone: 'Library',
                            wml: expect.any(String)
                        }
                    ]
                })
            })
        })

        describe('deserialize Snapshot', () => {
            it('should deserialize snapshot from external format', async () => {
                const externalSnapshot: ContentHeadersSnapshotExternal = {
                    assets: [
                        {
                            assetId: 'ASSET#test1',
                            zone: 'Canon',
                            wml: '<Asset uuid=(test1)><Room key=(room1)><ShortName>Room 1</ShortName></Room></Asset>'
                        },
                        {
                            assetId: 'ASSET#test2',
                            zone: 'Library',
                            wml: '<Asset uuid=(test2)><Room key=(room2)><ShortName>Room 2</ShortName></Room></Asset>'
                        }
                    ]
                }
                const header = { dataSourceKey: 'mtw.assets.contentHeaders', streamKey: 'test', timestamp: 0, type: 'Snapshot' as const }

                const result = await serializer.deserialize({ content: externalSnapshot, header }) as ContentHeadersSnapshot | null

                expect(result).not.toBeNull()
                expect(result?.assets).toHaveLength(2)
                expect(result?.assets[0].assetId).toBe('ASSET#test1')
                expect(result?.assets[0].zone).toBe('Canon')
                expect(result?.assets[0].standardForm).toBeInstanceOf(StandardForm)
                expect(result?.assets[1].assetId).toBe('ASSET#test2')
                expect(result?.assets[1].zone).toBe('Library')
                expect(result?.assets[1].standardForm).toBeInstanceOf(StandardForm)
            })
        })
    })
})

describe('isContentHeadersExternal', () => {
    it('should return true for Snapshot payload without type (consumer compatibility)', () => {
        expect(isContentHeadersExternal({ assets: [] })).toBe(true)
    })

    it('should return true for Headers Updated payload without type', () => {
        expect(isContentHeadersExternal({
            assetId: 'ASSET#test',
            zone: 'Canon',
            wml: '<Asset />'
        })).toBe(true)
    })

    it('should return true for Zone Updated payload without type', () => {
        expect(isContentHeadersExternal({
            assetId: 'ASSET#test',
            fromZone: 'Draft',
            toZone: 'Library'
        })).toBe(true)
    })
})
