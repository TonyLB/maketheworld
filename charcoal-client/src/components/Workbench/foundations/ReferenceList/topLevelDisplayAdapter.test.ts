import { describe, expect, it } from 'vitest'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'

import { buildTopLevelDisplayItems } from './topLevelDisplayAdapter'

describe('buildTopLevelDisplayItems', () => {
    it('returns pinned row for top-level room in merged form', () => {
        const standardForm = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)><ShortName>Room One</ShortName></Room>
            </Asset>
        `))
        const pinnedList = standardForm._topLevel ?? new ReferenceList([])

        const items = buildTopLevelDisplayItems({ standardForm, pinnedList })

        expect(items).toHaveLength(1)
        expect(items[0]).toMatchObject({
            id: 'ROOM#room1',
            title: 'Room One',
            rowKind: 'pinned'
        })
    })

    it('returns display-only for import ref={0} with empty pin list', () => {
        const standardForm = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(lobby) key=(lobby) from=(ASSET#assetA) ref={0} />
            </Asset>
        `))

        const items = buildTopLevelDisplayItems({
            standardForm,
            pinnedList: new ReferenceList([])
        })

        expect(items.some((item) => item.id === 'ROOM#lobby' && item.rowKind === 'displayOnly')).toBe(
            true
        )
    })

    it('prefers pinned over displayOnly when same key appears in both', () => {
        const standardForm = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)><ShortName>Room One</ShortName></Room>
            </Asset>
        `))
        const ref = new StandardReference({
            universalKey: 'ROOM#room1',
            tag: 'Room',
            key: 'room1',
            ref: 1
        })
        const pinnedList = new ReferenceList([ref])

        const items = buildTopLevelDisplayItems({ standardForm, pinnedList })

        expect(items.filter((item) => item.id === 'ROOM#room1')).toHaveLength(1)
        expect(items.find((item) => item.id === 'ROOM#room1')?.rowKind).toBe('pinned')
    })

    it('excludes Image components from union rows', () => {
        const standardForm = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Image key=(img1) />
                <Room uuid=(room1) key=(room1)><ShortName>Room One</ShortName></Room>
            </Asset>
        `))
        const pinnedList = standardForm._topLevel ?? new ReferenceList([])

        const items = buildTopLevelDisplayItems({ standardForm, pinnedList })

        expect(items.some((item) => item.id === 'IMAGE#img1')).toBe(false)
        expect(items.some((item) => item.id === 'ROOM#room1')).toBe(true)
    })

    it('includes asset-scoped feature with explicit Parent at asset', () => {
        const standardForm = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <Feature uuid=(feat1) key=(feat1)>
                        <Parent />
                        <ShortName>Feature One</ShortName>
                    </Feature>
                </Room>
            </Asset>
        `))

        const items = buildTopLevelDisplayItems({
            standardForm,
            pinnedList: new ReferenceList([])
        })

        expect(items.some((item) => item.id === 'FEATURE#feat1' && item.rowKind === 'displayOnly')).toBe(
            true
        )
    })
})
