import type { CombineCandidateOutputReturn } from './candidates/combineCandidateOutput';
import type { PlanSelectOutputWithWinner } from './narrativeBeats/buildNarrativeBeatPrompt';
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
 * Minimum state to run **`hypothesisNarrativeBeatLlm`** in **`runOnly`** mode.
 * **`combined`** is omitted; plan-select outlier rehydration is not used in this harness path.
 */
export type CoyoteHarnessNarrativeBeatsInject = {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom;
    planSelectOutput: PlanSelectOutputWithWinner;
};
