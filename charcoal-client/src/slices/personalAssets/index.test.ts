import Normalizer from "@tonylb/mtw-wml/dist/normalize"
import { addImport, getNormalized } from "."

const normalizer = new Normalizer()
normalizer.loadWML(`<Asset key=(testAsset)>
    <Import from=(testImport)>
        <Use key=(testRoom) type="Room" />
    </Import>
    <Room key=(testRoom)><Name>: imported</Name></Room>
</Asset>`)

const overrideGetNormalizedInternal = jest.fn()
const overrideGetNormalized = jest.fn()
const overrideUpdateNormalInternal = jest.fn()
const overrideUpdateNormal = jest.fn()

const dispatch = jest.fn()
const getState = jest.fn().mockReturnValue({})

describe('personalAssets slice', () => {
    describe('addImport', () => {

        beforeEach(() => {
            jest.clearAllMocks()
            jest.resetAllMocks()
            overrideGetNormalizedInternal.mockReturnValue(normalizer.normal)
            overrideGetNormalized.mockReturnValue(overrideGetNormalizedInternal)
            overrideUpdateNormal.mockReturnValue(overrideUpdateNormalInternal)
        })

        it('should return same mapping on a repeated import', () => {
            addImport({
                assetId: 'ASSET#testAsset',
                fromAsset: 'testImport',
                key: 'testRoom',
                type: 'Room'
            }, { overrideGetNormalized, overrideUpdateNormal })(dispatch, getState)
            expect(overrideUpdateNormalInternal).toHaveBeenCalledWith({
                type: 'put',
                position: { contextStack: [{ key: 'testAsset', tag: 'Asset', index: 0 }], index: 0, replace: true },
                item: {
                    key: 'Import-0',
                    tag: 'Import',
                    from: 'testImport',
                    mapping: {
                        testRoom: { key: 'testRoom', type: 'Room' }
                    }
                }
            })
        })

        it('should return extended mapping on an import from same asset', () => {
            addImport({
                assetId: 'ASSET#testAsset',
                fromAsset: 'testImport',
                key: 'testRoomTwo',
                type: 'Room'
            }, { overrideGetNormalized, overrideUpdateNormal })(dispatch, getState)
            expect(overrideUpdateNormalInternal).toHaveBeenCalledWith({
                type: 'put',
                position: { contextStack: [{ key: 'testAsset', tag: 'Asset', index: 0 }], index: 0, replace: true },
                item: {
                    key: 'Import-0',
                    tag: 'Import',
                    from: 'testImport',
                    mapping: {
                        testRoom: { key: 'testRoom', type: 'Room' },
                        testRoomTwo: { key: 'testRoomTwo', type: 'Room' }
                    }
                }
            })
        })

        it('should return new import item on an import from differen asset', () => {
            addImport({
                assetId: 'ASSET#testAsset',
                fromAsset: 'testImportTwo',
                key: 'testRoomTwo',
                type: 'Room'
            }, { overrideGetNormalized, overrideUpdateNormal })(dispatch, getState)
            expect(overrideUpdateNormalInternal).toHaveBeenCalledWith({
                type: 'put',
                position: { contextStack: [{ key: 'testAsset', tag: 'Asset', index: 0 }] },
                item: {
                    key: 'Import-1',
                    tag: 'Import',
                    from: 'testImportTwo',
                    mapping: {
                        testRoomTwo: { key: 'testRoomTwo', type: 'Room' }
                    }
                }
            })
        })
    })
})