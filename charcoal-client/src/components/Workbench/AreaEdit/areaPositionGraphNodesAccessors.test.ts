import { describe, expect, it } from 'vitest'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'

import { areaPositionGraphNodesTagAccessor } from './areaPositionGraphNodesAccessors'

const areaWml = deIndentWML(`
    <Asset uuid=(test)>
        <Area uuid=(AREA#a1)>
            <Room uuid=(ROOM#r1) />
            <Feature uuid=(FEATURE#f1) />
            <Room uuid=(ROOM#r2) />
        </Area>
    </Asset>
`)

describe('areaPositionGraphNodesTagAccessor', () => {
    it('getReferenceList returns tag slice only', () => {
        const form = new StandardForm(areaWml)
        const area = form.byUniversalId['AREA#a1']
        if (!(area instanceof StandardArea)) {
            throw new Error('Expected StandardArea')
        }
        const accessor = areaPositionGraphNodesTagAccessor('Room')
        const slice = accessor.getReferenceList(area)
        expect(slice.payload.every((ref) => ref.tag === 'Room')).toBe(true)
        expect(slice.payload.length).toBe(2)
    })

    it('setReferenceList merges slice into full nodes', () => {
        const form = new StandardForm(areaWml)
        const area = form.byUniversalId['AREA#a1']
        if (!(area instanceof StandardArea)) {
            throw new Error('Expected StandardArea')
        }
        const accessor = areaPositionGraphNodesTagAccessor('Room')
        const newRoomSlice = new ReferenceList([
            new StandardReference({ universalKey: 'ROOM#r3' as ComponentUUID, tag: 'Room' })
        ])
        accessor.setReferenceList(area, newRoomSlice)
        const rooms = accessor.getReferenceList(area)
        expect(rooms.payload.length).toBe(1)
        expect(rooms.payload[0].universalKey).toBe('ROOM#r3')
        const features = areaPositionGraphNodesTagAccessor('Feature').getReferenceList(area)
        expect(features.payload.length).toBe(1)
        expect(features.payload[0].universalKey).toBe('FEATURE#f1')
    })
})
