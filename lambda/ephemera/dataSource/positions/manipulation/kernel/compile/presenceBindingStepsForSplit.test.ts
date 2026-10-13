import type { EphemeraObjectId, EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { presenceBindingStepsForSplit } from './presenceBindingStepsForSplit'

const presence = (name: string) => `PRESENCE#${name}` as EphemeraPresenceNodeId

describe('presenceBindingStepsForSplit', () => {
    it('emits the producer\'s split as one step, carrying its minted ids and covers verbatim', () => {
        const splitInto = [
            { presence: presence('B'), cover: { members: [{ tag: 'Remainder' as const }] } },
            { presence: presence('B2'), cover: { members: [{ host: 'OBJECT#Cup' as EphemeraObjectId, presence: presence('cup') }] } },
        ]

        expect(presenceBindingStepsForSplit({ kind: 'split', whole: 'OBJECT#Plank' as EphemeraObjectId, presence: presence('B'), splitInto })).toEqual([{
            kind: 'splitPresenceBinding',
            hostId: 'OBJECT#Plank',
            presence: presence('B'),
            splitInto,
        }])
    })
})
