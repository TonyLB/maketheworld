import { describe, it, expect } from 'vitest'
import { addImportToDraft } from './addImportToDraft'
import { getTopLevelAddToReferenceList } from './index'
import { Schema, schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

describe('addImportToDraft', () => {
    it('should no-op on a repeated import (same uuid and fromAsset)', () => {
        const base = new StandardForm(`
            <Asset uuid=(testAsset)>
                <Room uuid=(testRoom) from=(ASSET#testImport) />
            </Asset>
        `)
        const draft = base._clone()
        const ref = addImportToDraft(draft, { fromAsset: 'ASSET#testImport', uuid: 'ROOM#testRoom', tag: 'Room' })
        const descriptor = getTopLevelAddToReferenceList(draft)
        if (ref) descriptor.setReferenceList(descriptor.referenceList.assureItem(ref))
        const diff = base.diff(draft)
        expect(schemaToWML([diff.schema])).toEqual('<Asset uuid=(testAsset) />')
    })

    it('should add new component with from when not present', () => {
        const base = new StandardForm(`
            <Asset uuid=(testAsset)>
                <Room uuid=(testRoom) key=(testRoom) from=(ASSET#testImport) />
            </Asset>
        `)
        const draft = base._clone()
        const ref = addImportToDraft(draft, { fromAsset: 'ASSET#testImport', uuid: 'ROOM#testRoomTwo', tag: 'Room' })
        const descriptor = getTopLevelAddToReferenceList(draft)
        if (ref) descriptor.setReferenceList(descriptor.referenceList.assureItem(ref))
        const diff = base.diff(draft)
        expect(diff).toBeDefined()
        if (diff) {
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset uuid=(testAsset)>
                    <Room uuid=(testRoomTwo) from=(ASSET#testImport) />
                </Asset>
            `))
        }
    })

    // TODO: When StandardComponent.diff() is refactored to represent a changed `from` (incoming wins)
    // instead of throwing, update this test to assert via base.diff(draft) like the other tests,
    // and remove this comment. Deferred technical debt.
    it('should update existing component from when changing import source', () => {
        const base = new StandardForm(`
            <Asset uuid=(testAsset)>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) from=(ASSET#testImport) />
            </Asset>
        `)
        const draft = base._clone()
        addImportToDraft(draft, { fromAsset: 'ASSET#testImportTwo', uuid: 'ROOM#testRoomTwo', tag: 'Room' })
        const updated = draft.byUniversalId['ROOM#testRoomTwo']
        expect(updated).toBeDefined()
        expect(updated?.toJSON()).toMatchObject({ universalKey: 'ROOM#testRoomTwo', from: 'ASSET#testImportTwo' })
    })

    it('returns the reference of the added or updated component', () => {
        const base = new StandardForm(`
            <Asset uuid=(testAsset)>
                <Room uuid=(testRoom) key=(testRoom) from=(ASSET#testImport) />
            </Asset>
        `)
        const draft = base._clone()
        const ref = addImportToDraft(draft, { fromAsset: 'ASSET#testImport', uuid: 'ROOM#testRoomTwo', tag: 'Room' })
        expect(ref).toBeDefined()
        expect(ref?.universalKey).toBe('ROOM#testRoomTwo')
    })

    it('should throw when tag yields no component from factory', () => {
        const base = new StandardForm(`<Asset uuid=(test) />`)
        const draft = base._clone()
        expect(() => {
            addImportToDraft(draft, { fromAsset: 'ASSET#x', uuid: 'ROOM#y', tag: 'InvalidTag' as 'Room' })
        }).toThrow('Could not create component for tag')
    })
})
