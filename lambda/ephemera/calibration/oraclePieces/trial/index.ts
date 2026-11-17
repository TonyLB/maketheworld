//
// The trial (AGENT.nonRuleCell.planning.md, step 3, the trial family; the user's idea, 2026-11-16): one harness kind, `trial`, whose stages
// share one record per cell (`trialCases.ts`). A payload names the stage in `options.stage`; each runs alone, on recorded upstream values.
//
import { registerFamily } from '../../pieceProbe/oraclePiece'
import { registeredAgainst } from './against'
import { registeredRebuttal } from './rebuttal'
import { registeredRuling } from './ruling'
import { registeredVerdict } from './verdict'

export const registeredTrial = registerFamily('trial', { against: registeredAgainst, rebuttal: registeredRebuttal, verdict: registeredVerdict, ruling: registeredRuling })
