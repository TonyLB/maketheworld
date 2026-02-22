import { vi } from 'vitest'
import { addImport, getTopLevelAddToReferenceList } from '.'
import { Schema, schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'

const schema = new Schema()
schema.loadWML(`<Asset uuid=(testAsset)>
    <Room uuid=(testRoom) from=(ASSET#testImport)><ShortName>: imported</ShortName></Room>
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
                tag: 'Room',
                addToReferenceList: getTopLevelAddToReferenceList
            }, { overrideUpdateStandard })(dispatch, getState)
            expect(overrideUpdateStandardInternal).toHaveBeenCalledWith(expect.objectContaining({
                type: 'update',
                update: expect.any(Function)
            }))
            const base = new StandardForm(`
                <Asset uuid=(testAsset)>
                    <Room uuid=(testRoom) from=(ASSET#testImport) />
                </Asset>
            `)
            const diff = base.diff(overrideUpdateStandardInternal.mock.calls[0][0].update(base._clone()))
            console.log(`diff: ${schemaToWML([diff.schema])}`)
            expect(schemaToWML([diff.schema])).toEqual('<Asset uuid=(testAsset) />')
        })

        it('should add children on an import from same asset', () => {
            addImport({
                assetId: 'ASSET#testAsset',
                fromAsset: 'ASSET#testImport',
                uuid: 'ROOM#testRoomTwo',
                tag: 'Room',
                addToReferenceList: getTopLevelAddToReferenceList
            }, { overrideUpdateStandard })(dispatch, getState)
            expect(overrideUpdateStandardInternal).toHaveBeenCalledWith(expect.objectContaining({
                type: 'update',
                update: expect.any(Function)
            }))
            const base = new StandardForm(`
                <Asset uuid=(testAsset)>
                    <Import from=(testImport)><Room key=(testRoom) /></Import>
                </Asset>
            `)
            const updated = overrideUpdateStandardInternal.mock.calls[0][0].update(base._clone())
            const diff = base.diff(updated)
            expect(diff).toBeDefined()
            if (diff) {
                expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(testAsset)>
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
                tag: 'Room',
                addToReferenceList: getTopLevelAddToReferenceList
            }, { overrideUpdateStandard })(dispatch, getState)
            expect(overrideUpdateStandardInternal).toHaveBeenCalledWith(expect.objectContaining({
                type: 'update',
                update: expect.any(Function)
            }))
            const base = new StandardForm(`
                <Asset uuid=(testAsset)>
                    <Import from=(testImport)><Room key=(testRoom) /></Import>
                </Asset>
            `)
            const updated = overrideUpdateStandardInternal.mock.calls[0][0].update(base._clone())
            const diff = base.diff(updated)
            expect(diff).toBeDefined()
            if (diff) {
                expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(testRoomTwo) from=(ASSET#testImportTwo) />
                    </Asset>
                `))
            }
        })

        it('when addToReferenceList returns top-level descriptor, ref is added to _topLevel', () => {
            addImport({
                assetId: 'ASSET#testAsset',
                fromAsset: 'ASSET#testImport',
                uuid: 'ROOM#testRoomTwo',
                tag: 'Room',
                addToReferenceList: getTopLevelAddToReferenceList
            }, { overrideUpdateStandard })(dispatch, getState)
            const base = new StandardForm(`
                <Asset uuid=(testAsset)>
                    <Import from=(testImport)><Room key=(testRoom) /></Import>
                </Asset>
            `)
            const updated = overrideUpdateStandardInternal.mock.calls[0][0].update(base._clone())
            expect(updated._topLevel).toBeDefined()
            const refs = updated._topLevel!.payload
            expect(refs.some((r) => r.universalKey === 'ROOM#testRoomTwo')).toBe(true)
        })

        it('when addToReferenceList returns list descriptor, ref is added to that list and _topLevel unchanged', () => {
            const base = new StandardForm(`
                <Asset uuid=(testAsset)>
                    <Room uuid=(room1) />
                    <Import from=(testImport)><Room key=(testRoom) /></Import>
                </Asset>
            `)
            const addToReferenceList = (draft: StandardForm) => {
                const room = draft.byUniversalId['ROOM#room1']
                if (!(room instanceof StandardRoom)) return null
                const features = room._payload._features ?? new ReferenceList([])
                return {
                    referenceList: features,
                    setReferenceList: (list: ReferenceList) => {
                        room._payload._features = list
                    }
                }
            }
            addImport({
                assetId: 'ASSET#testAsset',
                fromAsset: 'ASSET#testImport',
                uuid: 'FEATURE#featureFromImport',
                tag: 'Feature',
                addToReferenceList
            }, { overrideUpdateStandard })(dispatch, getState)
            const updated = overrideUpdateStandardInternal.mock.calls[0][0].update(base._clone())
            const feature = updated.byUniversalId['FEATURE#featureFromImport']
            expect(feature).toBeDefined()
            expect(feature instanceof StandardFeature).toBe(true)
            const room = updated.byUniversalId['ROOM#room1'] as StandardRoom
            expect(room._payload._features?.payload.some((r) => r.universalKey === 'FEATURE#featureFromImport')).toBe(true)
            expect(updated._topLevel?.payload.some((r) => r.universalKey === 'FEATURE#featureFromImport')).toBe(false)
        })

    })

})