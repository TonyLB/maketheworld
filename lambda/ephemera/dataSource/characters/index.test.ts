jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import * as handleModule from './handleCharacterMoved'
import * as inPlayModule from './publishCharacterInPlay'
import { ephemeraCharactersDataSource } from './index'
import type { StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import {
    CHARACTER_MOVED_HEADER_TYPE,
    EPHEMERA_POSITIONS_DATA_SOURCE_KEY,
    isCharactersSubscribedEnvelope,
    type CharactersSubscribedContent,
} from './subscribedEvents'

const payload = {
    type: 'Character Moved' as const,
    characterId: 'CHARACTER#123' as EphemeraCharacterId,
    froms: ['ROOM#VORTEX' as EphemeraRoomId],
    to: 'ROOM#Dockside' as EphemeraRoomId,
    beatAnchorTime: 1_700_000_000_000,
}

const envelopeFor = (type: string, content: unknown = payload) => ({
    header: {
        dataSourceKey: EPHEMERA_POSITIONS_DATA_SOURCE_KEY,
        streamKey: 'CHARACTER#123',
        timestamp: 1,
        type,
    },
    getContent: async () => content,
})

describe('mtw.ephemera.characters DataSource', () => {
    it('is bus-only with a Character Moved subscription guard', () => {
        expect(ephemeraCharactersDataSource.dataSourceKey).toBe('mtw.ephemera.characters')
        expect(ephemeraCharactersDataSource.replayable).toBe(false)
        expect(ephemeraCharactersDataSource.publisherStrategy).toBe('busOnly')
        expect(ephemeraCharactersDataSource.subscribedEventTypeGuard).toBe(isCharactersSubscribedEnvelope)
    })

    it('guard accepts positions Character Moved and rejects Object Moved', () => {
        expect(isCharactersSubscribedEnvelope(envelopeFor(CHARACTER_MOVED_HEADER_TYPE))).toBe(true)
        expect(isCharactersSubscribedEnvelope(envelopeFor('Object Moved'))).toBe(false)
    })

    it('receiveEvents routes Character Moved to handleCharacterMoved and publishCharacterInPlay', async () => {
        const spy = jest.spyOn(handleModule, 'handleCharacterMoved').mockResolvedValue(undefined)
        const inPlaySpy = jest.spyOn(inPlayModule, 'publishCharacterInPlay').mockResolvedValue(undefined)

        await ephemeraCharactersDataSource.receiveEvents!({
            events: [envelopeFor(CHARACTER_MOVED_HEADER_TYPE) as StreamingEventEnvelope<CharactersSubscribedContent>],
            streamEvent: jest.fn(),
            streamEnvelope: jest.fn(),
        })

        expect(spy).toHaveBeenCalledWith(payload)
        expect(inPlaySpy).toHaveBeenCalledWith(payload)
        spy.mockRestore()
        inPlaySpy.mockRestore()
    })

    it('receiveEvents skips payloads that are not Character Moved', async () => {
        const spy = jest.spyOn(handleModule, 'handleCharacterMoved').mockResolvedValue(undefined)
        const inPlaySpy = jest.spyOn(inPlayModule, 'publishCharacterInPlay').mockResolvedValue(undefined)

        await ephemeraCharactersDataSource.receiveEvents!({
            events: [envelopeFor(CHARACTER_MOVED_HEADER_TYPE, { type: 'Character Moved', characterId: 'bogus' }) as StreamingEventEnvelope<CharactersSubscribedContent>],
            streamEvent: jest.fn(),
            streamEnvelope: jest.fn(),
        })

        expect(spy).not.toHaveBeenCalled()
        expect(inPlaySpy).not.toHaveBeenCalled()
        spy.mockRestore()
        inPlaySpy.mockRestore()
    })
})
