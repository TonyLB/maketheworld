import { cacheAsset } from './cacheAsset'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import internalCache from '../../internalCache'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { emitTopologyInvalidatedForRoomTargets } from '../../componentTopology'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    assetDB: {
        deleteItem: jest.fn(),
        putItem: jest.fn(),
        optimisticUpdate: jest.fn(),
        getItem: jest.fn()
    }
}))

jest.mock('../../componentTopology', () => ({
    emitTopologyInvalidatedForRoomTargets: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../internalCache', () => ({
    ...jest.requireActual('../../internalCache'),
    AssetData: {
        get: jest.fn(),
        invalidate: jest.fn()
    },
    AssetMetaData: {
        get: jest.fn().mockResolvedValue([{ zone: 'Draft', player: 'Test' }]),
        invalidate: jest.fn()
    },
    ComponentData: {
        get: jest.fn().mockResolvedValue([]),
        invalidate: jest.fn()
    }
}))

const internalCacheMock = jest.mocked(internalCache, { shallow: false })

let standardFormMock = new StandardForm('<Asset uuid=(Test) />')
const mockLoadJSON = jest.fn()

jest.mock('@tonylb/mtw-asset-workspace/ts/readOnly', () => {
    const mockAssetWorkspaceClass = jest.fn().mockImplementation((address: any) => ({
        status: {
            json: 'Clean'
        },
        address,
        loadJSON: mockLoadJSON,
        get standard() { return standardFormMock }
    }));
    
    // Add static fromUUID method to the mock class
    (mockAssetWorkspaceClass as any).fromUUID = jest.fn().mockImplementation(async (assetId: string) => ({
        status: {
            json: 'Clean'
        },
        address: { zone: 'Canon', fileName: assetId.replace('ASSET#', '').replace('CHARACTER#', ''), subFolder: 'Assets' },
        assetId,
        loadJSON: mockLoadJSON,
        get standard() { return standardFormMock }
    }))
    
    return {
        __esModule: true,
        default: mockAssetWorkspaceClass,
        ReadOnlyAssetWorkspace: mockAssetWorkspaceClass
    }
})

// Mock streamEvent function
const mockStreamEvent = jest.fn()
const assetDBMock = jest.mocked(assetDB, { shallow: false })

