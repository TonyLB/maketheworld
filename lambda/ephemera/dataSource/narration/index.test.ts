jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import * as handleModule from './handleCharacterSpoke'
import { isCharacterSpokePublishedPayload } from '../actions/publishedEvents'
import { ephemeraNarrationDataSource } from './index'
import {
    CHARACTER_SPOKE_HEADER_TYPE,
    EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
    isNarrationSubscribedEnvelope,
} from './subscribedEvents'

describe('mtw.ephemera.narration DataSource', () => {
    it('is bus-only with Character Spoke subscription guard', () => {
        expect(ephemeraNarrationDataSource.dataSourceKey).toBe('mtw.ephemera.narration')
        expect(ephemeraNarrationDataSource.replayable).toBe(false)
        expect(ephemeraNarrationDataSource.publisherStrategy).toBe('busOnly')
        expect(ephemeraNarrationDataSource.subscribedEventTypeGuard).toBe(isNarrationSubscribedEnvelope)
        expect(typeof ephemeraNarrationDataSource.receiveEvents).toBe('function')
    })

    it('receiveEvents routes Character Spoke to handleCharacterSpoke', async () => {
        const spy = jest.spyOn(handleModule, 'handleCharacterSpoke').mockResolvedValue(undefined)
        const payload = {
            type: 'Character Spoke' as const,
            characterId: 'CHARACTER#123' as EphemeraCharacterId,
            message: 'Hello',
            displayProtocol: 'SayMessage' as const,
        }
        expect(isCharacterSpokePublishedPayload(payload)).toBe(true)

        await ephemeraNarrationDataSource.receiveEvents!({
            events: [
                {
                    header: {
                        dataSourceKey: EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
                        streamKey: 'CHARACTER#123',
                        timestamp: 1,
                        type: CHARACTER_SPOKE_HEADER_TYPE,
                    },
                    getContent: async () => payload,
                },
            ],
            streamEvent: jest.fn(),
            streamEnvelope: jest.fn(),
        })

        expect(spy).toHaveBeenCalledWith(expect.anything(), payload)
        spy.mockRestore()
    })

    it('receiveEvents skips invalid Character Spoke payloads', async () => {
        const spy = jest.spyOn(handleModule, 'handleCharacterSpoke').mockResolvedValue(undefined)

        await ephemeraNarrationDataSource.receiveEvents!({
            events: [
                {
                    header: {
                        dataSourceKey: EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
                        streamKey: 'CHARACTER#123',
                        timestamp: 1,
                        type: CHARACTER_SPOKE_HEADER_TYPE,
                    },
                    getContent: async () => ({
                        type: 'Character Spoke' as const,
                        characterId: 'CHARACTER#123' as EphemeraCharacterId,
                        message: '   ',
                        displayProtocol: 'SayMessage' as const,
                    }),
                },
            ],
            streamEvent: jest.fn(),
            streamEnvelope: jest.fn(),
        })

        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
    })
})
