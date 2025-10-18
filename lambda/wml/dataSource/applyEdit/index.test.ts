import { applyEdit } from './index'
import AssetWorkspace from '../../AssetWorkspace'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

// Mock local AssetWorkspace
jest.mock('../../AssetWorkspace')

const MockAssetWorkspace = AssetWorkspace as jest.MockedClass<typeof AssetWorkspace>

describe("applyEdit", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe("createIfNeeded flag", () => {
        const testAssetId = 'ASSET#test'
        const testSchema = '<Asset uuid=(test)><Room uuid=(testRoom) /></Asset>'

        describe("when asset doesn't exist", () => {
            beforeEach(() => {
                // Mock fromUUID to return undefined (asset not found)
                MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(undefined)
            })

            it('should fail when createIfNeeded is false (default)', async () => {
                const result = await applyEdit({
                    AssetId: testAssetId,
                    RequestId: 'test-request',
                    schema: testSchema
                })

                expect(result.success).toBe(false)
                if (!result.success) {
                    expect(result.error).toBe('Asset not found')
                }
            })

            it('should fail when createIfNeeded is true but zone is not specified', async () => {
                const result = await applyEdit({
                    AssetId: testAssetId,
                    RequestId: 'test-request',
                    schema: testSchema,
                    createIfNeeded: true
                })

                expect(result.success).toBe(false)
                if (!result.success) {
                    expect(result.error).toContain('zone not specified')
                }
            })

            it('should create new asset when createIfNeeded is true and zone is specified', async () => {
                // Mock the new workspace created by constructor
                const mockWorkspace = {
                    loadJSON: jest.fn().mockResolvedValue(undefined),
                    standard: undefined,
                    setJSON: jest.fn(),
                    pushJSON: jest.fn().mockResolvedValue(undefined),
                    pushWML: jest.fn().mockResolvedValue(undefined)
                }
                
                MockAssetWorkspace.mockImplementation(() => mockWorkspace as any)

                const result = await applyEdit({
                    AssetId: testAssetId,
                    RequestId: 'test-request',
                    schema: testSchema,
                    createIfNeeded: true,
                    zone: 'Canon'
                })

                expect(MockAssetWorkspace).toHaveBeenCalledWith(testAssetId, 'Canon')
                expect(result.success).toBe(true)
                expect(mockWorkspace.pushJSON).toHaveBeenCalled()
                expect(mockWorkspace.pushWML).toHaveBeenCalled()
            })
        })

        describe("when asset exists but is empty", () => {
            it('should fail when createIfNeeded is false', async () => {
                const mockWorkspace = {
                    loadJSON: jest.fn().mockResolvedValue(undefined),
                    standard: undefined,
                    setJSON: jest.fn(),
                    pushJSON: jest.fn().mockResolvedValue(undefined),
                    pushWML: jest.fn().mockResolvedValue(undefined)
                }

                MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(mockWorkspace)

                const result = await applyEdit({
                    AssetId: testAssetId,
                    RequestId: 'test-request',
                    schema: testSchema
                })

                expect(result.success).toBe(false)
                if (!result.success) {
                    expect(result.error).toBe('Asset content not found')
                }
            })

            it('should initialize empty asset when createIfNeeded is true', async () => {
                const emptyStandard = new StandardForm('test') // Use key, not AssetUUID
                emptyStandard._components = [] // Explicitly empty
                
                const mockWorkspace = {
                    loadJSON: jest.fn().mockResolvedValue(undefined),
                    standard: emptyStandard,
                    setJSON: jest.fn(),
                    pushJSON: jest.fn().mockResolvedValue(undefined),
                    pushWML: jest.fn().mockResolvedValue(undefined)
                }

                MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(mockWorkspace)

                const result = await applyEdit({
                    AssetId: testAssetId,
                    RequestId: 'test-request',
                    schema: testSchema,
                    createIfNeeded: true,
                    zone: 'Canon'
                })

                expect(result.success).toBe(true)
                expect(mockWorkspace.setJSON).toHaveBeenCalled()
                expect(mockWorkspace.pushJSON).toHaveBeenCalled()
            })
        })

        describe("when asset exists with content", () => {
            it('should merge normally regardless of createIfNeeded flag', async () => {
                const existingWML = '<Asset uuid=(test)><Feature uuid=(existingFeature) /></Asset>'
                const existingStandard = new StandardForm(existingWML)
                
                const mockWorkspace = {
                    loadJSON: jest.fn().mockResolvedValue(undefined),
                    standard: existingStandard,
                    setJSON: jest.fn(),
                    pushJSON: jest.fn().mockResolvedValue(undefined),
                    pushWML: jest.fn().mockResolvedValue(undefined)
                }

                MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(mockWorkspace)

                const result = await applyEdit({
                    AssetId: testAssetId,
                    RequestId: 'test-request',
                    schema: testSchema,
                    createIfNeeded: true,
                    zone: 'Canon'
                })

                expect(result.success).toBe(true)
                // Should merge, not replace
                const mergedSchema = (mockWorkspace.setJSON as jest.Mock).mock.calls[0][0]
                expect(mergedSchema.byUniversalId['ROOM#testRoom']).toBeDefined()
                expect(mergedSchema.byUniversalId['FEATURE#existingFeature']).toBeDefined()
            })
        })
    })

    describe("backward compatibility", () => {
        it('should behave as before when createIfNeeded is not specified', async () => {
            const testAssetId = 'ASSET#test'
            const testSchema = '<Asset uuid=(test)><Room uuid=(testRoom) /></Asset>'

            // Asset not found
            MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(undefined)

            const result = await applyEdit({
                AssetId: testAssetId,
                RequestId: 'test-request',
                schema: testSchema
            })

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toBe('Asset not found')
            }
            
            // Should NOT try to create the asset
            expect(MockAssetWorkspace).not.toHaveBeenCalled()
        })
    })
})

