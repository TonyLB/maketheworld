import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'

jest.mock('../membership/executeMembershipTransfer', () => ({
    __esModule: true,
    executeMembershipTransfer: jest.fn(),
}))

jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: { Positions: { getMembershipContainers: jest.fn(), getLudicGraph: jest.fn() } },
}))

import { executeMembershipTransfer } from '../membership/executeMembershipTransfer'
import { removeAuthoredObject } from './removeAuthoredObject'

const ROOM = 'ROOM#Cafe' as EphemeraRoomId
const ROOM_2 = 'ROOM#Kitchen' as EphemeraRoomId
const TESS = 'CHARACTER#Tess' as EphemeraCharacterId
const BOX = 'OBJECT#Box' as EphemeraObjectId
const CUP = 'OBJECT#Cup' as EphemeraObjectId
const SHELF = 'OBJECT#Shelf' as EphemeraObjectId

describe('removeAuthoredObject', () => {
    const messageBus = { publish: jest.fn() } as any
    const streamEvent = jest.fn()
    const graphs: Record<string, ReturnType<typeof testLudicGraph>> = {}
    const getLudicGraph = jest.fn(async (id: any) => graphs[id] ?? testLudicGraph(id, { nodes: [] }))
    const run = (id: EphemeraObjectId, hosts: any[]) =>
        removeAuthoredObject(id, { messageBus, streamEvent, getMembershipContainers: async () => hosts, getLudicGraph })
    const calls = () => (executeMembershipTransfer as jest.Mock).mock.calls.map(([args]) => [args.entityId, args.target])

    beforeEach(() => {
        jest.clearAllMocks()
        Object.keys(graphs).forEach((key) => delete graphs[key])
        ;(executeMembershipTransfer as jest.Mock).mockResolvedValue({ ok: true })
    })

    it('is a no-op for an Object with no live host', async () => {
        await run(BOX, [])
        expect(executeMembershipTransfer).not.toHaveBeenCalled()
    })

    it.each([
        ['a room', ROOM],
        ['a character\'s hands', TESS],
        ['another Object', SHELF],
    ])('removes an empty Object from %s', async (_label, host) => {
        await run(BOX, [host])
        expect(calls()).toEqual([[BOX, null]])
    })

    it('moves contents to the removed Object\'s host before removing it', async () => {
        graphs[BOX] = testLudicGraph(BOX, {
            nodes: [{ tag: 'Object', universalKey: CUP }],
            rootId: BOX,
        } as any).addPresenceNode(presenceBindingNode('box-in-cafe', ROOM))
        graphs[CUP] = testLudicGraph(CUP).addPresenceNode(presenceBindingNode('cup-in-box', BOX))
        await run(BOX, [ROOM])
        expect(calls()).toEqual([[CUP, ROOM], [BOX, null]])
    })

    it('empties each binding of a multi-host Object into its own host', async () => {
        const inCafe = presenceBindingNode('box-in-cafe', ROOM)
        const inKitchen = presenceBindingNode('box-in-kitchen', ROOM_2)
        graphs[BOX] = testLudicGraph(BOX, { nodes: [{ tag: 'Object', universalKey: CUP }], rootId: BOX } as any)
            .addPresenceNode(inCafe)
            .addPresenceNode(inKitchen)
        graphs[CUP] = testLudicGraph(CUP).addPresenceNode(presenceBindingNode('cup-in-box', { host: BOX, presence: inKitchen.universalKey }))
        await run(BOX, [ROOM, ROOM_2])
        expect(calls()).toEqual([[CUP, ROOM_2], [BOX, null]])
    })

    it('leaves the Object live if a content move fails', async () => {
        graphs[BOX] = testLudicGraph(BOX, { nodes: [{ tag: 'Object', universalKey: CUP }], rootId: BOX } as any)
            .addPresenceNode(presenceBindingNode('box-in-cafe', ROOM))
        graphs[CUP] = testLudicGraph(CUP).addPresenceNode(presenceBindingNode('cup-in-box', BOX))
        ;(executeMembershipTransfer as jest.Mock).mockResolvedValueOnce({ ok: false, errorMessage: 'boom' })
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
        await run(BOX, [ROOM])
        expect(calls()).toEqual([[CUP, ROOM]])
        errorSpy.mockRestore()
    })
})
