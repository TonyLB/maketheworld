//
// What code makes of triage's answer (AGENT.triage.planning.md), from the handles the step it restated names. It runs after the contract, so
// the contract's value stays the answer triage gave, and the two can be read apart.
//
import { hostsOf, judgeRules } from '../../dataSource/actions/sceneProse/sceneRules'
import type { SceneHandle, SceneModel } from '../../dataSource/positions/ludicCache/sceneModel'
import { ambiguousReferences, namedHandles } from '../imaginationPieces/imaginationScene'
import type { ActionPlan } from '../oracleLoop/actionPlan'
import type { TriageAnswer } from './triage'

/**
 * The handles the plan's step names, as triage restated it, each once, in order: the things the act involves. What its intent, its sub-steps
 * and its consequences name doesn't count. It reads the plan's own step, with no target, since a reworded step's path is minted afresh.
 */
export const saysHandles = ({ steps }: ActionPlan): SceneHandle[] => [...new Set(steps.flatMap(({ says }) => namedHandles(says)))]

/**
 * The things the act involves, as triage's answer claims them: the handles its step names, and then those its match found (`involved`),
 * each once. Every rule below reads them, so a step that keeps the player's words still shows the guard what its match found (the user, 2026-11-26).
 */
export const involvedHandles = ({ plan, involved = [] }: TriageAnswer): SceneHandle[] => [...new Set([...saysHandles(plan), ...involved.flatMap(namedHandles)])]

/** The answer deferred, its plan and what it involves kept, and a "No"'s reason dropped. */
const deferred = ({ plan, involved }: TriageAnswer): TriageAnswer => ({ kind: 'Defer', plan, ...(involved === undefined ? {} : { involved }) })

/**
 * A "Yes" whose step or match names an improvised thing (`involvedHandles`) is a "Defer" with the same plan: whether that thing is to be had is a price, which triage
 * doesn't set. Any other answer is as it was, a "Yes" that names nothing among them (the user, 2026-11-25).
 */
export const improvisedDefers = (answer: TriageAnswer): TriageAnswer => {
    const { kind, plan } = answer
    const named = involvedHandles(answer)
    return kind === 'Yes' && (plan.improvised ?? []).some(({ handle }) => named.includes(handle)) ? deferred(answer) : answer
}

/**
 * A "Yes" whose step or match makes an ambiguous reference, `[cup1 | cup2]`, is a "Defer" with the same plan: which thing the player means is the
 * judge's to settle. A "No" stands, since it can hold whichever thing is meant. Any other answer is as it was.
 */
export const ambiguityDefers = (answer: TriageAnswer): TriageAnswer => {
    const { kind, plan, involved = [] } = answer
    return kind === 'Yes' && [...plan.steps.map(({ says }) => says), ...involved].some((text) => ambiguousReferences(text).length > 0) ? deferred(answer) : answer
}

/**
 * The things the scene's securings hold, each once, in order: the ends of each securing (those the prompt's rules are minted from), except a
 * host's end against its own direct child, since moving a host can't move its child relative to it. A securing to something the scene doesn't
 * name as a thing has one end, its subject: a container whose contents it is secured to isn't an end.
 */
export const securedEnds = (scene: SceneModel): SceneHandle[] => {
    const hosts = hostsOf(scene)
    const hosted = (child: SceneHandle, host: SceneHandle): boolean => hosts.get(child)?.has(host) ?? false
    return [...new Set(judgeRules(scene).flatMap(({ subject, target }) => (
        target.kind !== 'thing' ? [subject] : [
            ...(hosted(target.handle, subject) ? [] : [subject]),
            ...(hosted(subject, target.handle) ? [] : [target.handle]),
        ]
    )))]
}

/**
 * A "Yes" or a "No" whose step or match names a thing a securing holds is a "Defer" with the same plan: whether the act keeps the securing, breaks it
 * or does away with it is the judge's. There is no walk from the handles, so a thing both leave out is missed, and so is a securing on
 * something carried along. Any other answer is as it was.
 */
export const securingDefers = (answer: TriageAnswer, scene: SceneModel): TriageAnswer => {
    const ends = securedEnds(scene)
    return answer.kind !== 'Defer' && involvedHandles(answer).some((handle) => ends.includes(handle)) ? deferred(answer) : answer
}

/** The answer after the guard: all three of code's rules, over the full scene. Each only makes a "Defer", so their order doesn't matter. */
export const guarded = (answer: TriageAnswer, scene: SceneModel): TriageAnswer => securingDefers(ambiguityDefers(improvisedDefers(answer)), scene)
