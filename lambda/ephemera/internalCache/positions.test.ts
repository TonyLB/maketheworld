jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'

import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import internalCache from './index'
import * as hydrateRoomRosterModule from './hydrateRoomRoster'

const ephemeraMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

const roomId = 'ROOM#TownSquare' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId

describe('PositionsData.getRoomRoster', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    it('hydrates roster from stored positionGraph without activeCharacters Dynamo read', async () => {
        ephemeraMock.getItem.mockImplementation(async ({ ProjectionFields }) => {
            if (ProjectionFields?.includes('positionGraph')) {
                return {
                    positionGraph: {
                        nodes: [{ tag: 'Character', universalKey: characterId }],
                    },
                }
            }
            throw new Error(`Unexpected Dynamo projection: ${ProjectionFields?.join(',')}`)
        })

        jest.spyOn(internalCache.CharacterMeta, 'get').mockResolvedValue({
            EphemeraId: characterId,
            Name: 'Alpha',
            RoomId: roomId,
            RoomStack: [],
            HomeId: 'ROOM#Home',
            assets: [],
            Color: 'blue',
            fileURL: 'https://example.com/alpha.png',
        })
        jest.spyOn(internalCache.CharacterSessions, 'get').mockResolvedValue(['sess-1'])

        await expect(internalCache.Positions.getRoomRoster(roomId)).resolves.toEqual([
            {
                EphemeraId: characterId,
                DisplayName: 'Alpha',
                SessionIds: ['sess-1'],
                Color: 'blue',
                fileURL: 'https://example.com/alpha.png',
            },
        ])

        expect(ephemeraMock.getItem).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.getItem).toHaveBeenCalledWith(
            expect.objectContaining({
                ProjectionFields: ['positionGraph'],
            })
        )
    })

    it('delegates hydrate to hydrateRoomRosterFromCharacterIds for memo-patched graphs', async () => {
        const hydrateSpy = jest.spyOn(hydrateRoomRosterModule, 'hydrateRoomRosterFromCharacterIds')
            .mockResolvedValue([{
                EphemeraId: characterId,
                DisplayName: 'Alpha',
                SessionIds: ['sess-1'],
            }])

        internalCache.Positions.set({
            componentId: roomId,
            graph: {
                nodes: [{ tag: 'Character', universalKey: characterId }],
                edges: [],
            },
        })

        await expect(internalCache.Positions.getRoomRoster(roomId)).resolves.toEqual([{
            EphemeraId: characterId,
            DisplayName: 'Alpha',
            SessionIds: ['sess-1'],
        }])

        expect(hydrateSpy).toHaveBeenCalledWith([characterId])
        expect(ephemeraMock.getItem).not.toHaveBeenCalled()

        hydrateSpy.mockRestore()
    })

    it('returns empty roster when stored positionGraph is absent', async () => {
        ephemeraMock.getItem.mockImplementation(async ({ ProjectionFields }) => {
            if (ProjectionFields?.includes('positionGraph')) {
                return {}
            }
            throw new Error(`Unexpected Dynamo projection: ${ProjectionFields?.join(',')}`)
        })

        await expect(internalCache.Positions.getRoomRoster(roomId)).resolves.toEqual([])
        expect(ephemeraMock.getItem).toHaveBeenCalledTimes(1)
    })
})
