import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { ObjectMembershipDiff } from '../membership/types'

export type PlanObjectClearFromAllHostsArgs = {
    priorContainers: EphemeraMembershipHostId[];
}

export type ObjectClearTransferPlan = {
    projection: ObjectMembershipDiff;
}

/**
 * Destroy/edit counterpart to `planMembershipTransfer`: clears an object from
 * every prior host of either kind. Host-kind discrimination lives downstream in
 * the kernel, which derives its own footprint from the step's `fromHostIds` ---
 * so this planner only projects `{ froms, to: null, changed }`.
 */
export const planObjectClearFromAllHosts = (
    args: PlanObjectClearFromAllHostsArgs
): ObjectClearTransferPlan => {
    const froms = [...args.priorContainers]

    return {
        projection: {
            froms,
            to: null,
            changed: froms.length > 0,
        },
    }
}
