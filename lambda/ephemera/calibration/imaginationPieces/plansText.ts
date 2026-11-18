//
// A batch's replies for reading (`read-plans`), shared by the pieces whose contract gives a plan (calibration
// AGENT.md, "The action plan"): a leaf module, so each piece builds its own from its cells and contract.
//
import type { StageContract } from '../../llm/stageContract'
import { renderPlanForGenerator, type ActionPlan } from '../oracleLoop/actionPlan'
import type { ReadPieceCell } from '../pieceProbe/oraclePiece'
import type { ReadGroup } from '../pieceProbe/readPiece'

/** Per cell and repeat, the plan the contract builds as a generator would read it, or why none. */
export const plansText = <Inputs>(name: string, cells: Record<string, ReadPieceCell<Inputs>>, contract: StageContract<Inputs, ActionPlan>) =>
    (groups: readonly ReadGroup[]): string => groups.flatMap(({ cell, replies }) => {
        const known = cells[cell]
        return replies.map(({ repeat, reply, error }) => {
            const heading = `## ${cell}, repeat ${repeat}`
            if (known === undefined) {
                return `${heading}\nnot a ${name} cell`
            }
            if (reply === undefined) {
                return `${heading}\nerror: ${error ?? 'no reply'}`
            }
            const parsed = contract.parse(reply, { input: known.inputs, rendered: '' })
            return 'value' in parsed ? `${heading}\n${renderPlanForGenerator(parsed.value)}` : `${heading}\nform: ${parsed.problems.join('; ')}`
        })
    }).join('\n\n')
