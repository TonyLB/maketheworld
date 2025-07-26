import { vi } from 'vitest'
import { addImport } from "."
import { Schema, schemaToWML } from "@tonylb/mtw-wml/ts/schema"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

const schema = new Schema()
schema.loadWML(`<Asset key=(testAsset)>
    <Room uuid=(testRoom) from=(ASSET#testImport)><Name>: imported</Name></Room>
</Asset>`)
const standard = new StandardForm(schema.schema[0])

const overrideUpdateStandardInternal = vi.fn()
const overrideUpdateStandard = vi.fn()

const dispatch = vi.fn()
const getState = vi.fn().mockReturnValue({})

describe('personalAssets slice', () => {
    describe('addImport', () => {

        beforeEach(() => {
            vi.clearAllMocks()
            vi.resetAllMocks()
            overrideUpdateStandard.mockReturnValue(overrideUpdateStandardInternal)
        })

        it('should no-op on a repeated import', () => {
            addImport({
                assetId: 'ASSET#testAsset',
                fromAsset: 'ASSET#testImport',
                uuid: 'ROOM#testRoom',
                tag: 'Room'
            }, { overrideUpdateStandard })(dispatch, getState)
            expect(overrideUpdateStandardInternal).toHaveBeenCalledWith({
                type: 'update',
                update: expect.any(Function)
            })
            const base = new StandardForm(`
                <Asset key=(testAsset)>
                    <Room uuid=(testRoom) from=(ASSET#testImport) />
                </Asset>
            `)
            const diff = base.diff(overrideUpdateStandardInternal.mock.calls[0][0].update(base._clone()))
            console.log(`diff: ${schemaToWML([diff.schema])}`)
            expect(schemaToWML([diff.schema])).toEqual('<Asset key=(testAsset) />')
        })

        it('should add children on an import from same asset', () => {
            addImport({
                assetId: 'ASSET#testAsset',
                fromAsset: 'ASSET#testImport',
                uuid: 'ROOM#testRoomTwo',
                tag: 'Room'
            }, { overrideUpdateStandard })(dispatch, getState)
            expect(overrideUpdateStandardInternal).toHaveBeenCalledWith({
                type: 'update',
                update: expect.any(Function)
            })
            const base = new StandardForm(`
                <Asset key=(testAsset)>
                    <Import from=(testImport)><Room key=(testRoom) /></Import>
                </Asset>
            `)
            const updated = overrideUpdateStandardInternal.mock.calls[0][0].update(base._clone())
            const diff = base.diff(updated)
            expect(diff).toBeDefined()
            if (diff) {
                expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room uuid=(testRoomTwo) from=(ASSET#testImport) />
                    </Asset>
                `))
            }
        })

        it('should return new import item on an import from different asset', () => {
            addImport({
                assetId: 'ASSET#testAsset',
                fromAsset: 'ASSET#testImportTwo',
                uuid: 'ROOM#testRoomTwo',
                tag: 'Room'
            }, { overrideUpdateStandard })(dispatch, getState)
            expect(overrideUpdateStandardInternal).toHaveBeenCalledWith({
                type: 'update',
                update: expect.any(Function)
            })
            const base = new StandardForm(`
                <Asset key=(testAsset)>
                    <Import from=(testImport)><Room key=(testRoom) /></Import>
                </Asset>
            `)
            const updated = overrideUpdateStandardInternal.mock.calls[0][0].update(base._clone())
            const diff = base.diff(updated)
            expect(diff).toBeDefined()
            if (diff) {
                expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room uuid=(testRoomTwo) from=(ASSET#testImportTwo) />
                    </Asset>
                `))
            }
        })

    })

})