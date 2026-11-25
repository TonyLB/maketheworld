//
// What code makes of triage's answer (AGENT.triage.planning.md), from the handles the step it restated names. It runs after the contract, so
// the contract's value stays the answer triage gave, and the two can be read apart.
//
import type { SceneHandle } from '../../dataSource/positions/ludicCache/sceneModel'
import { namedHandles } from '../imaginationPieces/imaginationScene'
import type { ActionPlan } from '../oracleLoop/actionPlan'
import type { TriageAnswer } from './triage'

/**
 * The handles the plan's step names, as triage restated it, each once, in order: the things the act involves. What its intent, its sub-steps
 * and its consequences name doesn't count. It reads the plan's own step, with no target, since a reworded step's path is minted afresh.
 */
export const saysHandles = ({ steps }: ActionPlan): SceneHandle[] => [...new Set(steps.flatMap(({ says }) => namedHandles(says)))]

/**
 * A "Yes" whose step names an improvised thing is a "Defer" with the same plan: whether that thing is to be had is a price, which triage
 * doesn't set. Any other answer is as it was, a "Yes" that names nothing among them (the user, 2026-11-25).
 */
export const improvisedDefers = (answer: TriageAnswer): TriageAnswer => {
    const { kind, plan } = answer
    const named = saysHandles(plan)
    return kind === 'Yes' && (plan.improvised ?? []).some(({ handle }) => named.includes(handle)) ? { kind: 'Defer', plan } : answer
}
