import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'

import { detectTopologyInvalidations } from './topologyDiff'

describe('detectTopologyInvalidations', () => {
    it('emits room-scoped invalidation for Area with ludicGraph edges', () => {
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
})
