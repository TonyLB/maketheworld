import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { buildObjectManipulationIdentityPrompt } from './buildPrompt'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId
const tableId = 'OBJECT#Table' as EphemeraObjectId

describe('buildObjectManipulationIdentityPrompt', () => {
    it('includes catalogScope on catalog rows', () => {
        const { dynamicSuffix } = buildObjectManipulationIdentityPrompt('pick up broom', {
            rawObjectSpan: 'broom',
            catalog: [{ objectId: broomId, normalizedShortName: 'broom', catalogScope: 'room' }],
        })
        expect(dynamicSuffix).toContain('catalogScope')
        expect(dynamicSuffix).toContain('"room"')
    })
})
