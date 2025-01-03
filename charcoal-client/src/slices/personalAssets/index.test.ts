import { addImport } from "."
import { Schema } from "@tonylb/mtw-wml/dist/schema"
import { StandardForm } from "@tonylb/mtw-wml/dist/standardize"
import { StandardFormData } from "@tonylb/mtw-wml/dist/standardize/components/dataTypes"

const schema = new Schema()
schema.loadWML(`<Asset key=(testAsset)>
    <Import from=(testImport)>
        <Room key=(testRoom) />
    </Import>
    <Room key=(testRoom)><Name>: imported</Name></Room>
</Asset>`)
const standard = new StandardForm(schema.schema[0])

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
            overrideGetStandardInternal.mockReturnValue(standard.toJSON())
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
                        { data: { tag: 'Room', key: 'testRoom' }, children: [] },
                        { data: { tag: 'Room', key: 'testRoomTwo' }, children: [] }
                    ]
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
                        { data: { tag: 'Room', key: 'testRoom' }, children: [] },
                    ]
                },
                {
                    data: { tag: 'Import', from: 'testImportTwo', mapping: expect.any(Object) },
                    children: [
                        { data: { tag: 'Room', key: 'testRoomTwo' }, children: [] },
                    ]
                }]
            })
        })

    })

})