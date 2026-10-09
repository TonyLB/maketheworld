import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { PersistentCommandPayload } from './payload'

/**
 * The plan's end-to-end payoff: an answer stored by one instance lands on the right question in
 * another. Each half runs in its own module registry, so nothing but the row is shared.
 */
describe('persistentCommand resume payoff: a stored answer lands on its question in another instance', () => {
    const roomId = 'ROOM#Bridge' as EphemeraRoomId
    const characterId = 'CHARACTER#Tess' as EphemeraCharacterId
    const cupId = 'OBJECT#Cup' as EphemeraObjectId
    const doorId = 'OBJECT#Door' as EphemeraObjectId

    beforeEach(() => {
        jest.resetModules()
    })

    it('turns an exit-edge answer written in one registry into the verdict of the challenge a second registry regenerates', async () => {
        const stored = new Map<string, string>()
        const fakeDB = {
            putItem: async (item: any) => { stored.set(`${item.EphemeraId}|${item.DataCategory}`, JSON.stringify(item)) },
            getItem: async ({ Key }: any) => {
                const raw = stored.get(`${Key.EphemeraId}|${Key.DataCategory}`)
                return raw === undefined ? undefined : JSON.parse(raw)
            },
        }
        let putPromise: Promise<void> | undefined
        let primaryId = ''

        jest.isolateModules(() => {
            const { takeCupPayload } = require('./testFixtures')
            const { primaryActionIdOf } = require('../enrich/objectManipulation/resumeAnswers')
            const { CommandAttempt } = require('../commandAttempt')
            jest.doMock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({ ephemeraDB: fakeDB }))
            const { put } = require('./rowStore')
            const payload: PersistentCommandPayload = takeCupPayload()
            primaryId = primaryActionIdOf(CommandAttempt.fromJSON(payload.root.attempts[0]))
            putPromise = put(characterId, 'abc', {
                ...payload,
                selectedAttempt: primaryId,
                referentAnswers: {},
                challengeAnswers: { [`exitEdge:${primaryId}`]: { verdict: { kind: 'met' }, source: 'player' } },
            })
        })
        await putPromise

        const readsWithExitContact = (testLudicGraphFromEnvelope: any) => ({
            getMembershipContainers: async (id: string) => (id === characterId ? [] : [roomId]),
            getLudicGraph: async (hostId: string) => testLudicGraphFromEnvelope(hostId, {
                nodes: hostId === roomId ? [{ tag: 'Object', universalKey: cupId }] : [],
                edges: hostId === roomId ? [{ kind: 'Navigation', uuid: 'edge-1', from: cupId, to: doorId, payload: {} }] : [],
            }),
        })
        let resumed: Promise<any> | undefined
        let unanswered: Promise<any> | undefined

        jest.isolateModules(() => {
            const { testLudicGraphFromEnvelope } = require('../../positions/ludicGraph/testFixtures')
            require('../commandAttempt')
            // The first registry's fake is still registered; the pipeline modules must load before any fake, since it carries no client for them to bind.
            jest.dontMock('@tonylb/mtw-utilities/ts/dynamoDB')
            const { resumePersistentCommand } = require('./resume')
            jest.doMock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({ ephemeraDB: fakeDB }))
            const { get } = require('./rowStore')
            const world = { characterId, hostRoomId: roomId, roomObjectCatalog: [{ objectId: cupId, normalizedShortName: 'cup' }] }
            const deps = { positionsReadDeps: readsWithExitContact(testLudicGraphFromEnvelope) }
            resumed = get(characterId, 'abc').then((payload: PersistentCommandPayload) => resumePersistentCommand(payload, world, deps))
            unanswered = get(characterId, 'abc').then((payload: PersistentCommandPayload) => resumePersistentCommand(
                { ...payload, challengeAnswers: {} },
                world,
                deps
            ))
        })

        // The same row without the answer abstains on the pending exit contact; with it, the command proceeds.
        expect(await unanswered).toMatchObject({ type: 'Abstain' })
        expect(await resumed).toMatchObject({ type: 'CommandAttempt' })
    })
})
