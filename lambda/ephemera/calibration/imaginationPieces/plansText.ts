//
// A batch's replies for reading (`read-plans`), shared by the pieces whose contract gives a plan (calibration
// AGENT.md, "The action plan"): a leaf module, so each piece builds its own from its cells and contract.
//
import type { StageContract } from '../../llm/stageContract'
import { renderPlanForGenerator, type ActionPlan } from '../oracleLoop/actionPlan'
import type { ReadPiece } from '../pieceProbe/oraclePiece'
import type { ReadGroup } from '../pieceProbe/readPiece'

/**
 * Per cell and repeat, the plan the contract builds as a generator would read it, or why none. Each cell is rendered with the batch's
 * options, as the probe's check is, since the contract reads the prompt it was shown (the rule handles the scene tags, for one).
 */
export const plansText = <Inputs, Options>(piece: ReadPiece<Inputs, Options>, contract: StageContract<Inputs, ActionPlan>) =>
    async (groups: readonly ReadGroup[], options?: unknown): Promise<string> => {
        const parsedOptions = piece.parseOptions(options)
        if (typeof parsedOptions === 'string') {
            throw new Error(parsedOptions)
        }
        const texts = await Promise.all(groups.map(async ({ cell, replies }) => {
            const known = piece.cells[cell]
            const rendered = known === undefined ? undefined : await piece.render(known, parsedOptions)
            return replies.map(({ repeat, reply, error }) => {
                const heading = `## ${cell}, repeat ${repeat}`
                if (known === undefined || rendered === undefined) {
                    return `${heading}\nnot a ${piece.name} cell`
                }
                if (reply === undefined) {
                    return `${heading}\nerror: ${error ?? 'no reply'}`
                }
                const parsed = contract.parse(reply, { input: known.inputs, rendered })
                return 'value' in parsed ? `${heading}\n${renderPlanForGenerator(parsed.value)}` : `${heading}\nform: ${parsed.problems.join('; ')}`
            })
        }))
        return texts.flat().join('\n\n')
    }
