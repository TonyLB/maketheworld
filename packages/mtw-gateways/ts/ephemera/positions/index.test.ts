import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    projectRoomGraphFromActiveCharacters,
    projectRoomGraphFromStoredPositionGraph,
    projectRoomRosterFromGraph,
    projectCharacterGraphFromRoomEndpoint,
    projectCharacterInventoryGraphStub,
    projectMembershipContainersFromRoomEndpoint,
    projectRoomGraphFromRosterEntries,
    extractCharacterIdsFromPlayPositionGraph,
} from './project'
import { createPositionsCacheHandler } from './factory'
import type { EphemeraPositionsReadDB } from './fetch'
import { queryMembershipContainersFromDynamo } from './adjacency'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

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

    it('projectCharacterInventoryGraphStub returns empty forward graph', () => {
        expect(projectCharacterInventoryGraphStub()).toEqual({
            nodes: [],
            edges: [],
        })
    })

    it('projectMembershipContainersFromRoomEndpoint maps endpoint to array', () => {
        expect(projectMembershipContainersFromRoomEndpoint(null)).toEqual([])
        expect(projectMembershipContainersFromRoomEndpoint(roomId)).toEqual([roomId])
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

    it('extractCharacterIdsFromPlayPositionGraph walks character nodes', () => {
        expect(extractCharacterIdsFromPlayPositionGraph({
            nodes: [{ tag: 'Character', universalKey: characterId }],
            edges: [],
        })).toEqual([characterId])
    })

    it('projectRoomGraphFromStoredPositionGraph maps stored nodes and merges roster meta', () => {
        const graph = projectRoomGraphFromStoredPositionGraph(
            {
                nodes: [{ tag: 'Character', universalKey: characterId }],
            },
            [{
                EphemeraId: characterId,
                DisplayName: 'Alpha',
                SessionIds: ['sess-1'],
            }]
        )
        expect(graph.nodes).toEqual([{
            tag: 'Character',
            universalKey: characterId,
        }])
        expect(projectRoomRosterFromGraph(graph)).toEqual([{
            EphemeraId: characterId,
            DisplayName: 'Alpha',
            SessionIds: ['sess-1'],
        }])
    })

    it('projectRoomGraphFromStoredPositionGraph omits roster meta when activeCharacters absent', () => {
        const graph = projectRoomGraphFromStoredPositionGraph({
            nodes: [{ tag: 'Character', universalKey: characterId }],
        })
        expect(graph.characterRosterMeta).toBeUndefined()
        expect(projectRoomRosterFromGraph(graph)).toEqual([])
    })
})

