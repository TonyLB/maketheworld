import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    projectRoomGraphFromActiveCharacters,
    projectRoomRosterFromGraph,
    projectCharacterGraphFromRoomEndpoint,
    projectRoomGraphFromRosterEntries,
} from './project'
import { createPositionsCacheHandler } from './factory'
import type { EphemeraPositionsReadDB } from './fetch'

const roomId = 'ROOM#Test' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId

describe('positions project', () => {
    it('projectRoomGraphFromActiveCharacters maps roster metadata', () => {
        const graph = projectRoomGraphFromActiveCharacters([
            {
                EphemeraId: characterId,
                DisplayName: 'Alpha',
                SessionIds: ['sess-1'],
            },
        ])

        expect(graph.nodes).toHaveLength(1)
        expect(graph.characterRosterMeta?.[characterId]).toEqual({
            EphemeraId: characterId,
            DisplayName: 'Alpha',
            SessionIds: ['sess-1'],
        })
        expect(projectRoomRosterFromGraph(graph)).toEqual([{
            EphemeraId: characterId,
            DisplayName: 'Alpha',
            SessionIds: ['sess-1'],
        }])
    })

    it('projectCharacterGraphFromRoomEndpoint encodes room endpoint', () => {
        const graph = projectCharacterGraphFromRoomEndpoint(characterId, roomId)
        expect(graph.roomEndpoint).toBe(roomId)
        expect(graph.nodes).toHaveLength(1)
    })

    it('projectRoomGraphFromRosterEntries round-trips roster entries', () => {
        const roster = [{
            EphemeraId: characterId,
            DisplayName: 'Alpha',
            SessionIds: ['sess-1'],
        }]
        const graph = projectRoomGraphFromRosterEntries(roster)
        expect(projectRoomRosterFromGraph(graph)).toEqual(roster)
    })
})

describe('PositionsCacheHandler', () => {
    it('loads room graph from Dynamo on miss', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn().mockResolvedValue({
                activeCharacters: [{
                    EphemeraId: characterId,
                    DisplayName: 'Alpha',
                    SessionIds: ['sess-1'],
                }],
            }),
        }
        const handler = createPositionsCacheHandler(db)

        const graph = await handler.getPositionGraph(roomId)
        const roster = await handler.getRoomRoster(roomId)

        expect(db.getItem).toHaveBeenCalledWith({
            Key: { EphemeraId: roomId, DataCategory: 'Meta::Room' },
            ProjectionFields: ['activeCharacters'],
        })
        expect(graph).toEqual(projectRoomGraphFromActiveCharacters([{
            EphemeraId: characterId,
            DisplayName: 'Alpha',
            SessionIds: ['sess-1'],
        }]))
        expect(roster).toEqual([{
            EphemeraId: characterId,
            DisplayName: 'Alpha',
            SessionIds: ['sess-1'],
        }])
    })

    it('memo set and invalidate patch in-memory graph without Dynamo write', async () => {
        const getItem = jest.fn().mockResolvedValue({ activeCharacters: [] })
        const db: EphemeraPositionsReadDB = { getItem }
        const handler = createPositionsCacheHandler(db)
        const graph = projectRoomGraphFromRosterEntries([{
            EphemeraId: characterId,
            DisplayName: 'Alpha',
            SessionIds: ['sess-1'],
        }])

        handler.set({ componentId: roomId, graph })
        await expect(handler.getPositionGraph(roomId)).resolves.toEqual(graph)
        expect(db.getItem).not.toHaveBeenCalled()

        handler.invalidate(roomId)
        await expect(handler.getRoomRoster(roomId)).resolves.toEqual([])
        expect(getItem).toHaveBeenCalled()
    })
})
