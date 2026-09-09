import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { repairMechanicalDissolve } from './repairMechanicalDissolve'
import type { MutationKernelRepair } from '../kernel/types'
import type { HostRelationalEdge } from '../types'

const ROOM_ID = 'ROOM#TownSquare' as EphemeraRoomId
const edge: HostRelationalEdge = { from: 'OBJECT#Tray' as any, to: 'OBJECT#Table' as any, kind: 'Against' }

describe('repairMechanicalDissolve', () => {
    it('accepts a mechanical dissolveRelationalEdge repair, returning the edge', () => {
        const repair: MutationKernelRepair = { kind: 'dissolveRelationalEdge', hostId: ROOM_ID, edge }
        expect(repairMechanicalDissolve(repair, 'mechanical')).toEqual({ ok: true, edge })
    })

    it('refuses (ok: false) a worldChanging authority regardless of repair kind --- a player action may not silently move the lamp', () => {
        const repair: MutationKernelRepair = { kind: 'dissolveRelationalEdge', hostId: ROOM_ID, edge }
        expect(repairMechanicalDissolve(repair, 'worldChanging')).toEqual({ ok: false })
    })

    it('refuses (ok: false) a worldChanging classifyCustomRelation repair', () => {
        const repair: MutationKernelRepair = { kind: 'classifyCustomRelation', hostId: ROOM_ID, edge: { ...edge, kind: 'Custom', relationLabel: 'tied to' } }
        expect(repairMechanicalDissolve(repair, 'worldChanging')).toEqual({ ok: false })
    })

    it('throws on a mechanical authority paired with classifyCustomRelation --- applyTransferSet never produces this pairing', () => {
        const repair: MutationKernelRepair = { kind: 'classifyCustomRelation', hostId: ROOM_ID, edge: { ...edge, kind: 'Custom', relationLabel: 'tied to' } }
        expect(() => repairMechanicalDissolve(repair, 'mechanical')).toThrow(/structural invariant violated/)
    })
})
