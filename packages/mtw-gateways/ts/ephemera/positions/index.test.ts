import type { EphemeraAreaId, EphemeraCharacterId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import {
    projectComponentGraphFromStoredLudicGraph,
    extractCharacterIdsFromLudicGraph,
    extractObjectIdsFromLudicGraph,
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

/**
 * An absent row's default. Kind-specific since the root node carries the host's own tag ---
 * concepts clause 3 / LP4i requires the root to be present in `nodes`.
 */
const emptyPayload = (id: string, tag: 'Room' | 'Character' | 'Object' | 'Feature' | 'Area') => ({
    rootId: id,
    nodes: [{ tag, universalKey: id }],
    edges: [],
    ports: [],
})

/**
 * A room holding one side of a crossing: a port-address edge plus, on the interior side, the port
 * record itself. `ports` is the field the memo used to drop wholesale, so every load/round-trip
 * assertion below is written against a fixture that actually has one.
 */
const storedRoomGraph: EphemeraLudicGraphFieldPayload = {
    rootId: roomId,
    nodes: [
        { tag: 'Room', universalKey: roomId },
        { tag: 'Character', universalKey: characterId },
        { tag: 'Object', universalKey: objectId },
    ],
    edges: [{
        tag: 'Relational',
        from: objectId,
        to: { owner: objectHostId, port: 'port-1' },
        kind: 'Custom',
        relationLabel: 'to',
    }],
    ports: [],
}

const storedObjectGraphWithPort: EphemeraLudicGraphFieldPayload = {
    rootId: objectHostId,
    nodes: [{ tag: 'Object', universalKey: objectHostId }],
    edges: [],
    ports: [{ portId: 'port-1', fromHostId: roomId, kind: 'Custom', exteriorRelationLabel: 'to' }],
}

describe('positions project', () => {
    it('extractCharacterIdsFromLudicGraph walks character nodes', () => {
        expect(extractCharacterIdsFromLudicGraph({
            nodes: [{ tag: 'Character', universalKey: characterId }],
            edges: [],
        })).toEqual([characterId])
    })

    it('extractObjectIdsFromLudicGraph walks object nodes', () => {
        expect(extractObjectIdsFromLudicGraph({
            nodes: [{ tag: 'Object', universalKey: objectId }],
            edges: [],
        })).toEqual([objectId])
    })

    it('projectComponentGraphFromStoredLudicGraph maps stored nodes to topology only', () => {
        const graph = projectComponentGraphFromStoredLudicGraph({
            rootId: characterId, ports: [],
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
            rootId: characterId, ports: [],
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
            rootId: objectId, ports: [],
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
        expect(projectComponentGraphFromStoredLudicGraph({ rootId: roomId, ports: [], nodes: [], edges: [] })).toEqual({
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
                    return { ludicGraph: storedRoomGraph }
                }
                throw new Error(`Unexpected Dynamo get: ${Key.DataCategory}`)
            }),
        }
        const handler = createPositionsCacheHandler(db)

        const graph = await handler.getLudicGraph(roomId)

        // Verbatim pass-through: the memo caches what Dynamo holds, including `ports`.
        expect(graph).toEqual(storedRoomGraph)
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

        expect(graph).toEqual(emptyPayload(roomId, 'Room'))
        expect(db.getItem).toHaveBeenCalledTimes(1)
    })

    it('loads character inventory graph from Meta::Character.ludicGraph', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn().mockImplementation(async ({ Key, ProjectionFields }) => {
                if (Key.DataCategory === 'Meta::Character' && ProjectionFields?.includes('ludicGraph')) {
                    return {
                        ludicGraph: {
                            rootId: characterId, ports: [],
                            nodes: [{ tag: 'Character', universalKey: characterId }, { tag: 'Object', universalKey: objectId }],
                        },
                    }
                }
                throw new Error(`Unexpected Dynamo get: ${Key.DataCategory}`)
            }),
        }
        const handler = createPositionsCacheHandler(db)

        const graph = await handler.getLudicGraph(characterId)

        expect(graph).toEqual({
            rootId: characterId, ports: [],
            nodes: [{ tag: 'Character', universalKey: characterId }, { tag: 'Object', universalKey: objectId }],
        })
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

        expect(graph).toEqual(emptyPayload(characterId, 'Character'))
        expect(db.getItem).toHaveBeenCalledTimes(1)
    })

    it('loads object-hosted graph from Meta::Object.ludicGraph (MK2)', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn().mockImplementation(async ({ Key, ProjectionFields }) => {
                if (Key.DataCategory === 'Meta::Object' && ProjectionFields?.includes('ludicGraph')) {
                    return {
                        ludicGraph: {
                            rootId: objectHostId, ports: [],
                            nodes: [{ tag: 'Object', universalKey: objectHostId }, { tag: 'Character', universalKey: characterId }],
                        },
                    }
                }
                throw new Error(`Unexpected Dynamo get: ${Key.DataCategory}`)
            }),
        }
        const handler = createPositionsCacheHandler(db)

        const graph = await handler.getLudicGraph(objectHostId)

        expect(graph).toEqual({
            rootId: objectHostId, ports: [],
            nodes: [{ tag: 'Object', universalKey: objectHostId }, { tag: 'Character', universalKey: characterId }],
        })
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

        expect(graph).toEqual(emptyPayload(objectHostId, 'Object'))
        expect(db.getItem).toHaveBeenCalledTimes(1)
    })

    it('loads feature-hosted graph from Meta::Feature.ludicGraph (MK3)', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn().mockImplementation(async ({ Key, ProjectionFields }) => {
                if (Key.DataCategory === 'Meta::Feature' && ProjectionFields?.includes('ludicGraph')) {
                    return {
                        ludicGraph: {
                            rootId: featureHostId, ports: [],
                            nodes: [{ tag: 'Feature', universalKey: featureHostId }, { tag: 'Character', universalKey: characterId }],
                        },
                    }
                }
                throw new Error(`Unexpected Dynamo get: ${Key.DataCategory}`)
            }),
        }
        const handler = createPositionsCacheHandler(db)

        const graph = await handler.getLudicGraph(featureHostId)

        expect(graph).toEqual({
            rootId: featureHostId, ports: [],
            nodes: [{ tag: 'Feature', universalKey: featureHostId }, { tag: 'Character', universalKey: characterId }],
        })
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

        expect(graph).toEqual(emptyPayload(featureHostId, 'Feature'))
        expect(db.getItem).toHaveBeenCalledTimes(1)
    })

    it('loads area-hosted graph from Meta::Area.ludicGraph (MK4)', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn().mockImplementation(async ({ Key, ProjectionFields }) => {
                if (Key.DataCategory === 'Meta::Area' && ProjectionFields?.includes('ludicGraph')) {
                    return {
                        ludicGraph: {
                            rootId: areaHostId, ports: [],
                            nodes: [{ tag: 'Area', universalKey: areaHostId }, { tag: 'Character', universalKey: characterId }],
                        },
                    }
                }
                throw new Error(`Unexpected Dynamo get: ${Key.DataCategory}`)
            }),
        }
        const handler = createPositionsCacheHandler(db)

        const graph = await handler.getLudicGraph(areaHostId)

        expect(graph).toEqual({
            rootId: areaHostId, ports: [],
            nodes: [{ tag: 'Area', universalKey: areaHostId }, { tag: 'Character', universalKey: characterId }],
        })
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

        expect(graph).toEqual(emptyPayload(areaHostId, 'Area'))
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
        const graph = storedRoomGraph

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
        const graph: EphemeraLudicGraphFieldPayload = {
            rootId: characterId, edges: [], ports: [],
            nodes: [{ tag: 'Character', universalKey: characterId }, { tag: 'Object', universalKey: objectId }],
        }

        handler.set({ componentId: characterId, graph })
        await expect(handler.getLudicGraph(characterId)).resolves.toEqual(graph)
        expect(db.getItem).not.toHaveBeenCalled()
    })

    it('memo set and invalidate patch object-hosted forward graph without Dynamo write (MK2)', async () => {
        const getItem = jest.fn().mockResolvedValue({})
        const db: EphemeraPositionsReadDB = { getItem }
        const handler = createPositionsCacheHandler(db)
        // Port-bearing: `set` must round-trip `ports`, not strip them on the way in.
        const graph = storedObjectGraphWithPort

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

    it('carries ports through a Dynamo load --- the memo caches stored truth, not an authored projection', async () => {
        const db: EphemeraPositionsReadDB = {
            getItem: jest.fn().mockImplementation(async ({ Key }) => {
                if (Key.DataCategory === 'Meta::Object') {
                    return { ludicGraph: storedObjectGraphWithPort }
                }
                throw new Error(`Unexpected Dynamo get: ${Key.DataCategory}`)
            }),
        }
        const handler = createPositionsCacheHandler(db)

        const graph = await handler.getLudicGraph(objectHostId)

        // Regression: this memo projected through the authored WML shape until 2026-09-03, which
        // emptied `ports` on every read. A crossing's port record was invisible to every consumer
        // reading through `internalCache.Positions`, so chain discovery silently declined.
        expect(graph.ports).toEqual([
            { portId: 'port-1', fromHostId: roomId, kind: 'Custom', exteriorRelationLabel: 'to' },
        ])
    })

    it('carries ports through a set -> get round trip', async () => {
        const db: EphemeraPositionsReadDB = { getItem: jest.fn().mockResolvedValue({}) }
        const handler = createPositionsCacheHandler(db)

        handler.set({ componentId: objectHostId, graph: storedObjectGraphWithPort })
        const graph = await handler.getLudicGraph(objectHostId)

        // The write half of the same defect: `commitStepSequence` seeds this memo with a graph it
        // just minted a port on, and the projection discarded it on the way in.
        expect(graph.ports).toEqual(storedObjectGraphWithPort.ports)
        expect(db.getItem).not.toHaveBeenCalled()
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
