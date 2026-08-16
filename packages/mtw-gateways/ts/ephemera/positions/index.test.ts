import type { EphemeraAreaId, EphemeraCharacterId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    projectComponentGraphFromStoredLudicGraph,
    extractCharacterIdsFromPlayLudicGraph,
    extractObjectIdsFromPlayLudicGraph,
} from './project'
import { createPositionsCacheHandler } from './factory'
import type { EphemeraPositionsReadDB } from './fetch'
import { queryMembershipContainersFromDynamo } from './adjacency'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import {
    getRoomLudicGraphFromDynamo,
    getCharacterLudicGraphFromDynamo,
    getObjectLudicGraphFromDynamo,
    getFeatureLudicGraphFromDynamo,
    getAreaLudicGraphFromDynamo,
} from '.'

const roomId = 'ROOM#Test' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId
const characterHostId = 'CHARACTER#Beta' as EphemeraCharacterId
const objectId = 'OBJECT#Skates' as EphemeraObjectId
const objectHostId = 'OBJECT#Tray' as EphemeraObjectId
const featureHostId = 'FEATURE#Sign' as EphemeraFeatureId
const areaHostId = 'AREA#Overworld' as EphemeraAreaId

const emptyGraph = projectComponentGraphFromStoredLudicGraph({ nodes: [], edges: [] })

