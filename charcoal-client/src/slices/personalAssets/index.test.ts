import Normalizer from "@tonylb/mtw-wml/dist/normalize"
import { addImport, removeImport } from "."
import { GenericTree, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { SchemaTag, isSchemaImport } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { Schema } from "@tonylb/mtw-wml/dist/schema"

const normalizer = new Normalizer()
normalizer.loadWML(`<Asset key=(testAsset)>
    <Import from=(testImport)>
        <Room key=(testRoom) />
    </Import>
    <Room key=(testRoom)><Name>: imported</Name></Room>
</Asset>`)
const schema = new Schema()
schema.loadWML(`<Asset key=(testAsset)>
    <Import from=(testImport)>
        <Room key=(testRoom) />
    </Import>
    <Room key=(testRoom)><Name>: imported</Name></Room>
</Asset>`)

const overrideGetNormalizedInternal = jest.fn()
const overrideGetNormalized = jest.fn()
const overrideGetSchemaInternal = jest.fn()
const overrideGetSchema = jest.fn()
const overrideUpdateSchemaInternal = jest.fn()
const overrideUpdateSchema = jest.fn()

const dispatch = jest.fn()
const getState = jest.fn().mockReturnValue({})

describe('personalAssets slice', () => {
    describe('addImport', () => {

        beforeEach(() => {
            jest.clearAllMocks()
            jest.resetAllMocks()
            overrideGetNormalizedInternal.mockReturnValue(normalizer.normal)
            overrideGetNormalized.mockReturnValue(overrideGetNormalizedInternal)
            overrideGetSchemaInternal.mockReturnValue(schema.schema)
            overrideGetSchema.mockReturnValue(overrideGetSchemaInternal)
            overrideUpdateSchema.mockReturnValue(overrideUpdateSchemaInternal)
        })

        it('should return same mapping on a repeated import', () => {
            addImport({
                assetId: 'ASSET#testAsset',
                fromAsset: 'testImport',
                key: 'testRoom',
                type: 'Room'
            }, { overrideGetSchema, overrideUpdateSchema })(dispatch, getState)
            const importItems = schema.schema[0].children.filter(({ data }) => (isSchemaImport(data)))
            expect(overrideUpdateSchemaInternal).toHaveBeenCalledWith({
                type: 'replace',
                id: importItems[0].id,
                item: {
                    data: {
                        tag: 'Import',
                        from: 'testImport',
                        mapping: {
                            testRoom: { key: 'testRoom', type: 'Room' }
                        }
                    },
                    children: []
                }
            })
        })

        it('should return extended mapping on an import from same asset', () => {
            addImport({
                assetId: 'ASSET#testAsset',
                fromAsset: 'testImport',
                key: 'testRoomTwo',
                type: 'Room'
            }, { overrideGetSchema, overrideUpdateSchema })(dispatch, getState)
            const importItems = schema.schema[0].children.filter(({ data }) => (isSchemaImport(data)))
            expect(overrideUpdateSchemaInternal).toHaveBeenCalledWith({
                type: 'replace',
                id: importItems[0].id,
                item: {
                    data: {
                        tag: 'Import',
                        from: 'testImport',
                        mapping: {
                            testRoom: { key: 'testRoom', type: 'Room' },
                            testRoomTwo: { key: 'testRoomTwo', type: 'Room' }
                        }
                    },
                    children: []
                }
            })
        })

        it('should return new import item on an import from different asset', () => {
            addImport({
                assetId: 'ASSET#testAsset',
                fromAsset: 'testImportTwo',
                key: 'testRoomTwo',
                type: 'Room'
            }, { overrideGetSchema, overrideUpdateSchema })(dispatch, getState)
            expect(overrideUpdateSchemaInternal).toHaveBeenCalledWith({
                type: 'addChild',
                id: schema.schema[0].id,
                item: {
                    data: {
                        tag: 'Import',
                        from: 'testImportTwo',
                        mapping: {
                            testRoomTwo: { key: 'testRoomTwo', type: 'Room' }
                        }
                    },
                    children: []
                }
            })
        })

        it('should add new import item to character', () => {
            const normalizer = new Normalizer()
            normalizer.loadWML(`<Character key=(testCharacter)>
                <Name>Test</Name>
                <Import from=(testImportOne) />
            </Character>`)
            const schema = new Schema()
            schema.loadWML(`<Character key=(testCharacter)>
                <Name>Test</Name>
                <Import from=(testImportOne) />
            </Character>`)

            addImport({
                assetId: 'CHARACTER#testCharacter',
                fromAsset: 'testImportTwo'
            }, { overrideGetSchema: jest.fn().mockReturnValue((): GenericTree<SchemaTag, TreeId> => (schema.schema)), overrideUpdateSchema })(dispatch, getState)
            expect(overrideUpdateSchemaInternal).toHaveBeenCalledWith({
                type: 'addChild',
                id: schema.schema[0].id,
                item: {
                    data: {
                        tag: 'Import',
                        from: 'testImportTwo',
                        mapping: {}
                    },
                    children: []
                }
            })
        })
    })

    describe('removeImport', () => {

        beforeEach(() => {
            jest.clearAllMocks()
            jest.resetAllMocks()
            overrideGetSchemaInternal.mockReturnValue(normalizer.schema)
            overrideGetSchema.mockReturnValue(overrideGetSchemaInternal)
            overrideUpdateSchema.mockReturnValue(overrideUpdateSchemaInternal)
        })

        it('should remove import from character', () => {
            const schema = new Schema()
            schema.loadWML(`<Character key=(testCharacter)>
                <Name>Test</Name>
                <Import from=(testImportOne) />
            </Character>`)

            const importItemId = schema.schema[0].children.filter(({ data }) => (isSchemaImport(data)))[0].id
            removeImport({
                assetId: 'CHARACTER#testCharacter',
                fromAsset: 'testImportOne'
            }, { overrideGetSchema: jest.fn().mockReturnValue((): GenericTree<SchemaTag, TreeId> => (schema.schema)), overrideUpdateSchema })(dispatch, getState)
            expect(overrideUpdateSchemaInternal).toHaveBeenCalledWith({
                type: 'delete',
                id: importItemId
            })
        })

        it('should no-op when asked to remove an import that is not present', () => {
            const schema = new Schema()
            schema.loadWML(`<Character key=(testCharacter)>
                <Name>Test</Name>
                <Import from=(testImportOne) />
            </Character>`)

            removeImport({
                assetId: 'CHARACTER#testCharacter',
                fromAsset: 'testImportTwo'
            }, { overrideGetSchema: jest.fn().mockReturnValue((): GenericTree<SchemaTag, TreeId> => (schema.schema)), overrideUpdateSchema })(dispatch, getState)
            expect(overrideUpdateSchemaInternal).not.toHaveBeenCalled()
        })

    })
})