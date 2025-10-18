import { applyEdit } from './index'
import AssetWorkspace from '../../AssetWorkspace'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

// Mock local AssetWorkspace
jest.mock('../../AssetWorkspace')

const MockAssetWorkspace = AssetWorkspace as jest.MockedClass<typeof AssetWorkspace>

describe("applyEdit", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe("input validation", () => {
        it('should reject invalid AssetId format', async () => {
            const result = await applyEdit({
                AssetId: 'INVALID#test' as any,
                RequestId: 'test-request',
                schema: '<Asset uuid=(test) />'
            })

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toBe('Invalid AssetId format')
            }
        })

        it('should accept ASSET# prefix', async () => {
            MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(undefined)

            const result = await applyEdit({
                AssetId: 'ASSET#test',
                RequestId: 'test-request',
                schema: '<Asset uuid=(test) />'
            })

            expect(result.success).toBe(false) // Fails because asset doesn't exist, but validation passed
            if (!result.success) {
                expect(result.error).toBe('Asset not found')
            }
        })

        it('should reject CHARACTER# prefix (only ASSET# is valid)', async () => {
            const result = await applyEdit({
                AssetId: 'CHARACTER#test',
                RequestId: 'test-request',
                schema: '<Asset uuid=(test) />'
            })

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toBe('Invalid AssetId format')
            }
        })
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

    describe("basic merging operations", () => {
        const testAssetId = 'ASSET#test'

        it('should add new room to existing asset', async () => {
            const existingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(lobby)>
                        <Example uuid=(lobbyExample)>
                            <Name>Lobby</Name>
                            <Description>A grand lobby</Description>
                        </Example>
                    </Room>
                </Asset>
            `)
            const existingStandard = new StandardForm(existingWML)
            
            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                standard: existingStandard,
                setJSON: jest.fn(),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined)
            }

            MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(mockWorkspace)

            const editSchema = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(kitchen)>
                        <Example uuid=(kitchenExample)>
                            <Name>Kitchen</Name>
                        </Example>
                    </Room>
                </Asset>
            `)

            const result = await applyEdit({
                AssetId: testAssetId,
                RequestId: 'test-request',
                schema: editSchema
            })

            expect(result.success).toBe(true)
            if (result.success) {
                const mergedWML = schemaToWML([result.schema.schema])
                expect(mergedWML).toEqual(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(lobby)>
                            <Example uuid=(lobbyExample)>
                                <Name>Lobby</Name>
                                <Description>A grand lobby</Description>
                            </Example>
                        </Room>
                        <Room uuid=(kitchen)>
                            <Example uuid=(kitchenExample)><Name>Kitchen</Name></Example>
                        </Room>
                    </Asset>
                `))
            }
        })

        it('should merge content into existing room', async () => {
            const existingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(lobby)>
                        <Example uuid=(lobbyExample)>
                            <Name>Lobby</Name>
                        </Example>
                    </Room>
                </Asset>
            `)
            const existingStandard = new StandardForm(existingWML)
            
            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                standard: existingStandard,
                setJSON: jest.fn(),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined)
            }

            MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(mockWorkspace)

            const editSchema = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(lobby)>
                        <Exit to=(kitchen)>north</Exit>
                    </Room>
                </Asset>
            `)

            const result = await applyEdit({
                AssetId: testAssetId,
                RequestId: 'test-request',
                schema: editSchema
            })

            expect(result.success).toBe(true)
            if (result.success) {
                const mergedWML = schemaToWML([result.schema.schema])
                expect(mergedWML).toEqual(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(lobby)>
                            <Example uuid=(lobbyExample)><Name>Lobby</Name></Example>
                            <Exit to=(kitchen)>north</Exit>
                        </Room>
                    </Asset>
                `))
            }
        })

        it('should add feature to existing room', async () => {
            const existingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(lobby)>
                        <Example uuid=(lobbyExample)>
                            <Name>Lobby</Name>
                        </Example>
                    </Room>
                </Asset>
            `)
            const existingStandard = new StandardForm(existingWML)
            
            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                standard: existingStandard,
                setJSON: jest.fn(),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined)
            }

            MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(mockWorkspace)

            const editSchema = deIndentWML(`
                <Asset uuid=(test)>
                    <Feature uuid=(desk)>
                        <Example uuid=(deskExample)>
                            <Name>Reception Desk</Name>
                        </Example>
                    </Feature>
                    <Room uuid=(lobby)>
                        <Feature uuid=(desk) />
                    </Room>
                </Asset>
            `)

            const result = await applyEdit({
                AssetId: testAssetId,
                RequestId: 'test-request',
                schema: editSchema
            })

            expect(result.success).toBe(true)
            if (result.success) {
                const mergedWML = schemaToWML([result.schema.schema])
                expect(mergedWML).toEqual(deIndentWML(`
                    <Asset uuid=(test)>
                        <Feature uuid=(desk)>
                            <Example uuid=(deskExample)><Name>Reception Desk</Name></Example>
                        </Feature>
                        <Room uuid=(lobby)>
                            <Feature uuid=(desk) />
                            <Example uuid=(lobbyExample)><Name>Lobby</Name></Example>
                        </Room>
                    </Asset>
                `))
            }
        })
    })

    describe("edit operations (Replace/Remove)", () => {
        const testAssetId = 'ASSET#test'

        it('should apply Replace operation to update room description', async () => {
            const existingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(lobby)>
                        <Example uuid=(lobbyExample)>
                            <Description>Old description</Description>
                        </Example>
                    </Room>
                </Asset>
            `)
            const existingStandard = new StandardForm(existingWML)
            
            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                standard: existingStandard,
                setJSON: jest.fn(),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined)
            }

            MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(mockWorkspace)

            const editSchema = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(lobby)>
                        <Example uuid=(lobbyExample)>
                            <Replace><Description>Old description</Description></Replace>
                            <With><Description>New description</Description></With>
                        </Example>
                    </Room>
                </Asset>
            `)

            const result = await applyEdit({
                AssetId: testAssetId,
                RequestId: 'test-request',
                schema: editSchema
            })

            expect(result.success).toBe(true)
            if (result.success) {
                const mergedWML = schemaToWML([result.schema.schema])
                expect(mergedWML).toEqual(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(lobby)>
                            <Example uuid=(lobbyExample)>
                                <Description>New description</Description>
                            </Example>
                        </Room>
                    </Asset>
                `))
            }
        })

        it('should apply Remove operation to delete a room', async () => {
            const existingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(lobby)>
                        <Example uuid=(lobbyExample)>
                            <Name>Lobby</Name>
                        </Example>
                    </Room>
                    <Room uuid=(kitchen)>
                        <Example uuid=(kitchenExample)>
                            <Name>Kitchen</Name>
                        </Example>
                    </Room>
                </Asset>
            `)
            const existingStandard = new StandardForm(existingWML)
            
            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                standard: existingStandard,
                setJSON: jest.fn(),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined)
            }

            MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(mockWorkspace)

            const editSchema = deIndentWML(`
                <Asset uuid=(test)>
                    <Remove>
                        <Room uuid=(kitchen)>
                            <Example uuid=(kitchenExample)>
                                <Name>Kitchen</Name>
                            </Example>
                        </Room>
                    </Remove>
                </Asset>
            `)

            const result = await applyEdit({
                AssetId: testAssetId,
                RequestId: 'test-request',
                schema: editSchema
            })

            expect(result.success).toBe(true)
            if (result.success) {
                const mergedWML = schemaToWML([result.schema.schema])
                expect(mergedWML).toEqual(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(lobby)>
                            <Example uuid=(lobbyExample)><Name>Lobby</Name></Example>
                        </Room>
                    </Asset>
                `))
            }
        })

        it('should remove exit from room', async () => {
            const existingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(lobby)>
                        <Example uuid=(lobbyExample)>
                            <Name>Lobby</Name>
                        </Example>
                        <Exit to=(kitchen)>north</Exit>
                        <Exit to=(bathroom)>south</Exit>
                    </Room>
                </Asset>
            `)
            const existingStandard = new StandardForm(existingWML)
            
            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                standard: existingStandard,
                setJSON: jest.fn(),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined)
            }

            MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(mockWorkspace)

            const editSchema = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(lobby)>
                        <Remove><Exit to=(kitchen)>north</Exit></Remove>
                    </Room>
                </Asset>
            `)

            const result = await applyEdit({
                AssetId: testAssetId,
                RequestId: 'test-request',
                schema: editSchema
            })

            expect(result.success).toBe(true)
            if (result.success) {
                const mergedWML = schemaToWML([result.schema.schema])
                expect(mergedWML).toEqual(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(lobby)>
                            <Example uuid=(lobbyExample)><Name>Lobby</Name></Example>
                            <Exit to=(bathroom)>south</Exit>
                        </Room>
                    </Asset>
                `))
            }
        })
    })

    describe("merge conflict handling", () => {
        const testAssetId = 'ASSET#test'

        it('should return error on merge conflict (Replace with non-matching base)', async () => {
            const existingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(lobby)>
                        <Example uuid=(lobbyExample)>
                            <Description>Current description</Description>
                        </Example>
                    </Room>
                </Asset>
            `)
            const existingStandard = new StandardForm(existingWML)
            
            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                standard: existingStandard,
                setJSON: jest.fn(),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined)
            }

            MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(mockWorkspace)

            // Try to replace with non-matching original
            const editSchema = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(lobby)>
                        <Example uuid=(lobbyExample)>
                            <Replace><Description>Wrong old description</Description></Replace>
                            <With><Description>New description</Description></With>
                        </Example>
                    </Room>
                </Asset>
            `)

            const result = await applyEdit({
                AssetId: testAssetId,
                RequestId: 'test-request',
                schema: editSchema
            })

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toBeTruthy()
            }
        })

        it('should return error on merge conflict (Remove with non-matching content)', async () => {
            const existingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(lobby)>
                        <Example uuid=(lobbyExample)>
                            <Name>Lobby</Name>
                        </Example>
                    </Room>
                </Asset>
            `)
            const existingStandard = new StandardForm(existingWML)
            
            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                standard: existingStandard,
                setJSON: jest.fn(),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined)
            }

            MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(mockWorkspace)

            // Try to remove with non-matching content
            const editSchema = deIndentWML(`
                <Asset uuid=(test)>
                    <Remove>
                        <Room uuid=(lobby)>
                            <Example uuid=(lobbyExample)>
                                <Name>Wrong Name</Name>
                            </Example>
                        </Room>
                    </Remove>
                </Asset>
            `)

            const result = await applyEdit({
                AssetId: testAssetId,
                RequestId: 'test-request',
                schema: editSchema
            })

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toBeTruthy()
            }
        })
    })

    describe("complex component scenarios", () => {
        const testAssetId = 'ASSET#test'

        it('should handle nested features and examples', async () => {
            const existingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(lobby)>
                        <Example uuid=(lobbyExample)>
                            <Name>Lobby</Name>
                        </Example>
                    </Room>
                </Asset>
            `)
            const existingStandard = new StandardForm(existingWML)
            
            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                standard: existingStandard,
                setJSON: jest.fn(),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined)
            }

            MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(mockWorkspace)

            const editSchema = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(lobby)>
                        <Feature uuid=(desk)>
                            <Example uuid=(deskExample)>
                                <Name>Reception Desk</Name>
                                <Description>A sleek desk</Description>
                            </Example>
                        </Feature>
                    </Room>
                </Asset>
            `)

            const result = await applyEdit({
                AssetId: testAssetId,
                RequestId: 'test-request',
                schema: editSchema
            })

            expect(result.success).toBe(true)
            if (result.success) {
                const mergedWML = schemaToWML([result.schema.schema])
                expect(mergedWML).toEqual(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(lobby)>
                            <Feature uuid=(desk)>
                                <Example uuid=(deskExample)>
                                    <Name>Reception Desk</Name>
                                    <Description>A sleek desk</Description>
                                </Example>
                            </Feature>
                            <Example uuid=(lobbyExample)><Name>Lobby</Name></Example>
                        </Room>
                    </Asset>
                `))
            }
        })

        it('should handle multiple component types in single edit', async () => {
            const existingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(lobby)>
                        <Example uuid=(lobbyExample)>
                            <Name>Lobby</Name>
                        </Example>
                    </Room>
                </Asset>
            `)
            const existingStandard = new StandardForm(existingWML)
            
            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                standard: existingStandard,
                setJSON: jest.fn(),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined)
            }

            MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(mockWorkspace)

            const editSchema = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(kitchen)>
                        <Example uuid=(kitchenExample)>
                            <Name>Kitchen</Name>
                        </Example>
                    </Room>
                    <Feature uuid=(oven)>
                        <Example uuid=(ovenExample)>
                            <Name>Oven</Name>
                        </Example>
                    </Feature>
                    <Knowledge uuid=(cookingSkill)>
                        <Example uuid=(cookingExample)>
                            <Name>Cooking</Name>
                        </Example>
                    </Knowledge>
                </Asset>
            `)

            const result = await applyEdit({
                AssetId: testAssetId,
                RequestId: 'test-request',
                schema: editSchema
            })

            expect(result.success).toBe(true)
            if (result.success) {
                const mergedWML = schemaToWML([result.schema.schema])
                expect(mergedWML).toEqual(deIndentWML(`
                    <Asset uuid=(test)>
                        <Feature uuid=(oven)>
                            <Example uuid=(ovenExample)><Name>Oven</Name></Example>
                        </Feature>
                        <Knowledge uuid=(cookingSkill)>
                            <Example uuid=(cookingExample)><Name>Cooking</Name></Example>
                        </Knowledge>
                        <Room uuid=(lobby)>
                            <Example uuid=(lobbyExample)><Name>Lobby</Name></Example>
                        </Room>
                        <Room uuid=(kitchen)>
                            <Example uuid=(kitchenExample)><Name>Kitchen</Name></Example>
                        </Room>
                    </Asset>
                `))
            }
        })

        it('should handle character references in rooms', async () => {
            const existingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(lobby)>
                        <Example uuid=(lobbyExample)>
                            <Name>Lobby</Name>
                        </Example>
                    </Room>
                </Asset>
            `)
            const existingStandard = new StandardForm(existingWML)
            
            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                standard: existingStandard,
                setJSON: jest.fn(),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined)
            }

            MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(mockWorkspace)

            // Characters have name/image/pronouns properties, not Example children
            const editSchema = deIndentWML(`
                <Asset uuid=(test)>
                    <Character uuid=(receptionist)>
                        <Name>Jane</Name>
                    </Character>
                    <Room uuid=(lobby)>
                        <Character uuid=(receptionist) />
                    </Room>
                </Asset>
            `)

            const result = await applyEdit({
                AssetId: testAssetId,
                RequestId: 'test-request',
                schema: editSchema
            })

            expect(result.success).toBe(true)
            if (result.success) {
                const mergedWML = schemaToWML([result.schema.schema])
                expect(mergedWML).toEqual(deIndentWML(`
                    <Asset uuid=(test)>
                        <Character uuid=(receptionist)><Name>Jane</Name></Character>
                        <Room uuid=(lobby)>
                            <Example uuid=(lobbyExample)><Name>Lobby</Name></Example>
                            <Character uuid=(receptionist) />
                        </Room>
                    </Asset>
                `))
            }
        })

        it('should handle map with positioned rooms', async () => {
            const existingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(lobby)>
                        <Example uuid=(lobbyExample)>
                            <Name>Lobby</Name>
                        </Example>
                    </Room>
                </Asset>
            `)
            const existingStandard = new StandardForm(existingWML)
            
            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                standard: existingStandard,
                setJSON: jest.fn(),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined)
            }

            MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(mockWorkspace)

            const editSchema = deIndentWML(`
                <Asset uuid=(test)>
                    <Map uuid=(mainMap)>
                        <Room uuid=(lobby)>
                            <Position x="0" y="0" />
                        </Room>
                    </Map>
                </Asset>
            `)

            const result = await applyEdit({
                AssetId: testAssetId,
                RequestId: 'test-request',
                schema: editSchema
            })

            expect(result.success).toBe(true)
            if (result.success) {
                const mergedWML = schemaToWML([result.schema.schema])
                expect(mergedWML).toEqual(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(lobby)>
                            <Example uuid=(lobbyExample)><Name>Lobby</Name></Example>
                        </Room>
                        <Map uuid=(mainMap)>
                            <Room uuid=(lobby)><Position x="0" y="0" /></Room>
                        </Map>
                    </Asset>
                `))
            }
        })
    })

    describe("content preservation and persistence", () => {
        const testAssetId = 'ASSET#test'

        it('should write both JSON and WML to S3', async () => {
            // Create an existing asset with at least one component to avoid empty content error
            const existingStandard = new StandardForm('<Asset uuid=(test)><Room uuid=(existingRoom) /></Asset>')
            
            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                standard: existingStandard,
                setJSON: jest.fn(),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined)
            }

            MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(mockWorkspace)

            const editSchema = '<Asset uuid=(test)><Room uuid=(testRoom) /></Asset>'

            const result = await applyEdit({
                AssetId: testAssetId,
                RequestId: 'test-request',
                schema: editSchema
            })

            expect(result.success).toBe(true)
            expect(mockWorkspace.setJSON).toHaveBeenCalledTimes(1)
            expect(mockWorkspace.pushJSON).toHaveBeenCalledTimes(1)
            expect(mockWorkspace.pushWML).toHaveBeenCalledTimes(1)
        })

        it('should return merged StandardForm in success result', async () => {
            const existingWML = '<Asset uuid=(test)><Room uuid=(lobby) /></Asset>'
            const existingStandard = new StandardForm(existingWML)
            
            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                standard: existingStandard,
                setJSON: jest.fn(),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined)
            }

            MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(mockWorkspace)

            const editSchema = '<Asset uuid=(test)><Room uuid=(kitchen) /></Asset>'

            const result = await applyEdit({
                AssetId: testAssetId,
                RequestId: 'test-request',
                schema: editSchema
            })

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.schema).toBeInstanceOf(StandardForm)
                const mergedWML = schemaToWML([result.schema.schema])
                expect(mergedWML).toEqual(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(lobby) />
                        <Room uuid=(kitchen) />
                    </Asset>
                `))
            }
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

