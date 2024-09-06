import { addImport } from "."
import { GenericTree, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { SchemaTag, isSchemaImport } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { Schema } from "@tonylb/mtw-wml/dist/schema"
import { Standardizer } from "@tonylb/mtw-wml/dist/standardize"
import { StandardForm } from "@tonylb/mtw-wml/dist/standardize/baseClasses"

const schema = new Schema()
schema.loadWML(`<Asset key=(testAsset)>
    <Import from=(testImport)>
        <Room key=(testRoom) />
    </Import>
    <Room key=(testRoom)><Name>: imported</Name></Room>
</Asset>`)
const standard = new Standardizer(schema.schema)

const overrideGetStandardInternal = jest.fn()
const overrideGetStandard = jest.fn()
const overrideUpdateStandardInternal = jest.fn()
const overrideUpdateStandard = jest.fn()

const dispatch = jest.fn()
const getState = jest.fn().mockReturnValue({})

describe('personalAssets slice', () => {
    describe('addImport', () => {

        beforeEach(() => {
            jest.clearAllMocks()
            jest.resetAllMocks()
            overrideGetStandardInternal.mockReturnValue(standard.standardForm)
            overrideGetStandard.mockReturnValue(overrideGetStandardInternal)
            overrideUpdateStandard.mockReturnValue(overrideUpdateStandardInternal)
        })

        it('should no-op on a repeated import', () => {
            addImport({
                assetId: 'ASSET#testAsset',
                fromAsset: 'testImport',
                key: 'testRoom',
                type: 'Room'
            }, { overrideGetStandard, overrideUpdateStandard })(dispatch, getState)
            expect(overrideUpdateStandardInternal).not.toHaveBeenCalled()
        })

        it('should add children on an import from same asset', () => {
            addImport({
                assetId: 'ASSET#testAsset',
                fromAsset: 'testImport',
                key: 'testRoomTwo',
                type: 'Room'
            }, { overrideGetStandard, overrideUpdateStandard })(dispatch, getState)
            expect(overrideUpdateStandardInternal).toHaveBeenCalledWith({
                type: 'replaceMetaData',
                metaData: [{
                    data: { tag: 'Import', from: 'testImport', mapping: expect.any(Object) },
                    children: [
                        { data: { tag: 'Room', key: 'testRoom' }, children: [], id: expect.any(String) },
                        { data: { tag: 'Room', key: 'testRoomTwo' }, children: [], id: expect.any(String) }
                    ],
                    id: expect.any(String)
                }]
            })
        })

        it('should return new import item on an import from different asset', () => {
            addImport({
                assetId: 'ASSET#testAsset',
                fromAsset: 'testImportTwo',
                key: 'testRoomTwo',
                type: 'Room'
            }, { overrideGetStandard, overrideUpdateStandard })(dispatch, getState)
            expect(overrideUpdateStandardInternal).toHaveBeenCalledWith({
                type: 'replaceMetaData',
                metaData: [{
                    data: { tag: 'Import', from: 'testImport', mapping: expect.any(Object) },
                    children: [
                        { data: { tag: 'Room', key: 'testRoom' }, children: [], id: expect.any(String) },
                    ],
                    id: expect.any(String)
                },
                {
                    data: { tag: 'Import', from: 'testImportTwo', mapping: expect.any(Object) },
                    children: [
                        { data: { tag: 'Room', key: 'testRoomTwo' }, children: [], id: expect.any(String) },
                    ],
                    id: expect.any(String)
                }]
            })
        })

        it('should add new import item to character', () => {
            const schema = new Schema()
            schema.loadWML(`<Character key=(testCharacter)>
                <Name>Test</Name>
                <Import from=(testImportOne) />
            </Character>`)
            const standard = new Standardizer(schema.schema)

            addImport({
                assetId: 'CHARACTER#testCharacter',
                fromAsset: 'testImportTwo'
            }, { overrideGetStandard: jest.fn().mockReturnValue((): StandardForm => (standard.standardForm)), overrideUpdateStandard })(dispatch, getState)
            expect(overrideUpdateStandardInternal).toHaveBeenCalledWith({
                type: 'replaceMetaData',
                metaData: [{
                    data: { tag: 'Import', from: 'testImportOne', mapping: expect.any(Object) },
                    children: [],
                    id: expect.any(String)
                },
                {
                    data: { tag: 'Import', from: 'testImportTwo', mapping: expect.any(Object) },
                    children: [],
                    id: expect.any(String)
                }]
            })
        })
    })

})