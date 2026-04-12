import { initializePrimitives } from './index'
import ReadOnlyAssetWorkspace from '@tonylb/mtw-asset-workspace/ts/readOnly'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { applyEdit } from '../applyEdit'

// Mock dependencies
jest.mock('@tonylb/mtw-asset-workspace/ts/readOnly')
jest.mock('../applyEdit')

const MockAssetWorkspace = ReadOnlyAssetWorkspace as jest.MockedClass<typeof ReadOnlyAssetWorkspace>
const applyEditMock = applyEdit as jest.MockedFunction<typeof applyEdit>

const FULL_PRIMITIVES_WML_SINGLE_LINE = '<Asset uuid=(primitives)><Room uuid=(VORTEX) /><Room uuid=(STRAIGHTAWAY) /><Room uuid=(CLIFFTOP) /><Room uuid=(CORNER) /><Room uuid=(BRIDGE) /><Knowledge uuid=(knowledgeRoot) /><Situation uuid=(DEFAULT)><ShortName>Default</ShortName></Situation></Asset>'

describe('initializePrimitives', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('when primitives does not exist', () => {
        it('should create primitives asset via applyEdit', async () => {
            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                status: { json: 'Error' },  // Indicates file not found
                standard: undefined
            }

            MockAssetWorkspace.mockImplementation(() => mockWorkspace as any)
            
            applyEditMock.mockResolvedValue({
                success: true,
                schema: new StandardForm(FULL_PRIMITIVES_WML_SINGLE_LINE)
            })

            const result = await initializePrimitives()

            expect(result).toEqual({
                success: true,
                action: 'created',
                message: 'Primitives asset created',
                schema: expect.any(StandardForm)
            })
            
            expect(MockAssetWorkspace).toHaveBeenCalledWith('ASSET#primitives', 'Canon')
            expect(applyEditMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    AssetId: 'ASSET#primitives',
                    createIfNeeded: true,
                    zone: 'Canon'
                })
            )
        })

        it('should report failure if applyEdit fails', async () => {
            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                status: { json: 'Error' },
                standard: undefined
            }

            MockAssetWorkspace.mockImplementation(() => mockWorkspace as any)
            
            applyEditMock.mockResolvedValue({
                success: false,
                error: 'S3 operation failed'
            })

            const result = await initializePrimitives()

            expect(result.success).toBe(false)
            expect(result.action).toBe('created')
            expect(result.message).toContain('Failed to create primitives')
        })
    })

    describe('when primitives exists but is empty', () => {
        it('should create primitives content via applyEdit', async () => {
            const emptyStandard = new StandardForm('ASSET#primitives')
            emptyStandard._components = []  // Explicitly empty

            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                status: { json: 'Clean' },
                standard: emptyStandard
            }

            MockAssetWorkspace.mockImplementation(() => mockWorkspace as any)
            
            applyEditMock.mockResolvedValue({
                success: true,
                schema: new StandardForm(FULL_PRIMITIVES_WML_SINGLE_LINE)
            })

            const result = await initializePrimitives()

            expect(result).toEqual({
                success: true,
                action: 'created',
                message: 'Primitives asset created',
                schema: expect.any(StandardForm)
            })
            
            expect(applyEditMock).toHaveBeenCalled()
        })
    })

    describe('when primitives is fully initialized', () => {
        it('should skip initialization (idempotent)', async () => {
            const fullPrimitivesWML = FULL_PRIMITIVES_WML_SINGLE_LINE
            const existingStandard = new StandardForm(fullPrimitivesWML)

            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                status: { json: 'Clean' },
                standard: existingStandard
            }

            MockAssetWorkspace.mockImplementation(() => mockWorkspace as any)

            const result = await initializePrimitives()

            expect(result).toEqual({
                success: true,
                action: 'skipped',
                message: 'Primitives already initialized (no changes needed)'
            })
            
            // Should NOT call applyEdit
            expect(applyEditMock).not.toHaveBeenCalled()
        })
    })

    describe('when primitives is missing components', () => {
        it('should repair when missing VORTEX room', async () => {
            const partialWML = '<Asset uuid=(primitives)><Knowledge uuid=(knowledgeRoot) /></Asset>'
            const existingStandard = new StandardForm(partialWML)

            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                status: { json: 'Clean' },
                standard: existingStandard
            }

            MockAssetWorkspace.mockImplementation(() => mockWorkspace as any)
            
            applyEditMock.mockResolvedValue({
                success: true,
                schema: new StandardForm(FULL_PRIMITIVES_WML_SINGLE_LINE)
            })

            const result = await initializePrimitives()

            expect(result).toEqual({
                success: true,
                action: 'repaired',
                message: 'Primitives repaired (added 6 missing component(s))',
                schema: expect.any(StandardForm)
            })
            
            // Should call applyEdit with repair schema containing VORTEX and DEFAULT situation
            expect(applyEditMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    AssetId: 'ASSET#primitives',
                    schema: expect.stringContaining('<Room uuid=(VORTEX) />')
                })
            )
            
            // Should NOT include knowledgeRoot (already present)
            const call = applyEditMock.mock.calls[0][0]
            expect(call.schema).not.toContain('knowledgeRoot')
        })

        it('should repair when missing knowledgeRoot knowledge', async () => {
            const partialWML = '<Asset uuid=(primitives)><Room uuid=(VORTEX) /></Asset>'
            const existingStandard = new StandardForm(partialWML)

            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                status: { json: 'Clean' },
                standard: existingStandard
            }

            MockAssetWorkspace.mockImplementation(() => mockWorkspace as any)
            
            applyEditMock.mockResolvedValue({
                success: true,
                schema: new StandardForm(FULL_PRIMITIVES_WML_SINGLE_LINE)
            })

            const result = await initializePrimitives()

            expect(result).toEqual({
                success: true,
                action: 'repaired',
                message: 'Primitives repaired (added 6 missing component(s))',
                schema: expect.any(StandardForm)
            })
            
            // Should call applyEdit with repair schema containing knowledgeRoot and DEFAULT situation
            const call = applyEditMock.mock.calls[0][0]
            expect(call.schema).toContain('<Knowledge uuid=(knowledgeRoot) />')
            expect(call.schema).not.toContain('VORTEX')
        })

        it('should create when asset has no components (treated as empty)', async () => {
            const emptyWML = '<Asset uuid=(primitives)></Asset>'
            const existingStandard = new StandardForm(emptyWML)

            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                status: { json: 'Clean' },
                standard: existingStandard
            }

            MockAssetWorkspace.mockImplementation(() => mockWorkspace as any)
            
            applyEditMock.mockResolvedValue({
                success: true,
                schema: new StandardForm(FULL_PRIMITIVES_WML_SINGLE_LINE)
            })

            const result = await initializePrimitives()

            // Empty asset (no components) is treated as "create", not "repair"
            expect(result).toEqual({
                success: true,
                action: 'created',
                message: 'Primitives asset created',
                schema: expect.any(StandardForm)
            })
            
            // Should call applyEdit with full primitives WML
            const call = applyEditMock.mock.calls[0][0]
            expect(call.schema).toContain('<Room uuid=(VORTEX) />')
            expect(call.schema).toContain('<Room uuid=(STRAIGHTAWAY) />')
            expect(call.schema).toContain('<Knowledge uuid=(knowledgeRoot) />')
            expect(call.schema).toContain('Situation uuid=(DEFAULT)')
            expect(call.schema).toContain('ShortName')
            expect(call.createIfNeeded).toBe(true)
        })

        it('should repair when missing DEFAULT situation', async () => {
            const partialWML = '<Asset uuid=(primitives)><Room uuid=(VORTEX) /><Knowledge uuid=(knowledgeRoot) /></Asset>'
            const existingStandard = new StandardForm(partialWML)

            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                status: { json: 'Clean' },
                standard: existingStandard
            }

            MockAssetWorkspace.mockImplementation(() => mockWorkspace as any)

            applyEditMock.mockResolvedValue({
                success: true,
                schema: new StandardForm(FULL_PRIMITIVES_WML_SINGLE_LINE)
            })

            const result = await initializePrimitives()

            expect(result).toEqual({
                success: true,
                action: 'repaired',
                message: 'Primitives repaired (added 5 missing component(s))',
                schema: expect.any(StandardForm)
            })

            const call = applyEditMock.mock.calls[0][0]
            expect(call.schema).toContain('Situation uuid=(DEFAULT)')
            expect(call.schema).toContain('ShortName')
            expect(call.schema).not.toContain('<Room uuid=(VORTEX) />')
            expect(call.schema).not.toContain('<Knowledge uuid=(knowledgeRoot) />')
        })

        it('should report failure if repair fails', async () => {
            const partialWML = '<Asset uuid=(primitives)><Knowledge uuid=(knowledgeRoot) /></Asset>'
            const existingStandard = new StandardForm(partialWML)

            const mockWorkspace = {
                loadJSON: jest.fn().mockResolvedValue(undefined),
                status: { json: 'Clean' },
                standard: existingStandard
            }

            MockAssetWorkspace.mockImplementation(() => mockWorkspace as any)
            
            applyEditMock.mockResolvedValue({
                success: false,
                error: 'Merge conflict'
            })

            const result = await initializePrimitives()

            expect(result.success).toBe(false)
            expect(result.action).toBe('repaired')
            expect(result.message).toContain('Primitives repair failed')
        })
    })

    describe('error handling', () => {
        it('should return error if loadJSON throws', async () => {
            const mockWorkspace = {
                loadJSON: jest.fn().mockRejectedValue(new Error('S3 error')),
                status: { json: 'Initial' },
                standard: undefined
            }

            MockAssetWorkspace.mockImplementation(() => mockWorkspace as any)

            const result = await initializePrimitives()

            expect(result.success).toBe(false)
            expect(result.action).toBe('repaired')
            expect(result.message).toContain('Failed to check/repair primitives')
        })
    })
})

