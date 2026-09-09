import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { streamMembershipFact } from './streamMembershipFact'

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const FROM_ROOM = 'ROOM#VORTEX' as EphemeraRoomId
const TO_ROOM = 'ROOM#TestTwo' as EphemeraRoomId

describe('streamMembershipFact', () => {
    it('calls streamEvent with Character Moved header and payload', async () => {
        const streamEvent = jest.fn().mockResolvedValue(undefined)
        const payload = {
            type: 'Character Moved' as const,
            characterId: CHARACTER_ID,
            froms: [FROM_ROOM],
            to: TO_ROOM,
            beatAnchorTime: 1_700_000_000_000,
        }

        await streamMembershipFact(payload, { streamEvent })

        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: CHARACTER_ID,
            header: { type: 'Character Moved' },
            update: payload,
        })
    })
})
