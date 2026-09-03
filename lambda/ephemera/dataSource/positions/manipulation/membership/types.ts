import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

/** Graph-diff semantics for Object Moved (D8): eligible membership host endpoints. */
export type ObjectMembershipDiff = {
    froms: EphemeraMembershipHostId[];
    to: EphemeraMembershipHostId | null;
    changed: boolean;
}
