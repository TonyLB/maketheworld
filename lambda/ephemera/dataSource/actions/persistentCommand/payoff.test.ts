import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { PersistentCommandPayload } from './payload'

/**
 * The plan's payoff: state that survives into a different instance. Each half runs in its own
 * module registry (`jest.isolateModules`), so no module-level counter or cache is shared.
 */
describe('persistentCommand payoff: state survives into another module instance', () => {
    const roomId = 'ROOM#Bridge' as EphemeraRoomId
    const ropeId = 'OBJECT#Rope' as EphemeraObjectId
    const postId = 'OBJECT#Post' as EphemeraObjectId
    const anvilId = 'OBJECT#Anvil' as EphemeraObjectId

    beforeEach(() => {
        jest.resetModules()
        jest.dontMock('@tonylb/mtw-utilities/ts/dynamoDB')
    })

    it('mints the same challenge ids for the same root in two registries', () => {
        const expandInFreshRegistry = (): string[] => {
            let ids: string[] = []
            jest.isolateModules(() => {
                const { testLudicGraph, testLudicGraphFromEnvelope } = require('../../positions/ludicGraph/testFixtures')
                const { attemptActionsFromTransfer } = require('../commandAttempt/expandBoundaryChallenges')
                const { PositionAttemptAction } = require('../commandAttempt/action')
                const exitGraph = testLudicGraphFromEnvelope(roomId, {
                    nodes: [],
                    edges: [{ kind: 'Navigation', uuid: 'edge-1', from: ropeId, to: anvilId, payload: {} }],
                })
                const lashedGraph = testLudicGraph(roomId, {
                    nodes: [
                        { tag: 'Object', universalKey: ropeId },
                        { tag: 'Object', universalKey: postId },
                    ],
                    edges: [{ tag: 'Relational', from: ropeId, to: postId, kind: 'Custom', relationLabel: 'is lashed to' }],
                })
                const primary = new PositionAttemptAction('primary', [], undefined, 'Take: rope')
                ids = [exitGraph, lashedGraph].flatMap((graph) => attemptActionsFromTransfer(primary, ropeId, graph, () => undefined)
                    .actions.flatMap((action: any) => action.challenges().map((challenge: any) => challenge.id)))
            })
            return ids
        }

        const first = expandInFreshRegistry()
        const second = expandInFreshRegistry()

        expect(first).toContain('exitEdge:primary')
        expect(first.some((id) => id.startsWith('customEdge:primary:'))).toBe(true)
        expect(second).toEqual(first)
    })

    it('reads, in one registry, the payload another registry wrote', async () => {
        const stored = new Map<string, string>()
        const fakeDB = {
            putItem: async (item: any) => { stored.set(`${item.EphemeraId}|${item.DataCategory}`, JSON.stringify(item)) },
            getItem: async ({ Key }: any) => {
                const raw = stored.get(`${Key.EphemeraId}|${Key.DataCategory}`)
                return raw === undefined ? undefined : JSON.parse(raw)
            },
        }
        let written: PersistentCommandPayload | undefined
        let putPromise: Promise<void> | undefined
        let getPromise: Promise<PersistentCommandPayload | undefined> | undefined
        let rehydratedWords: string[] = []

        // Each registry loads the pipeline modules before the table is faked: the fake carries no client for them to bind.
        jest.isolateModules(() => {
            const { takeCupPayload } = require('./testFixtures')
            jest.doMock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({ ephemeraDB: fakeDB }))
            const { put } = require('./rowStore')
            written = takeCupPayload()
            // The JSON round trip inside the fake mimics Dynamo's marshalling (drops `undefined` fields).
            putPromise = put('CHARACTER#TESS', 'abc', written)
        })
        await putPromise

        jest.isolateModules(() => {
            const { CommandAttempt } = require('../commandAttempt')
            jest.doMock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({ ephemeraDB: fakeDB }))
            const { get } = require('./rowStore')
            getPromise = get('CHARACTER#TESS', 'abc').then((payload: PersistentCommandPayload | undefined) => {
                rehydratedWords = (payload?.root.attempts ?? []).map((data) => CommandAttempt.fromJSON(data).words)
                return payload
            })
        })
        const read = await getPromise

        expect(written).toBeDefined()
        expect(read).toEqual(JSON.parse(JSON.stringify(written)))
        expect(rehydratedWords).toEqual(written!.root.attempts.map((attempt) => attempt.words))
        expect(rehydratedWords.length).toBeGreaterThan(0)
    })
})