describe('Cache Asset (Data Source)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        standardFormMock = new StandardForm('<Asset uuid=(Test) />')
        mockStreamEvent.mockResolvedValue(undefined)
        // Mock getItem to return empty result by default (simulating no prior Meta::Asset record)
        assetDBMock.getItem.mockResolvedValue({})
    })

    describe('Asset ID handling', () => {
        it('should handle asset key format (primitives)', async () => {
            // Mock empty dbAsset (no existing data)
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                standardForm: new StandardForm('<Asset uuid=(primitives) />')
            }])

            // Mock AssetMetaData.get to return zone
            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                zone: 'Canon'
            }])

            // Mock fileAsset with content
            standardFormMock = new StandardForm(`
                <Asset uuid=(primitives)>
                    <Room uuid=(VORTEX) />
                    <Knowledge uuid=(knowledgeRoot) />
                </Asset>
            `)

            await cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })

            // Phase 1B: Should call putItem for Meta::Asset + each new component (1 + 2 = 3)
            expect(assetDBMock.putItem).toHaveBeenCalledTimes(3)
            const putItemCalls = assetDBMock.putItem.mock.calls
            const componentIds = putItemCalls.map(call => call[0].AssetId)
            expect(componentIds).toContain('ASSET#primitives')  // Meta::Asset
            expect(componentIds).toContain('ROOM#VORTEX')
            expect(componentIds).toContain('KNOWLEDGE#knowledgeRoot')

            // Should call optimisticUpdate for each component
            expect(assetDBMock.optimisticUpdate).toHaveBeenCalledTimes(2)
        })

        it('should handle asset UUID format (ASSET#primitives)', async () => {
            // Mock empty dbAsset (no existing data)
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                standardForm: new StandardForm('<Asset uuid=(primitives) />')
            }])

            // Mock AssetMetaData.get to return zone
            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                zone: 'Canon'
            }])

            // Mock fileAsset with content
            standardFormMock = new StandardForm(`
                <Asset uuid=(primitives)>
                    <Room uuid=(VORTEX) />
                    <Knowledge uuid=(knowledgeRoot) />
                </Asset>
            `)

            await cacheAsset({ assetId: 'ASSET#primitives', streamEvent: mockStreamEvent })

            // Phase 1B: Should call putItem for Meta::Asset + each new component (1 + 2 = 3)
            expect(assetDBMock.putItem).toHaveBeenCalledTimes(3)
            const putItemCalls = assetDBMock.putItem.mock.calls
            const componentIds = putItemCalls.map(call => call[0].AssetId)
            expect(componentIds).toContain('ASSET#primitives')  // Meta::Asset
            expect(componentIds).toContain('ROOM#VORTEX')
            expect(componentIds).toContain('KNOWLEDGE#knowledgeRoot')

            // Should call optimisticUpdate for each component
            expect(assetDBMock.optimisticUpdate).toHaveBeenCalledTimes(2)
        })
    })

    describe('Address handling', () => {
        it('should throw error when zone is missing', async () => {
            // Mock empty dbAsset
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                standardForm: new StandardForm('<Asset uuid=(primitives) />')
            }])

            // Mock AssetMetaData.get to return no zone
            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                zone: undefined
            }])

            await expect(cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })).rejects.toThrow('cacheAsset: Missing zone')

            // Should not call putItem or optimisticUpdate
            expect(assetDBMock.putItem).not.toHaveBeenCalled()
            expect(assetDBMock.optimisticUpdate).not.toHaveBeenCalled()
        })

        it('should cache when address is present', async () => {
            // Mock empty dbAsset
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                standardForm: new StandardForm('<Asset uuid=(primitives) />')
            }])

            // Mock AssetMetaData.get to return zone
            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                zone: 'Canon'
            }])

            // Mock fileAsset with content
            standardFormMock = new StandardForm(`
                <Asset uuid=(primitives)>
                    <Room uuid=(VORTEX) />
                </Asset>
            `)

            await cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })

            // Phase 1B: Should call putItem for Meta::Asset + the new component (1 + 1 = 2)
            expect(assetDBMock.putItem).toHaveBeenCalledTimes(2)
            expect(assetDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)
        })
    })

    describe('Component removal', () => {
        it('should delete removed components', async () => {
            // Mock dbAsset with existing component
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                standardForm: new StandardForm(`
                    <Asset uuid=(primitives)>
                        <Room uuid=(VORTEX) />
                        <Knowledge uuid=(knowledgeRoot) />
                    </Asset>
                `)
            }])

            // Mock AssetMetaData.get to return zone
            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                zone: 'Canon'
            }])

            // Mock fileAsset with only one component (removed one)
            standardFormMock = new StandardForm(`
                <Asset uuid=(primitives)>
                    <Room uuid=(VORTEX) />
                </Asset>
            `)

            await cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })

            // Should call deleteItem for the removed component
            expect(assetDBMock.deleteItem).toHaveBeenCalledWith({
                AssetId: 'KNOWLEDGE#knowledgeRoot',
                DataCategory: 'ASSET#primitives'
            })

            // Should emit Component Updated streaming event
            expect(mockStreamEvent).toHaveBeenCalled()
            const removalCall = mockStreamEvent.mock.calls.find(([arg]) => arg.header?.type === 'Component Updated' && arg.streamKey === 'primitives')?.[0]
            expect(removalCall).toBeTruthy()
            expect(removalCall.header.type).toBe('Component Updated')
            expect(removalCall.update.component?.tag).toBe('Knowledge')
            expect(removalCall.update.component?.universalKey).toBe('KNOWLEDGE#knowledgeRoot')
        })
    })

    describe('Diff behavior', () => {
        it('should detect no changes when dbAsset and fileAsset are identical', async () => {
            const identicalForm = new StandardForm(`
                <Asset uuid=(primitives)>
                    <Room uuid=(VORTEX) />
                </Asset>
            `)

            // Mock dbAsset and fileAsset with identical content
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                standardForm: identicalForm
            }])

            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                zone: 'Canon'
            }])

            standardFormMock = identicalForm

            await cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })

            // Phase 1B: Should write Meta::Asset even with no component changes
            expect(assetDBMock.putItem).toHaveBeenCalledTimes(1)
            expect(assetDBMock.putItem).toHaveBeenCalledWith({
                AssetId: 'ASSET#primitives',
                DataCategory: 'Meta::Asset',
                zone: 'Canon'
            })
            
            // Should not call component-related operations
            expect(assetDBMock.deleteItem).not.toHaveBeenCalled()
            expect(assetDBMock.optimisticUpdate).not.toHaveBeenCalled()
        })

        it('should detect new components when dbAsset is empty and fileAsset has content', async () => {
            // Mock empty dbAsset
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                standardForm: new StandardForm('<Asset uuid=(primitives) />')
            }])

            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                zone: 'Canon'
            }])

            // Mock fileAsset with content
            standardFormMock = new StandardForm(`
                <Asset uuid=(primitives)>
                    <Room uuid=(VORTEX) />
                    <Knowledge uuid=(knowledgeRoot) />
                </Asset>
            `)

            await cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })

            // Phase 1B: Should call putItem for Meta::Asset + each new component (1 + 2 = 3)
            expect(assetDBMock.putItem).toHaveBeenCalledTimes(3)
            expect(assetDBMock.optimisticUpdate).toHaveBeenCalledTimes(2)

            // Should emit Component Updated events with StandardComponent objects
            expect(mockStreamEvent).toHaveBeenCalledTimes(2)
            
            // Extract the actual components from the mock calls
            const firstCall = mockStreamEvent.mock.calls[0][0]
            const secondCall = mockStreamEvent.mock.calls[1][0]
            
            // Validate first component (Knowledge)
            expect(firstCall.header.type).toBe('Component Updated')
            expect(firstCall.streamKey).toBe('primitives')
            
            // Validate that the component serializes to the expected WML
            const firstComponentWML = schemaToWML([firstCall.update.component.schema])
            expect(firstComponentWML).toEqual(deIndentWML(`
                <Knowledge uuid=(knowledgeRoot) />
            `))
            
            // Validate second component (Room)
            expect(secondCall.header.type).toBe('Component Updated')
            expect(secondCall.streamKey).toBe('primitives')
            
            // Validate that the component serializes to the expected WML
            const secondComponentWML = schemaToWML([secondCall.update.component.schema])
            expect(secondComponentWML).toEqual(deIndentWML(`
                <Room uuid=(VORTEX) />
            `))
        })
    })

    describe('Component updated streaming', () => {
        it('should publish Component Updated event with delta WML for changed component', async () => {
            // db has a Room with one ShortName, file adds/changes description
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                standardForm: new StandardForm(`
                    <Asset uuid=(primitives)>
                        <Room uuid=(VORTEX) />
                    </Asset>
                `)
            }])

            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                zone: 'Canon'
            }])

            // file adds a ShortName to the existing Room
            standardFormMock = new StandardForm(`
                <Asset uuid=(primitives)>
                    <Room uuid=(VORTEX)><ShortName>Vortex</ShortName></Room>
                </Asset>
            `)

            await cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })

            // Extract the actual component from the mock call
            const call = mockStreamEvent.mock.calls[0][0]
            
            // Validate component structure
            expect(call.header.type).toBe('Component Updated')
            expect(call.streamKey).toBe('primitives')
            
            // Validate that the component serializes to the expected WML
            const componentWML = schemaToWML([call.update.component.schema])
            expect(componentWML).toEqual(deIndentWML(`
                <Room uuid=(VORTEX)><ShortName>Vortex</ShortName></Room>
            `))
        })
    })

    describe('Asset-level metadata storage', () => {
        it('should store Asset-level ShortName in Meta::Asset record', async () => {
            // Mock empty dbAsset
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#nakatomiPlaza',
                standardForm: new StandardForm('<Asset uuid=(nakatomiPlaza) />')
            }])

            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#nakatomiPlaza',
                zone: 'Personal',
                player: 'testPlayer'
            }])

            // Mock fileAsset with Asset-level ShortName
            standardFormMock = new StandardForm(deIndentWML(`
                <Asset uuid=(nakatomiPlaza)>
                    <ShortName>Nakatomi Plaza</ShortName>
                    <Room uuid=(lobby) key=(lobby)>
                        <ShortName>Main Lobby</ShortName>
                    </Room>
                </Asset>
            `))

            await cacheAsset({ assetId: 'nakatomiPlaza', streamEvent: mockStreamEvent })

            // Verify Meta::Asset record includes shortName
            const metaAssetCall = assetDBMock.putItem.mock.calls.find(
                call => call[0].DataCategory === 'Meta::Asset'
            )
            expect(metaAssetCall).toBeDefined()
            expect(metaAssetCall![0]).toEqual({
                AssetId: 'ASSET#nakatomiPlaza',
                DataCategory: 'Meta::Asset',
                zone: 'Personal',
                player: 'testPlayer',
                shortName: 'Nakatomi Plaza'
            })
        })

        it('should store Asset-level Summary in Meta::Asset record', async () => {
            // Mock empty dbAsset
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#testAsset',
                standardForm: new StandardForm('<Asset uuid=(testAsset) />')
            }])

            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#testAsset',
                zone: 'Canon'
            }])

            // Mock fileAsset with Asset-level Summary
            standardFormMock = new StandardForm(deIndentWML(`
                <Asset uuid=(testAsset)>
                    <Summary>A test summary for the asset</Summary>
                    <Room uuid=(room1) key=(room1) />
                </Asset>
            `))

            await cacheAsset({ assetId: 'testAsset', streamEvent: mockStreamEvent })

            // Verify Meta::Asset record includes summary
            const metaAssetCall = assetDBMock.putItem.mock.calls.find(
                call => call[0].DataCategory === 'Meta::Asset'
            )
            expect(metaAssetCall).toBeDefined()
            expect(metaAssetCall![0]).toEqual({
                AssetId: 'ASSET#testAsset',
                DataCategory: 'Meta::Asset',
                zone: 'Canon',
                summary: ['A test summary for the asset']
            })
        })

        it('should store both Asset-level ShortName and Summary in Meta::Asset record', async () => {
            // Mock empty dbAsset
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#fullMetadata',
                standardForm: new StandardForm('<Asset uuid=(fullMetadata) />')
            }])

            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#fullMetadata',
                zone: 'Library'
            }])

            // Mock fileAsset with both Asset-level metadata fields
            standardFormMock = new StandardForm(deIndentWML(`
                <Asset uuid=(fullMetadata)>
                    <ShortName>Complete Asset</ShortName>
                    <Summary>An asset with all metadata fields populated</Summary>
                    <Room uuid=(room1) key=(room1) />
                </Asset>
            `))

            await cacheAsset({ assetId: 'fullMetadata', streamEvent: mockStreamEvent })

            // Verify Meta::Asset record includes both fields
            const metaAssetCall = assetDBMock.putItem.mock.calls.find(
                call => call[0].DataCategory === 'Meta::Asset'
            )
            expect(metaAssetCall).toBeDefined()
            expect(metaAssetCall![0]).toEqual({
                AssetId: 'ASSET#fullMetadata',
                DataCategory: 'Meta::Asset',
                zone: 'Library',
                shortName: 'Complete Asset',
                summary: ['An asset with all metadata fields populated']
            })
        })

        it('should not include shortName or summary when Asset has no metadata', async () => {
            // Mock empty dbAsset
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#noMetadata',
                standardForm: new StandardForm('<Asset uuid=(noMetadata) />')
            }])

            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#noMetadata',
                zone: 'Canon'
            }])

            // Mock fileAsset without Asset-level metadata
            standardFormMock = new StandardForm(deIndentWML(`
                <Asset uuid=(noMetadata)>
                    <Room uuid=(room1) key=(room1) />
                </Asset>
            `))

            await cacheAsset({ assetId: 'noMetadata', streamEvent: mockStreamEvent })

            // Verify Meta::Asset record does NOT include shortName or summary (omission-over-empty)
            const metaAssetCall = assetDBMock.putItem.mock.calls.find(
                call => call[0].DataCategory === 'Meta::Asset'
            )
            expect(metaAssetCall).toBeDefined()
            expect(metaAssetCall![0]).toEqual({
                AssetId: 'ASSET#noMetadata',
                DataCategory: 'Meta::Asset',
                zone: 'Canon'
            })
            // Explicitly verify shortName and summary are NOT present
            expect(metaAssetCall![0]).not.toHaveProperty('shortName')
            expect(metaAssetCall![0]).not.toHaveProperty('summary')
        })

        it('should store Asset-level Summary with complex content in Meta::Asset record', async () => {
            // Mock empty dbAsset
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#complexSummary',
                standardForm: new StandardForm('<Asset uuid=(complexSummary) />')
            }])

            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#complexSummary',
                zone: 'Personal',
                player: 'testPlayer'
            }])

            // Mock fileAsset with complex Summary containing links
            standardFormMock = new StandardForm(deIndentWML(`
                <Asset uuid=(complexSummary)>
                    <Summary>
                        A mysterious <Link to=(portal)>portal</Link> appears
                    </Summary>
                    <Room uuid=(room1) key=(room1) />
                </Asset>
            `))

            await cacheAsset({ assetId: 'complexSummary', streamEvent: mockStreamEvent })

            // Verify Meta::Asset record includes complex summary as RenderTree
            const metaAssetCall = assetDBMock.putItem.mock.calls.find(
                call => call[0].DataCategory === 'Meta::Asset'
            )
            expect(metaAssetCall).toBeDefined()
            expect(metaAssetCall![0].summary).toEqual([
                'A mysterious ',
                { data: { tag: 'Link', to: 'portal', text: 'portal' }, children: ['portal'] },
                ' appears'
            ])
        })
    })

    describe('Asset Updated event emission', () => {
        it('emits Asset Updated when ShortName is added', async () => {
            // db without metadata
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#test',
                standardForm: new StandardForm('<Asset uuid=(test) />')
            }])
            internalCacheMock.AssetMetaData.get.mockResolvedValue([{ AssetId: 'ASSET#test', zone: 'Canon' }])
            // file with ShortName
            standardFormMock = new StandardForm(`
                <Asset uuid=(test)>
                    <ShortName>New Name</ShortName>
                </Asset>
            `)

            await cacheAsset({ assetId: 'test', streamEvent: mockStreamEvent })

            const assetUpdatedCall = mockStreamEvent.mock.calls.find(([arg]) => arg.header?.type === 'Asset Updated')?.[0]
            expect(assetUpdatedCall).toBeTruthy()
            expect(assetUpdatedCall.header.type).toBe('Asset Updated')
            // Validate WML from provided StandardForm
            const wml = schemaToWML([assetUpdatedCall.update.standardForm.schema])
            expect(wml).toEqual(deIndentWML(`
                <Asset uuid=(test)><ShortName>New Name</ShortName></Asset>
            `))
        })

        it('emits Asset Updated when Summary is changed', async () => {
            // db with old summary
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#test2',
                standardForm: new StandardForm(`
                    <Asset uuid=(test2)>
                        <Summary>Old</Summary>
                    </Asset>
                `)
            }])
            internalCacheMock.AssetMetaData.get.mockResolvedValue([{ AssetId: 'ASSET#test2', zone: 'Canon' }])
            // file with new summary
            standardFormMock = new StandardForm(`
                <Asset uuid=(test2)>
                    <Summary>New</Summary>
                </Asset>
            `)

            await cacheAsset({ assetId: 'test2', streamEvent: mockStreamEvent })

            const assetUpdatedCall = mockStreamEvent.mock.calls.find(([arg]) => arg.header?.type === 'Asset Updated')?.[0]
            expect(assetUpdatedCall).toBeTruthy()
            const wml = schemaToWML([assetUpdatedCall.update.standardForm.schema])
            expect(wml).toEqual(deIndentWML(`
                <Asset uuid=(test2)>
                    <Replace><Summary>Old</Summary></Replace><With><Summary>New</Summary></With>
                </Asset>
            `))
        })
    })

    describe('referencedBy first pass (three-way branch)', () => {
        it('includes referencedBy on full body puts (branch A)', async () => {
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                standardForm: new StandardForm('<Asset uuid=(primitives) />')
            }])
            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                zone: 'Canon'
            }])
            standardFormMock = new StandardForm(`
                <Asset uuid=(primitives)>
                    <Room uuid=(VORTEX) />
                </Asset>
            `)

            await cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })

            const roomPut = assetDBMock.putItem.mock.calls.find(
                (call) => call[0].AssetId === 'ROOM#VORTEX'
            )?.[0]
            expect(roomPut).toBeDefined()
            expect(roomPut).toHaveProperty('referencedBy')
            expect(Array.isArray(roomPut!.referencedBy)).toBe(true)
        })

        it('stub puts edge-only room targets without deleteItem (branch B)', async () => {
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#test',
                standardForm: new StandardForm('<Asset uuid=(test) />')
            }])
            internalCacheMock.AssetMetaData.get.mockResolvedValue([{ AssetId: 'ASSET#test', zone: 'Canon' }])
            standardFormMock = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Area uuid=(region) key=(region)>
                        <Room uuid=(highway) key=(highway) />
                        <Exit uuid=(e1)>
                            <From>ROOM#highway</From>
                            <To>ROOM#outsideRoom</To>
                            <Forward>east</Forward>
                            <Back>west</Back>
                        </Exit>
                    </Area>
                </Asset>
            `))
            assetDBMock.getItem.mockResolvedValue({})

            await cacheAsset({ assetId: 'test', streamEvent: mockStreamEvent })

            const outsideStubPut = assetDBMock.putItem.mock.calls.find(
                (call) => call[0].AssetId === 'ROOM#outsideRoom'
            )?.[0]
            expect(outsideStubPut).toBeDefined()
            expect(outsideStubPut?.tag).toBe('Room')
            expect(outsideStubPut?.universalKey).toBe('ROOM#outsideRoom')
            expect(outsideStubPut?.referencedBy).toEqual(
                expect.arrayContaining([
                    { referrerUniversalKey: 'AREA#region', referenceType: 'Edge' },
                ])
            )
            expect(assetDBMock.deleteItem).not.toHaveBeenCalledWith(
                expect.objectContaining({ AssetId: 'ROOM#outsideRoom' })
            )
            expect(assetDBMock.optimisticUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    Key: {
                        AssetId: 'ROOM#outsideRoom',
                        DataCategory: 'Meta::Room',
                    },
                })
            )
            expect(emitTopologyInvalidatedForRoomTargets).toHaveBeenCalledWith(
                expect.objectContaining({
                    roomIds: expect.arrayContaining(['ROOM#outsideRoom']),
                    editAssetId: 'ASSET#test',
                })
            )
        })

        it('deleteItem for true component removal (branch C)', async () => {
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                standardForm: new StandardForm(`
                    <Asset uuid=(primitives)>
                        <Room uuid=(VORTEX) />
                        <Knowledge uuid=(knowledgeRoot) />
                    </Asset>
                `)
            }])
            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                zone: 'Canon'
            }])
            standardFormMock = new StandardForm(`
                <Asset uuid=(primitives)>
                    <Room uuid=(VORTEX) />
                </Asset>
            `)

            await cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })

            expect(assetDBMock.deleteItem).toHaveBeenCalledWith({
                AssetId: 'KNOWLEDGE#knowledgeRoot',
                DataCategory: 'ASSET#primitives'
            })
            const knowledgePut = assetDBMock.putItem.mock.calls.find(
                (call) => call[0].AssetId === 'KNOWLEDGE#knowledgeRoot'
            )
            expect(knowledgePut).toBeUndefined()
        })

        it('deleteItem for edge-only room when edge is removed (branch C)', async () => {
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#test',
                standardForm: new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Area uuid=(region) key=(region)>
                            <Room uuid=(highway) key=(highway) />
                            <Exit uuid=(e1)>
                                <From>ROOM#highway</From>
                                <To>ROOM#outsideRoom</To>
                                <Forward>east</Forward>
                                <Back>west</Back>
                            </Exit>
                        </Area>
                    </Asset>
                `))
            }])
            internalCacheMock.AssetMetaData.get.mockResolvedValue([{ AssetId: 'ASSET#test', zone: 'Canon' }])
            standardFormMock = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Area uuid=(region) key=(region)>
                        <Room uuid=(highway) key=(highway) />
                    </Area>
                </Asset>
            `))
            assetDBMock.getItem.mockResolvedValue({})

            await cacheAsset({ assetId: 'test', streamEvent: mockStreamEvent })

            expect(assetDBMock.deleteItem).toHaveBeenCalledWith({
                AssetId: 'ROOM#outsideRoom',
                DataCategory: 'ASSET#test'
            })
        })
    })

    describe('referencedBy on diff._components', () => {
        it('patches referencedBy on room targets when Area edge changes without room body diff', async () => {
            const dbForm = new StandardForm('<Asset uuid=(test) />')
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#test',
                standardForm: dbForm,
            }])
            internalCacheMock.AssetMetaData.get.mockResolvedValue([{ AssetId: 'ASSET#test', zone: 'Canon' }])
            standardFormMock = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Area uuid=(region) key=(region)>
                        <Room uuid=(highway) key=(highway) />
                        <Exit uuid=(e1)>
                            <From>ROOM#highway</From>
                            <To>ROOM#outsideRoom</To>
                            <Forward>east</Forward>
                            <Back>west</Back>
                        </Exit>
                    </Area>
                    <Room uuid=(outsideRoom) key=(outsideRoom) />
                </Asset>
            `))
            assetDBMock.getItem.mockResolvedValue({})

            await cacheAsset({ assetId: 'test', streamEvent: mockStreamEvent })

            const roomPutsWithReferencedBy = assetDBMock.putItem.mock.calls.filter(
                (call) =>
                    call[0].AssetId?.startsWith('ROOM#') &&
                    call[0].referencedBy?.some(
                        (entry: { referrerUniversalKey: string }) =>
                            entry.referrerUniversalKey === 'AREA#region'
                    )
            )
            expect(roomPutsWithReferencedBy.length).toBeGreaterThanOrEqual(1)
            expect(roomPutsWithReferencedBy[0][0].referencedBy).toEqual(
                expect.arrayContaining([
                    { referrerUniversalKey: 'AREA#region', referenceType: 'Edge' },
                ])
            )
            expect(emitTopologyInvalidatedForRoomTargets).toHaveBeenCalledWith(
                expect.objectContaining({
                    roomIds: expect.arrayContaining(['ROOM#outsideRoom']),
                    editAssetId: 'ASSET#test',
                })
            )
        })
    })
})
