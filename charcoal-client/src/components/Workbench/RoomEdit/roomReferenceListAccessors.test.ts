import { describe, expect, it } from 'vitest'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'

import {
    roomFeaturesListAccessor,
    roomGuidanceListAccessor
} from './roomReferenceListAccessors'

const GUIDANCE_ID = 'GUIDANCE#guid1' as ComponentUUID

const roomWithLists = (): StandardRoom =>
    new StandardRoom(
        deIndentWML(`
            <Room uuid=(room1)>
                <ShortName>Test Room</ShortName>
                <Guidance uuid=(guid1) />
                <Feature uuid=(feat1) />
            </Room>
        `)
    )

const emptyRoom = (): StandardRoom =>
    new StandardRoom(
        deIndentWML(`
            <Room uuid=(room1)>
                <ShortName>Empty Room</ShortName>
            </Room>
        `)
    )

describe('roomReferenceListAccessors', () => {
    it('guidance accessor returns empty list when field is unset', () => {
        const room = emptyRoom()
        expect(roomGuidanceListAccessor.getReferenceList(room).payload.length).toBe(0)
    })

    it('features accessor returns empty list when field is unset', () => {
        const room = emptyRoom()
        expect(roomFeaturesListAccessor.getReferenceList(room).payload.length).toBe(0)
    })

    it('accessors return existing guidance and features', () => {
        const room = roomWithLists()
        expect(roomGuidanceListAccessor.getReferenceList(room).payload.length).toBe(1)
        expect(roomFeaturesListAccessor.getReferenceList(room).payload.length).toBe(1)
    })

    it('guidance setReferenceList replaces list on room payload', () => {
        const room = emptyRoom()
        const ref = new StandardReference({ universalKey: GUIDANCE_ID, tag: 'Guidance' })
        roomGuidanceListAccessor.setReferenceList(room, new ReferenceList([ref]))
        expect(roomGuidanceListAccessor.getReferenceList(room).payload.length).toBe(1)
    })

    it('assureItem via accessor adds ref without duplicating', () => {
        const room = emptyRoom()
        const ref = new StandardReference({ universalKey: GUIDANCE_ID, tag: 'Guidance' })
        const addRef = (current: ReferenceList) => current.assureItem(ref)
        roomGuidanceListAccessor.setReferenceList(
            room,
            addRef(roomGuidanceListAccessor.getReferenceList(room))
        )
        roomGuidanceListAccessor.setReferenceList(
            room,
            addRef(roomGuidanceListAccessor.getReferenceList(room))
        )
        expect(roomGuidanceListAccessor.getReferenceList(room).payload.length).toBe(1)
    })
})
