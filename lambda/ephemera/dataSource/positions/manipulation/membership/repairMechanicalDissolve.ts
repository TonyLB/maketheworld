import type { HostRelationalEdge } from '../types'
import type { MutationKernelRepair } from '../kernel/types'

export type RepairMechanicalDissolveOutcome =
    | { ok: true; edge: HostRelationalEdge }
    | { ok: false }

/**
 * Take/drop/give's repair policy (3d, 2026-09-07 unification's `honorDefer` mode, deleted
 * 2026-09-08 in favor of naming the two dissolve paths as sibling repair policies rather than an
 * execute-time flag): a player action may not silently move the lamp. Refuses any repair whose
 * `authority` is not `'mechanical'` --- invisible to the player, such as severing an
 * already-dissolving edge --- regardless of what the repair itself names; a `'worldChanging'`
 * repair (or an undecidable `Custom` edge, which is also `'worldChanging'`) is not this policy's to
 * apply. See `repairAdministrativeChainDissolve`'s doc comment for the sibling policy that may
 * sever anything.
 *
 * Throws on a `'mechanical'` authority paired with anything other than `dissolveRelationalEdge`:
 * `applyTransferSet` (the only producer of this verdict pairing) never emits `'mechanical'` for
 * `classifyCustomRelation` --- that repair kind is always `'worldChanging'` --- so reaching this
 * branch would mean the producer's own contract broke, not a case this policy should silently
 * refuse.
 */
export const repairMechanicalDissolve = (
    repair: MutationKernelRepair,
    authority: 'mechanical' | 'worldChanging'
): RepairMechanicalDissolveOutcome => {
    if (authority !== 'mechanical') {
        return { ok: false }
    }
    if (repair.kind !== 'dissolveRelationalEdge') {
        throw new Error(`repairMechanicalDissolve: mechanical authority paired with '${repair.kind}' --- structural invariant violated (applyTransferSet never pairs 'mechanical' with anything but 'dissolveRelationalEdge')`)
    }
    return { ok: true, edge: repair.edge }
}
