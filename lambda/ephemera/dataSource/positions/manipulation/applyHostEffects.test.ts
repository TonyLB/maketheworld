import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { produce } from 'immer'

import { planObjectDropTransfer } from './adapters/planObjectDropTransfer'
import { planObjectTakeHoldTransfer } from './adapters/planObjectTakeHoldTransfer'
import { planMembershipTransfer } from './adapters/planMembershipTransfer'
import { applyHostEffects } from './applyHostEffects'
import { testPositionGraph } from '../positionGraph/testFixtures'

const OBJECT_ID = 'OBJECT#Broom' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId
const NAV_CHARACTER_ID = 'CHARACTER#Nav' as EphemeraCharacterId
const ROOM_FROM = 'ROOM#VORTEX' as EphemeraRoomId
const ROOM_TO = 'ROOM#TestTwo' as EphemeraRoomId

describe('applyHostEffects', () => {
    const transactWrite = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('skips transact when hostEffects is empty', async () => {
        const result = await applyHostEffects({ hostEffects: [] }, { transactWrite })

        expect(result).toEqual({ ok: true, persisted: false, changed: false })
        expect(transactWrite).not.toHaveBeenCalled()
    })

    it('persists takeHold-shaped hostEffects in one transact', async () => {
        const plan = planObjectTakeHoldTransfer({
            objectId: OBJECT_ID,
            roomId: ROOM_ID,
            characterId: CHARACTER_ID,
            priorContainers: [ROOM_ID],
        })

        const roomGraphWithObject = {
            nodes: [{ tag: 'Object' as const, universalKey: OBJECT_ID }],
            edges: [] as [],
        }
        const emptyCharacterGraph = { nodes: [], edges: [] as [] }

        const result = await applyHostEffects(
            { hostEffects: plan.hostEffects },
            {
                getPositionGraph: async (hostId) =>
                    hostId === ROOM_ID
                        ? testPositionGraph(ROOM_ID, roomGraphWithObject)
                        : testPositionGraph(CHARACTER_ID, emptyCharacterGraph),
                transactWrite,
            }
        )

        expect(result).toMatchObject({
            ok: true,
            persisted: true,
            changed: true,
        })
        expect(transactWrite).toHaveBeenCalledTimes(1)
        const items = transactWrite.mock.calls[0][0] as any[]
        expect(items).toHaveLength(4)

        const roomGraphDraft = produce({ positionGraph: roomGraphWithObject }, (draft) => {
            items[0].Update.updateReducer(draft)
        })
        expect(roomGraphDraft.positionGraph?.nodes).toEqual([])

        const characterGraphDraft = produce({ positionGraph: emptyCharacterGraph }, (draft) => {
            items[2].Update.updateReducer(draft)
        })
        expect(characterGraphDraft.positionGraph?.nodes).toEqual([
            { tag: 'Object', universalKey: OBJECT_ID },
        ])
    })

    it('persists drop-shaped hostEffects in one transact', async () => {
        const plan = planObjectDropTransfer({
            objectId: OBJECT_ID,
            roomId: ROOM_ID,
            characterId: CHARACTER_ID,
            priorContainers: [CHARACTER_ID],
        })

        const characterGraphWithObject = {
            nodes: [{ tag: 'Object' as const, universalKey: OBJECT_ID }],
            edges: [] as [],
        }
        const emptyRoomGraph = { nodes: [], edges: [] as [] }

        const result = await applyHostEffects(
            { hostEffects: plan.hostEffects },
            {
                getPositionGraph: async (hostId) =>
                    hostId === CHARACTER_ID
                        ? testPositionGraph(CHARACTER_ID, characterGraphWithObject)
                        : testPositionGraph(ROOM_ID, emptyRoomGraph),
                transactWrite,
            }
        )

        expect(result).toMatchObject({
            ok: true,
            persisted: true,
            changed: true,
        })
        expect(transactWrite).toHaveBeenCalledTimes(1)
        if (result.ok && result.persisted) {
            expect(result.postApplyGraphs.find((g) => g.hostId === CHARACTER_ID)?.toStored().nodes).toEqual([])
            expect(result.postApplyGraphs.find((g) => g.hostId === ROOM_ID)?.toStored().nodes).toEqual([
                { tag: 'Object', universalKey: OBJECT_ID },
            ])
        }
    })

    it('returns validation error when remove target is absent', async () => {
        const plan = planObjectTakeHoldTransfer({
            objectId: OBJECT_ID,
            roomId: ROOM_ID,
            characterId: CHARACTER_ID,
            priorContainers: [ROOM_ID],
        })

        const result = await applyHostEffects(
            { hostEffects: plan.hostEffects },
            {
                getPositionGraph: async () => testPositionGraph(ROOM_ID),
                transactWrite,
            }
        )

        expect(result).toMatchObject({
            ok: false,
            errorCode: 'HOST_EFFECT_VALIDATION_FAILED',
        })
        expect(transactWrite).not.toHaveBeenCalled()
    })

    it('computes postApplyGraphs from hostEffects', async () => {
        const plan = planObjectTakeHoldTransfer({
            objectId: OBJECT_ID,
            roomId: ROOM_ID,
            characterId: CHARACTER_ID,
            priorContainers: [ROOM_ID],
        })

        const roomGraphWithObject = {
            nodes: [{ tag: 'Object' as const, universalKey: OBJECT_ID }],
            edges: [] as [],
        }
        const emptyCharacterGraph = { nodes: [], edges: [] as [] }

        const result = await applyHostEffects(
            { hostEffects: plan.hostEffects },
            {
                getPositionGraph: async (hostId) =>
                    hostId === ROOM_ID
                        ? testPositionGraph(ROOM_ID, roomGraphWithObject)
                        : testPositionGraph(CHARACTER_ID, emptyCharacterGraph),
                transactWrite,
            }
        )

        expect(result).toMatchObject({ ok: true, persisted: true })
        if (result.ok && result.persisted) {
            expect(result.postApplyGraphs.find((g) => g.hostId === ROOM_ID)?.toStored().nodes).toEqual([])
            expect(result.postApplyGraphs.find((g) => g.hostId === CHARACTER_ID)?.toStored().nodes).toEqual([
                { tag: 'Object', universalKey: OBJECT_ID },
            ])
        }
    })

    it('persists character navigate-shaped room hostEffects', async () => {
        const plan = planMembershipTransfer({
            entityId: NAV_CHARACTER_ID,
            entityKind: 'character',
            applyMode: 'end-state',
            target: ROOM_TO,
            priorContainers: [ROOM_FROM],
        })

        const fromGraph = {
            nodes: [{ tag: 'Character' as const, universalKey: NAV_CHARACTER_ID }],
            edges: [] as [],
        }
        const toGraph = { nodes: [], edges: [] as [] }

        const result = await applyHostEffects(
            { hostEffects: plan.hostEffects },
            {
                getPositionGraph: async (hostId) =>
                    hostId === ROOM_FROM
                        ? testPositionGraph(ROOM_FROM, fromGraph)
                        : testPositionGraph(ROOM_TO, toGraph),
                transactWrite,
            }
        )

        expect(result).toMatchObject({ ok: true, persisted: true, changed: true })
        expect(transactWrite).toHaveBeenCalledTimes(1)
        const items = transactWrite.mock.calls[0][0] as any[]
        expect(items).toHaveLength(4)
    })

    it('returns error when transact fails', async () => {
        transactWrite.mockRejectedValueOnce(new Error('transact failed'))

        const plan = planObjectTakeHoldTransfer({
            objectId: OBJECT_ID,
            roomId: ROOM_ID,
            characterId: CHARACTER_ID,
            priorContainers: [ROOM_ID],
        })

        const roomGraphWithObject = {
            nodes: [{ tag: 'Object' as const, universalKey: OBJECT_ID }],
            edges: [] as [],
        }

        const result = await applyHostEffects(
            { hostEffects: plan.hostEffects },
            {
                getPositionGraph: async (hostId) =>
                    hostId === ROOM_ID
                        ? testPositionGraph(ROOM_ID, roomGraphWithObject)
                        : testPositionGraph(CHARACTER_ID),
                transactWrite,
            }
        )

        expect(result).toEqual({
            ok: false,
            errorCode: 'HOST_EFFECTS_TRANSACT_FAILED',
            errorMessage: 'transact failed',
        })
    })
})
