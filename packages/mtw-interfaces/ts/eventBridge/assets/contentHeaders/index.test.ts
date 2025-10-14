import { 
    ContentHeadersAggregator,
    ContentHeadersEventSerializer,
    ContentHeadersSnapshotExternal,
    ContentHeadersUpdateExternal
} from './index'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

describe('ContentHeaders EventBridge Contracts', () => {
    describe('ContentHeadersAggregator', () => {
        let aggregator: ContentHeadersAggregator

        beforeEach(() => {
            aggregator = new ContentHeadersAggregator()
        })

        describe('createEmpty', () => {
            it('should create an empty snapshot', () => {
                const snapshot = aggregator.createEmpty()
                
                expect(snapshot).toEqual({
                    type: 'Snapshot Generated',
                    assets: []
                })
            })
        })

        describe('applyUpdate', () => {
            describe('Headers Updated events', () => {
                it('should add a new asset when it does not exist', () => {
                    const emptySnapshot = aggregator.createEmpty()
                    const standardForm = new StandardForm(deIndentWML(`
                        <Asset uuid=(test)>
                            <Room key=(room1)><ShortName>Test Room</ShortName></Room>
                        </Asset>
                    `))
                    
                    const result = aggregator.applyUpdate(emptySnapshot, {
                        type: 'Headers Updated',
                        assetId: 'ASSET#test',
                        zone: 'Canon',
                        standardForm
                    })

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
                        type: 'Snapshot Generated' as const,
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
                    
                    const result = aggregator.applyUpdate(snapshot, {
                        type: 'Headers Updated',
                        assetId: 'ASSET#test',
                        zone: 'Canon',
                        standardForm: updateStandardForm
                    })

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
                        type: 'Snapshot Generated' as const,
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
                    
                    const result = aggregator.applyUpdate(snapshot, {
                        type: 'Headers Updated',
                        assetId: 'ASSET#test',
                        zone: 'Canon',
                        standardForm: updateStandardForm
                    })

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
                        type: 'Snapshot Generated' as const,
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
                    
                    const result = aggregator.applyUpdate(snapshot, {
                        type: 'Headers Updated',
                        assetId: 'ASSET#test',
                        zone: 'Library',
                        standardForm: updateStandardForm
                    })

                    expect(result.success).toBe(true)
                    if (result.success) {
                        expect(result.snapshot.assets[0].zone).toBe('Library')
                    }
                })

                it('should handle multiple different assets', () => {
                    const snapshot = aggregator.createEmpty()
                    
                    // Add first asset
                    const result1 = aggregator.applyUpdate(snapshot, {
                        type: 'Headers Updated',
                        assetId: 'ASSET#test1',
                        zone: 'Canon',
                        standardForm: new StandardForm(deIndentWML(`
                            <Asset uuid=(test1)>
                                <Room key=(room1)><ShortName>Room 1</ShortName></Room>
                            </Asset>
                        `))
                    })

                    expect(result1.success).toBe(true)
                    if (!result1.success) return

                    // Add second asset
                    const result2 = aggregator.applyUpdate(result1.snapshot, {
                        type: 'Headers Updated',
                        assetId: 'ASSET#test2',
                        zone: 'Library',
                        standardForm: new StandardForm(deIndentWML(`
                            <Asset uuid=(test2)>
                                <Room key=(room2)><ShortName>Room 2</ShortName></Room>
                            </Asset>
                        `))
                    })

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
                        type: 'Snapshot Generated' as const,
                        assets: [{
                            assetId: 'ASSET#test' as const,
                            zone: 'Canon' as const,
                            standardForm: initialStandardForm
                        }]
                    }
                    
                    const result = aggregator.applyUpdate(snapshot, {
                        type: 'Zone Updated',
                        assetId: 'ASSET#test',
                        fromZone: 'Canon',
                        toZone: 'Library'
                    })

                    expect(result.success).toBe(true)
                    if (result.success) {
                        expect(result.snapshot.assets).toHaveLength(1)
                        expect(result.snapshot.assets[0].zone).toBe('Library')
                        // StandardForm should remain unchanged
                        expect(result.snapshot.assets[0].standardForm).toBe(initialStandardForm)
                    }
                })

                it('should create placeholder when asset does not exist', () => {
                    const snapshot = aggregator.createEmpty()
                    
                    const result = aggregator.applyUpdate(snapshot, {
                        type: 'Zone Updated',
                        assetId: 'ASSET#nonexistent',
                        fromZone: 'Canon',
                        toZone: 'Library'
                    })

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
                        type: 'Snapshot Generated' as const,
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
                    
                    const result = aggregator.applyUpdate(snapshot, {
                        type: 'Zone Updated',
                        assetId: 'ASSET#test1',
                        fromZone: 'Canon',
                        toZone: 'Personal'
                    })

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

            describe('Snapshot Generated events', () => {
                it('should replace entire snapshot', () => {
                    const oldSnapshot = {
                        type: 'Snapshot Generated' as const,
                        assets: [{
                            assetId: 'ASSET#old' as const,
                            zone: 'Canon' as const,
                            standardForm: new StandardForm('<Asset uuid=(old)></Asset>')
                        }]
                    }

                    const newSnapshot = {
                        type: 'Snapshot Generated' as const,
                        assets: [{
                            assetId: 'ASSET#new' as const,
                            zone: 'Library' as const,
                            standardForm: new StandardForm('<Asset uuid=(new)></Asset>')
                        }]
                    }
                    
                    const result = aggregator.applyUpdate(oldSnapshot, newSnapshot)

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
                        type: 'Snapshot Generated' as const,
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
                    
                    const result = aggregator.applyUpdate(snapshot, {
                        type: 'Headers Updated',
                        assetId: 'ASSET#test',
                        zone: 'Canon',
                        standardForm: updateStandardForm
                    })

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
                        type: 'Snapshot Generated' as const,
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

                    const result = aggregator.applyUpdate(snapshot, {
                        type: 'Headers Updated',
                        assetId: 'ASSET#test',
                        zone: 'Canon',
                        standardForm: new StandardForm('<Asset uuid=(test)><Room key=(room1)></Room></Asset>')
                    })

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
                        type: 'Snapshot Generated' as const,
                        assets: [{
                            assetId: 'ASSET#test' as const,
                            zone: 'Canon' as const,
                            standardForm: new StandardForm('<Asset uuid=(test)></Asset>')
                        }]
                    }
                    const originalAssetsLength = originalSnapshot.assets.length
                    
                    aggregator.applyUpdate(originalSnapshot, {
                        type: 'Headers Updated',
                        assetId: 'ASSET#new',
                        zone: 'Library',
                        standardForm: new StandardForm('<Asset uuid=(new)></Asset>')
                    })

                    expect(originalSnapshot.assets.length).toBe(originalAssetsLength)
                })

                it('should not mutate the original snapshot on Zone Updated', () => {
                    const originalSnapshot = {
                        type: 'Snapshot Generated' as const,
                        assets: [{
                            assetId: 'ASSET#test' as const,
                            zone: 'Canon' as const,
                            standardForm: new StandardForm('<Asset uuid=(test)></Asset>')
                        }]
                    }
                    const originalZone = originalSnapshot.assets[0].zone
                    
                    aggregator.applyUpdate(originalSnapshot, {
                        type: 'Zone Updated',
                        assetId: 'ASSET#test',
                        fromZone: 'Canon',
                        toZone: 'Library'
                    })

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
                    dataSourceKey: 'mtw.assets.contentHeaders',
                    streamKey: 'global',
                    update: {
                        type: 'Headers Updated',
                        assetId: 'ASSET#test',
                        zone: 'Canon',
                        standardForm
                    }
                })

                expect(result).toEqual({
                    type: 'Headers Updated',
                    assetId: 'ASSET#test',
                    zone: 'Canon',
                    wml: expect.any(String)
                })

                // Verify WML is correctly serialized
                const external = result as ContentHeadersUpdateExternal
                expect(external.wml).toContain('<Asset uuid=(test)>')
                expect(external.wml).toContain('<Room key=(room1)>')
            })
        })

        describe('deserialize', () => {
            it('should deserialize Headers Updated event from external format', () => {
                const externalUpdate: ContentHeadersUpdateExternal = {
                    type: 'Headers Updated',
                    assetId: 'ASSET#test',
                    zone: 'Canon',
                    wml: '<Asset uuid=(test)><Room key=(room1)><ShortName>Test Room</ShortName></Room></Asset>'
                }

                const result = serializer.deserialize({
                    dataSourceKey: 'mtw.assets.contentHeaders',
                    streamKey: 'global',
                    externalUpdate
                })

                expect(result).not.toBeNull()
                if (!result) return
                
                expect(result.type).toBe('Headers Updated')
                if (result.type === 'Headers Updated') {
                    expect(result.assetId).toBe('ASSET#test')
                    expect(result.zone).toBe('Canon')
                    expect(result.standardForm).toBeInstanceOf(StandardForm)
                }
            })
        })

        describe('serializeSnapshot', () => {
            it('should serialize snapshot to external format', () => {
                const snapshot = {
                    type: 'Snapshot Generated' as const,
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

                const result = serializer.serializeSnapshot(snapshot)

                expect(result).toEqual({
                    type: 'Snapshot Generated',
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

        describe('deserializeSnapshot', () => {
            it('should deserialize snapshot from external format', () => {
                const externalSnapshot: ContentHeadersSnapshotExternal = {
                    type: 'Snapshot Generated',
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

                const result = serializer.deserializeSnapshot(externalSnapshot)

                expect(result).not.toBeNull()
                expect(result?.type).toBe('Snapshot Generated')
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
