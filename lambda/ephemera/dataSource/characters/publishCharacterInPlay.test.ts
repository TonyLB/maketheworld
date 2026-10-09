jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        CharacterMeta: { get: jest.fn() },
        Global: { get: jest.fn() },
    },
}))
jest.mock('../../messageBus', () => ({
    __esModule: true,
    default: { publish: jest.fn() },
}))

import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CharacterMetaItem } from '../../internalCache/characterMeta'
import type { CharacterMovedPublishedPayload } from '../positions/publishedEvents'
import { publishCharacterInPlay } from './publishCharacterInPlay'

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const HOME = 'ROOM#Home' as EphemeraRoomId
const TO_ROOM = 'ROOM#Dockside' as EphemeraRoomId

const characterMeta = { EphemeraId: CHARACTER_ID, Name: 'Test', HomeId: HOME, assets: [] } as unknown as CharacterMetaItem

const fact: CharacterMovedPublishedPayload = {
    type: 'Character Moved',
    characterId: CHARACTER_ID,
    froms: [HOME],
    to: TO_ROOM,
    beatAnchorTime: 1_700_000_000_000,
}

const makeDeps = () => ({
    getCharacterMeta: jest.fn(async () => characterMeta),
    getSessionId: jest.fn(async () => 'sess1'),
    messageBus: { publish: jest.fn() },
})

describe('publishCharacterInPlay', () => {
    it('publishes CharacterInPlay in the destination room to global and the session', async () => {
        const deps = makeDeps()
        await publishCharacterInPlay(fact, deps)
        expect(deps.messageBus.publish).toHaveBeenCalledWith({
            type: 'EphemeraUpdate',
            updates: [{
                type: 'CharacterInPlay',
                CharacterId: CHARACTER_ID,
                Connected: true,
                RoomId: TO_ROOM,
                connectionTargets: ['GLOBAL', 'SESSION#sess1'],
            }],
        })
    })

    it('falls back to the home room when the character leaves play (to: null)', async () => {
        const deps = makeDeps()
        await publishCharacterInPlay({ ...fact, to: null }, deps)
        expect(deps.messageBus.publish).toHaveBeenCalledWith(expect.objectContaining({
            updates: [expect.objectContaining({ RoomId: HOME })],
        }))
    })

    it('logs and does not throw when the meta read fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
        const deps = { ...makeDeps(), getCharacterMeta: jest.fn().mockRejectedValue(new Error('boom')) }
        await expect(publishCharacterInPlay(fact, deps)).resolves.toBeUndefined()
        expect(deps.messageBus.publish).not.toHaveBeenCalled()
        consoleSpy.mockRestore()
    })
})
