import { describe, expect, it } from 'vitest'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'

import { materializeComponent } from './materializeComponent'

describe('materializeComponent', () => {
    it('creates a new component on an empty draft', () => {
        const draft = new StandardForm(`<Asset uuid=(test) />`)
        const ref = materializeComponent(draft, { universalKey: 'ROOM#newRoom' as ComponentUUID })

        expect(ref.universalKey).toBe('ROOM#newRoom')
        expect(ref.tag).toBe('Room')
        const component = draft.byUniversalId['ROOM#newRoom']
        expect(component).toBeDefined()
        expect(component instanceof StandardRoom).toBe(true)
    })

    it('is idempotent when the component already exists', () => {
        const base = new StandardForm(`
            <Asset uuid=(test)>
                <Room uuid=(existing) key=(existing) />
            </Asset>
        `)
        const draft = base._clone()
        const first = materializeComponent(draft, { universalKey: 'ROOM#existing' as ComponentUUID })
        const beforeJson = draft.byUniversalId['ROOM#existing']?.toJSON()
        const second = materializeComponent(draft, { universalKey: 'ROOM#existing' as ComponentUUID })

        expect(second.sameKey(first)).toBe(true)
        expect(draft.byUniversalId['ROOM#existing']?.toJSON()).toEqual(beforeJson)
    })

    it('imports a new Area with from when fromAsset is set', () => {
        const draft = new StandardForm(`<Asset uuid=(test) />`)
        const ref = materializeComponent(draft, {
            universalKey: 'AREA#WORLD' as ComponentUUID,
            fromAsset: 'ASSET#primitives'
        })

        const component = draft.byUniversalId['AREA#WORLD']
        expect(component).toBeDefined()
        expect(component instanceof StandardArea).toBe(true)
        expect(component?.toJSON()).toMatchObject({
            universalKey: 'AREA#WORLD',
            from: 'ASSET#primitives'
        })
        expect(ref.tag).toBe('Area')
        expect(ref.universalKey).toBe('AREA#WORLD')
    })

    it('updates from on an existing import without passing tag', () => {
        const base = new StandardForm(`
            <Asset uuid=(test)>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) from=(ASSET#testImport) />
            </Asset>
        `)
        const draft = base._clone()
        materializeComponent(draft, {
            universalKey: 'ROOM#testRoomTwo' as ComponentUUID,
            fromAsset: 'ASSET#testImportTwo'
        })
        const updated = draft.byUniversalId['ROOM#testRoomTwo']
        expect(updated?.toJSON()).toMatchObject({
            universalKey: 'ROOM#testRoomTwo',
            from: 'ASSET#testImportTwo'
        })
    })

    it('throws when importing an unsupported component type', () => {
        const draft = new StandardForm(`<Asset uuid=(test) />`)
        expect(() =>
            materializeComponent(draft, {
                universalKey: 'CHARACTER#hero' as ComponentUUID,
                fromAsset: 'ASSET#other'
            })
        ).toThrow('Cannot import component type Character')
        expect(draft.byUniversalId['CHARACTER#hero']).toBeUndefined()
    })
})
