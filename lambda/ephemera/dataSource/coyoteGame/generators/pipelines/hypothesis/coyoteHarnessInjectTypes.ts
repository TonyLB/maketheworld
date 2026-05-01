import type { CombineCandidateOutputReturn } from './candidates/combineCandidateOutput';
import type { PlanSelectOutput } from './planSelect/parsePlanSelectOutput';
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
    planSelectOutput: PlanSelectOutput;
};
