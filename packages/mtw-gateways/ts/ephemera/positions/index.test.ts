import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    projectRoomGraphFromStoredPositionGraph,
    projectCharacterInventoryGraphStub,
    extractCharacterIdsFromPlayPositionGraph,
    extractObjectIdsFromPlayPositionGraph,
} from './project'
import { createPositionsCacheHandler } from './factory'
import type { EphemeraPositionsReadDB } from './fetch'
import { queryMembershipContainersFromDynamo } from './adjacency'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

const roomId = 'ROOM#Test' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId
const objectId = 'OBJECT#Skates' as EphemeraObjectId

describe('positions project', () => {
    it('projectCharacterInventoryGraphStub returns empty forward graph', () => {
        expect(projectCharacterInventoryGraphStub()).toEqual({
            nodes: [],
            edges: [],
        })
    })

    it('extractCharacterIdsFromPlayPositionGraph walks character nodes', () => {
        expect(extractCharacterIdsFromPlayPositionGraph({
            nodes: [{ tag: 'Character', universalKey: characterId }],
            edges: [],
        })).toEqual([characterId])
    })

    it('extractObjectIdsFromPlayPositionGraph walks object nodes', () => {
        expect(extractObjectIdsFromPlayPositionGraph({
            nodes: [{ tag: 'Object', universalKey: objectId }],
            edges: [],
        })).toEqual([objectId])
    })

    it('projectRoomGraphFromStoredPositionGraph maps stored nodes to topology only', () => {
        const graph = projectRoomGraphFromStoredPositionGraph({
            nodes: [{ tag: 'Character', universalKey: characterId }],
        })
        expect(graph).toEqual({
            nodes: [{
                tag: 'Character',
                universalKey: characterId,
            }],
            edges: [],
        })
    })

    it('projectRoomGraphFromStoredPositionGraph includes Object nodes', () => {
        const graph = projectRoomGraphFromStoredPositionGraph({
            nodes: [
                { tag: 'Character', universalKey: characterId },
                { tag: 'Object', universalKey: objectId },
            ],
        })
        expect(graph).toEqual({
            nodes: [
                { tag: 'Character', universalKey: characterId },
                { tag: 'Object', universalKey: objectId },
            ],
            edges: [],
        })
    })

    it('projectRoomGraphFromStoredPositionGraph returns empty graph for absent nodes', () => {
        expect(projectRoomGraphFromStoredPositionGraph({ nodes: [], edges: [] })).toEqual({
            nodes: [],
            edges: [],
        })
    })
})

describe('PositionsCacheHandler', () => {
    it('loads room graph topology from stored positionGraph', async () => {
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

        expect(graph).toEqual(projectRoomGraphFromStoredPositionGraph({
            nodes: [{ tag: 'Character', universalKey: characterId }],
        }))
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
        expect(db.getItem).not.toHaveBeenCalled()
    })

    it('loads membership containers for OBJECT# from adjacency on miss', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn(),
            query: jest.fn().mockResolvedValue([{
                EphemeraId: objectId,
                DataCategory: buildPositionAdjacencyDataCategory(roomId),
            }]),
        }
        const handler = createPositionsCacheHandler(db)

        await expect(handler.getMembershipContainers(objectId)).resolves.toEqual([roomId])
        expect(db.query).toHaveBeenCalled()
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
        const graph = projectRoomGraphFromStoredPositionGraph({
            nodes: [{ tag: 'Character', universalKey: characterId }],
        })

        handler.set({ componentId: roomId, graph })
        await expect(handler.getPositionGraph(roomId)).resolves.toEqual(graph)
        expect(db.getItem).not.toHaveBeenCalled()

        handler.invalidate(roomId)
        await handler.getPositionGraph(roomId)
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