describe('PositionsCacheHandler', () => {
    it('loads room graph topology from stored positionGraph without activeCharacters merge', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn().mockImplementation(async ({ ProjectionFields }) => {
                if (ProjectionFields?.includes('positionGraph')) {
                    return {
                        positionGraph: {
                            nodes: [{ tag: 'Character', universalKey: characterId }],
                        },
                    }
                }
                throw new Error(`Unexpected Dynamo projection: ${ProjectionFields?.join(',')}`)
            }),
        }
        const handler = createPositionsCacheHandler(db)

        const graph = await handler.getPositionGraph(roomId)
        const roster = await handler.getRoomRoster(roomId)

        expect(graph).toEqual(projectRoomGraphFromStoredPositionGraph({
            nodes: [{ tag: 'Character', universalKey: characterId }],
        }))
        expect(roster).toEqual([])
        expect(db.getItem).toHaveBeenCalledTimes(1)
    })

    it('returns empty graph when stored positionGraph is absent', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn().mockImplementation(async ({ ProjectionFields }) => {
                if (ProjectionFields?.includes('positionGraph')) {
                    return {}
                }
                throw new Error(`Unexpected Dynamo projection: ${ProjectionFields?.join(',')}`)
            }),
        }
        const handler = createPositionsCacheHandler(db)

        const graph = await handler.getPositionGraph(roomId)

        expect(graph).toEqual(projectRoomGraphFromStoredPositionGraph({ nodes: [], edges: [] }))
        expect(db.getItem).toHaveBeenCalledTimes(1)
    })

    it('returns empty inventory stub for character getPositionGraph without Dynamo', async () => {
        const db: EphemeraPositionsReadDB = { getItem: jest.fn() }
        const handler = createPositionsCacheHandler(db)

        const graph = await handler.getPositionGraph(characterId)

        expect(graph).toEqual(projectCharacterInventoryGraphStub())
        expect(graph.roomEndpoint).toBeUndefined()
        expect(db.getItem).not.toHaveBeenCalled()
    })

    it('loads membership containers from adjacency on miss', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn(),
            query: jest.fn().mockResolvedValue([{
                EphemeraId: characterId,
                DataCategory: buildPositionAdjacencyDataCategory(roomId),
            }]),
        }
        const handler = createPositionsCacheHandler(db)

        await expect(handler.getMembershipContainers(characterId)).resolves.toEqual([roomId])
        expect(db.query).toHaveBeenCalled()
        expect(db.getItem).not.toHaveBeenCalled()
    })

    it('returns empty membership containers when adjacency query is empty', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn(),
            query: jest.fn().mockResolvedValue([]),
        }
        const handler = createPositionsCacheHandler(db)

        await expect(handler.getMembershipContainers(characterId)).resolves.toEqual([])
        expect(db.query).toHaveBeenCalled()
        expect(db.getItem).not.toHaveBeenCalled()
    })

    it('memo set and invalidate patch in-memory graph without Dynamo write', async () => {
        const getItem = jest.fn().mockResolvedValue({})
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
        expect(getItem).toHaveBeenCalledWith(
            expect.objectContaining({
                ProjectionFields: ['positionGraph'],
            })
        )
    })

    it('memo setMembershipContainers and invalidateMembershipContainers without Dynamo write', async () => {
        const query = jest.fn().mockResolvedValue([])
        const db: EphemeraPositionsReadDB = { getItem: jest.fn(), query }
        const handler = createPositionsCacheHandler(db)

        await handler.getMembershipContainers(characterId)
        expect(query).toHaveBeenCalledTimes(1)

        handler.setMembershipContainers({ componentId: characterId, containers: [] })
        await expect(handler.getMembershipContainers(characterId)).resolves.toEqual([])
        expect(query).toHaveBeenCalledTimes(1)

        handler.invalidateMembershipContainers(characterId)
        await handler.getMembershipContainers(characterId)
        expect(query).toHaveBeenCalledTimes(2)
    })
})

describe('queryMembershipContainersFromDynamo', () => {
    it('parses adjacency rows into host room ids', async () => {
        const roomB = 'ROOM#B' as EphemeraRoomId
        const db = {
            query: jest.fn().mockResolvedValue([
                {
                    EphemeraId: characterId,
                    DataCategory: buildPositionAdjacencyDataCategory(roomId),
                },
                {
                    EphemeraId: characterId,
                    DataCategory: buildPositionAdjacencyDataCategory(roomB),
                },
                {
                    EphemeraId: characterId,
                    DataCategory: 'POSITION#bad',
                },
            ]),
        }

        await expect(queryMembershipContainersFromDynamo(db, characterId)).resolves.toEqual([roomId, roomB])
        expect(db.query).toHaveBeenCalledWith({
            Key: { EphemeraId: characterId },
            KeyConditionExpression: 'begins_with(DataCategory, :prefix)',
            ExpressionAttributeValues: { ':prefix': 'POSITION#' },
        })
    })

    it('parses DataCategory-only rows from default ephemeraDB query projection', async () => {
        const db = {
            query: jest.fn().mockResolvedValue([
                { DataCategory: buildPositionAdjacencyDataCategory(roomId) },
            ]),
        }

        await expect(queryMembershipContainersFromDynamo(db, characterId)).resolves.toEqual([roomId])
    })
})
