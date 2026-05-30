import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'

import { detectTopologyInvalidations } from './topologyDiff'

describe('detectTopologyInvalidations', () => {
    it('emits room-scoped invalidation for Area with positionGraph edges', () => {
        const form = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Area uuid=(region) key=(region)>
                    <Room uuid=(highway) key=(highway) />
                    <Exit uuid=(e1)>
                        <From>ROOM#highway</From>
                        <To>ROOM#outsideRoom</To>
                    </Exit>
                </Area>
                <Room uuid=(outsideRoom) key=(outsideRoom) />
            </Asset>
        `))
        const area = form.byUniversalId['AREA#region'] as StandardArea
        const drafts = detectTopologyInvalidations({ component: area, entityRemoved: false })
        expect(drafts).toEqual([
            {
                scope: 'room',
                roomIds: ['ROOM#highway', 'ROOM#outsideRoom'],
                areaId: 'AREA#region',
            },
        ])
    })

    it('emits room-scoped invalidation when Room has exit facets (D6 dual-read)', () => {
        const form = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(lobby) key=(lobby)>
                    <Exit to=(hall)>north</Exit>
                </Room>
            </Asset>
        `))
        const room = form.byUniversalId['ROOM#lobby'] as StandardRoom
        const drafts = detectTopologyInvalidations({ component: room, entityRemoved: false })
        expect(drafts).toEqual([{ scope: 'room', roomIds: ['ROOM#lobby'] }])
    })
})