describe('positions project', () => {
    it('extractCharacterIdsFromPlayLudicGraph walks character nodes', () => {
        expect(extractCharacterIdsFromPlayLudicGraph({
            nodes: [{ tag: 'Character', universalKey: characterId }],
            edges: [],
        })).toEqual([characterId])
    })

    it('extractObjectIdsFromPlayLudicGraph walks object nodes', () => {
        expect(extractObjectIdsFromPlayLudicGraph({
            nodes: [{ tag: 'Object', universalKey: objectId }],
            edges: [],
        })).toEqual([objectId])
    })

    it('projectComponentGraphFromStoredLudicGraph maps stored nodes to topology only', () => {
        const graph = projectComponentGraphFromStoredLudicGraph({
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

    it('projectComponentGraphFromStoredLudicGraph includes Object nodes', () => {
        const graph = projectComponentGraphFromStoredLudicGraph({
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

    it('projectComponentGraphFromStoredLudicGraph passes through relational edges', () => {
        const graph = projectComponentGraphFromStoredLudicGraph({
            nodes: [
                { tag: 'Object', universalKey: objectId },
                { tag: 'Object', universalKey: 'OBJECT#Table' },
            ],
            edges: [{
                tag: 'Relational',
                from: objectId,
                to: 'OBJECT#Table',
                kind: 'On',
            }],
        })
        expect(graph.nodes).toEqual([
            { tag: 'Object', universalKey: objectId },
            { tag: 'Object', universalKey: 'OBJECT#Table' },
        ])
        expect(graph.edges).toEqual([{
            tag: 'Relational',
            from: objectId,
            to: 'OBJECT#Table',
            kind: 'On',
        }])
    })

    it('projectComponentGraphFromStoredLudicGraph returns empty graph for absent nodes', () => {
        expect(projectComponentGraphFromStoredLudicGraph({ nodes: [], edges: [] })).toEqual({
            nodes: [],
            edges: [],
        })
    })
})

describe('PositionsCacheHandler', () => {
    it('loads room graph topology from stored ludicGraph', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn().mockImplementation(async ({ Key, ProjectionFields }) => {
                if (Key.DataCategory === 'Meta::Room' && ProjectionFields?.includes('ludicGraph')) {
                    return {
                        ludicGraph: {
                            nodes: [{ tag: 'Character', universalKey: characterId }],
                        },
                    }
                }
                throw new Error(`Unexpected Dynamo get: ${Key.DataCategory}`)
            }),
        }
        const handler = createPositionsCacheHandler(db)

        const graph = await handler.getLudicGraph(roomId)

        expect(graph).toEqual(projectComponentGraphFromStoredLudicGraph({
            nodes: [{ tag: 'Character', universalKey: characterId }],
        }))
        expect(db.getItem).toHaveBeenCalledTimes(1)
    })

    it('returns empty graph when stored room ludicGraph is absent', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn().mockImplementation(async ({ Key, ProjectionFields }) => {
                if (Key.DataCategory === 'Meta::Room' && ProjectionFields?.includes('ludicGraph')) {
                    return {}
                }
                throw new Error(`Unexpected Dynamo get: ${Key.DataCategory}`)
            }),
        }
        const handler = createPositionsCacheHandler(db)

        const graph = await handler.getLudicGraph(roomId)

        expect(graph).toEqual(emptyGraph)
        expect(db.getItem).toHaveBeenCalledTimes(1)
    })

    it('loads character inventory graph from Meta::Character.ludicGraph', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn().mockImplementation(async ({ Key, ProjectionFields }) => {
                if (Key.DataCategory === 'Meta::Character' && ProjectionFields?.includes('ludicGraph')) {
                    return {
                        ludicGraph: {
                            nodes: [{ tag: 'Object', universalKey: objectId }],
                        },
                    }
                }
                throw new Error(`Unexpected Dynamo get: ${Key.DataCategory}`)
            }),
        }
        const handler = createPositionsCacheHandler(db)

        const graph = await handler.getLudicGraph(characterId)

        expect(graph).toEqual(projectComponentGraphFromStoredLudicGraph({
            nodes: [{ tag: 'Object', universalKey: objectId }],
        }))
        expect(db.getItem).toHaveBeenCalledWith(
            expect.objectContaining({
                Key: { EphemeraId: characterId, DataCategory: 'Meta::Character' },
                ProjectionFields: ['ludicGraph'],
            })
        )
    })

    it('returns empty graph when stored character ludicGraph is absent', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn().mockImplementation(async ({ Key, ProjectionFields }) => {
                if (Key.DataCategory === 'Meta::Character' && ProjectionFields?.includes('ludicGraph')) {
                    return {}
                }
                throw new Error(`Unexpected Dynamo get: ${Key.DataCategory}`)
            }),
        }
        const handler = createPositionsCacheHandler(db)

        const graph = await handler.getLudicGraph(characterId)

        expect(graph).toEqual(emptyGraph)
        expect(db.getItem).toHaveBeenCalledTimes(1)
    })

    it('loads object-hosted graph from Meta::Object.ludicGraph (MK2)', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn().mockImplementation(async ({ Key, ProjectionFields }) => {
                if (Key.DataCategory === 'Meta::Object' && ProjectionFields?.includes('ludicGraph')) {
                    return {
                        ludicGraph: {
                            nodes: [{ tag: 'Character', universalKey: characterId }],
                        },
                    }
                }
                throw new Error(`Unexpected Dynamo get: ${Key.DataCategory}`)
            }),
        }
        const handler = createPositionsCacheHandler(db)

        const graph = await handler.getLudicGraph(objectHostId)

        expect(graph).toEqual(projectComponentGraphFromStoredLudicGraph({
            nodes: [{ tag: 'Character', universalKey: characterId }],
        }))
        expect(db.getItem).toHaveBeenCalledWith(
            expect.objectContaining({
                Key: { EphemeraId: objectHostId, DataCategory: 'Meta::Object' },
                ProjectionFields: ['ludicGraph'],
            })
        )
    })

    it('returns empty graph when stored object ludicGraph is absent', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn().mockImplementation(async ({ Key, ProjectionFields }) => {
                if (Key.DataCategory === 'Meta::Object' && ProjectionFields?.includes('ludicGraph')) {
                    return {}
                }
                throw new Error(`Unexpected Dynamo get: ${Key.DataCategory}`)
            }),
        }
        const handler = createPositionsCacheHandler(db)

        const graph = await handler.getLudicGraph(objectHostId)

        expect(graph).toEqual(emptyGraph)
        expect(db.getItem).toHaveBeenCalledTimes(1)
    })

    it('loads feature-hosted graph from Meta::Feature.ludicGraph (MK3)', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn().mockImplementation(async ({ Key, ProjectionFields }) => {
                if (Key.DataCategory === 'Meta::Feature' && ProjectionFields?.includes('ludicGraph')) {
                    return {
                        ludicGraph: {
                            nodes: [{ tag: 'Character', universalKey: characterId }],
                        },
                    }
                }
                throw new Error(`Unexpected Dynamo get: ${Key.DataCategory}`)
            }),
        }
        const handler = createPositionsCacheHandler(db)

        const graph = await handler.getLudicGraph(featureHostId)

        expect(graph).toEqual(projectComponentGraphFromStoredLudicGraph({
            nodes: [{ tag: 'Character', universalKey: characterId }],
        }))
        expect(db.getItem).toHaveBeenCalledWith(
            expect.objectContaining({
                Key: { EphemeraId: featureHostId, DataCategory: 'Meta::Feature' },
                ProjectionFields: ['ludicGraph'],
            })
        )
    })

    it('returns empty graph when stored feature ludicGraph is absent', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn().mockImplementation(async ({ Key, ProjectionFields }) => {
                if (Key.DataCategory === 'Meta::Feature' && ProjectionFields?.includes('ludicGraph')) {
                    return {}
                }
                throw new Error(`Unexpected Dynamo get: ${Key.DataCategory}`)
            }),
        }
        const handler = createPositionsCacheHandler(db)

        const graph = await handler.getLudicGraph(featureHostId)

        expect(graph).toEqual(emptyGraph)
        expect(db.getItem).toHaveBeenCalledTimes(1)
    })

    it('loads area-hosted graph from Meta::Area.ludicGraph (MK4)', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn().mockImplementation(async ({ Key, ProjectionFields }) => {
                if (Key.DataCategory === 'Meta::Area' && ProjectionFields?.includes('ludicGraph')) {
                    return {
                        ludicGraph: {
                            nodes: [{ tag: 'Character', universalKey: characterId }],
                        },
                    }
                }
                throw new Error(`Unexpected Dynamo get: ${Key.DataCategory}`)
            }),
        }
        const handler = createPositionsCacheHandler(db)

        const graph = await handler.getLudicGraph(areaHostId)

        expect(graph).toEqual(projectComponentGraphFromStoredLudicGraph({
            nodes: [{ tag: 'Character', universalKey: characterId }],
        }))
        expect(db.getItem).toHaveBeenCalledWith(
            expect.objectContaining({
                Key: { EphemeraId: areaHostId, DataCategory: 'Meta::Area' },
                ProjectionFields: ['ludicGraph'],
            })
        )
    })

    it('returns empty graph when stored area ludicGraph is absent', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn().mockImplementation(async ({ Key, ProjectionFields }) => {
                if (Key.DataCategory === 'Meta::Area' && ProjectionFields?.includes('ludicGraph')) {
                    return {}
                }
                throw new Error(`Unexpected Dynamo get: ${Key.DataCategory}`)
            }),
        }
        const handler = createPositionsCacheHandler(db)

        const graph = await handler.getLudicGraph(areaHostId)

        expect(graph).toEqual(emptyGraph)
        expect(db.getItem).toHaveBeenCalledTimes(1)
    })

    it('loads membership containers for OBJECT# from room adjacency on miss', async () => {
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

    it('loads membership containers for OBJECT# from character host adjacency', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn(),
            query: jest.fn().mockResolvedValue([{
                EphemeraId: objectId,
                DataCategory: buildPositionAdjacencyDataCategory(characterHostId),
            }]),
        }
        const handler = createPositionsCacheHandler(db)

        await expect(handler.getMembershipContainers(objectId)).resolves.toEqual([characterHostId])
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
        const graph = projectComponentGraphFromStoredLudicGraph({
            nodes: [{ tag: 'Character', universalKey: characterId }],
        })

        handler.set({ componentId: roomId, graph })
        await expect(handler.getLudicGraph(roomId)).resolves.toEqual(graph)
        expect(db.getItem).not.toHaveBeenCalled()

        handler.invalidate(roomId)
        await handler.getLudicGraph(roomId)
        expect(getItem).toHaveBeenCalledWith(
            expect.objectContaining({
                ProjectionFields: ['ludicGraph'],
            })
        )
    })

    it('memo set patches character forward graph without Dynamo write', async () => {
        const getItem = jest.fn().mockResolvedValue({})
        const db: EphemeraPositionsReadDB = { getItem }
        const handler = createPositionsCacheHandler(db)
        const graph = projectComponentGraphFromStoredLudicGraph({
            nodes: [{ tag: 'Object', universalKey: objectId }],
        })

        handler.set({ componentId: characterId, graph })
        await expect(handler.getLudicGraph(characterId)).resolves.toEqual(graph)
        expect(db.getItem).not.toHaveBeenCalled()
    })

    it('memo set and invalidate patch object-hosted forward graph without Dynamo write (MK2)', async () => {
        const getItem = jest.fn().mockResolvedValue({})
        const db: EphemeraPositionsReadDB = { getItem }
        const handler = createPositionsCacheHandler(db)
        const graph = projectComponentGraphFromStoredLudicGraph({
            nodes: [{ tag: 'Character', universalKey: characterId }],
        })

        handler.set({ componentId: objectHostId, graph })
        await expect(handler.getLudicGraph(objectHostId)).resolves.toEqual(graph)
        expect(db.getItem).not.toHaveBeenCalled()

        handler.invalidate(objectHostId)
        await handler.getLudicGraph(objectHostId)
        expect(getItem).toHaveBeenCalledWith(
            expect.objectContaining({
                Key: { EphemeraId: objectHostId, DataCategory: 'Meta::Object' },
                ProjectionFields: ['ludicGraph'],
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

    it('parses character host from adjacency rows', async () => {
        const db = {
            query: jest.fn().mockResolvedValue([
                {
                    EphemeraId: objectId,
                    DataCategory: buildPositionAdjacencyDataCategory(characterHostId),
                },
            ]),
        }

        await expect(queryMembershipContainersFromDynamo(db, objectId)).resolves.toEqual([characterHostId])
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

describe('get*LudicGraphFromDynamo exports on the package entrypoint (MK5)', () => {
    it('re-exports get*LudicGraphFromDynamo for all five host kinds from `.`, not just `./fetch`', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn().mockResolvedValue({ ludicGraph: { nodes: [], edges: [] } }),
        }

        await expect(getRoomLudicGraphFromDynamo(db, roomId)).resolves.toEqual({ nodes: [], edges: [] })
        await expect(getCharacterLudicGraphFromDynamo(db, characterHostId)).resolves.toEqual({ nodes: [], edges: [] })
        await expect(getObjectLudicGraphFromDynamo(db, objectHostId)).resolves.toEqual({ nodes: [], edges: [] })
        await expect(getFeatureLudicGraphFromDynamo(db, featureHostId)).resolves.toEqual({ nodes: [], edges: [] })
        await expect(getAreaLudicGraphFromDynamo(db, areaHostId)).resolves.toEqual({ nodes: [], edges: [] })
    })
})
