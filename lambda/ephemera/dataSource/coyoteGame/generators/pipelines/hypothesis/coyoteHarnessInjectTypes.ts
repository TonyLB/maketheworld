import type { CombineCandidateOutputReturn } from './candidates/combineCandidateOutput';
import type { CoyoteHop1Handoff } from './planSelect/coyoteHop1Handoff';
import type { CoyoteRoomObjectsByRoom } from '../../../utilities/coyoteRoomObjectSnapshot';

/**
 * Minimum pipeline state to run **`hypothesisPlanSelectionLlm`** in **`runOnly`** mode.
 * Matches [`CoyoteHarnessPlanSelectInject`](../../testHarness/coyoteEngineTestFixtures.ts) (fixtures re-export this shape).
 */
export type CoyoteHarnessPlanSelectInject = {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom;
    combined: CombineCandidateOutputReturn;
};

/**
 * Minimum state to run **`hypothesisPhasePlanHopLlm`** in **`runOnly`** mode.
 */
export type CoyoteHarnessPhasePlanInject = CoyoteHarnessPlanSelectInject & {
    hop1Handoff: CoyoteHop1Handoff;
};
