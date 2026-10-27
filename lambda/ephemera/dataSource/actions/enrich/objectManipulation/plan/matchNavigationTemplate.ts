import { defineAttemptTemplate, exitSpan, fixedWord, type ObjectSpanCapture } from '../../../deterministicTemplate/deterministicTemplate'
import { CommandAttempt } from '../../../commandAttempt'
import { mintActionId, NavigateAttemptAction } from '../../../commandAttempt/action'
import type { SkeletonFill } from '../compileAttemptsFromSkeleton'
import { objectSpanRef } from './planStep'

/** A navigation through the `destination` exit: one navigate action naming it, no step, no narration unit (the move narrates itself). */
const buildNavigation = ({ destination }: { destination: ObjectSpanCapture }, command: string): CommandAttempt => (
    CommandAttempt.create('navigation', command, [new NavigateAttemptAction(mintActionId(), [], objectSpanRef(destination.text, destination.stableRefKey))])
)

/** The movement verbs: matched for shape, read by nothing (every one goes through the exit). */
const MOVEMENT_VERB_ELEMENT = fixedWord('verb', { go: 'go', head: 'head', walk: 'walk', move: 'move', travel: 'travel', enter: 'enter' })

/**
 * A movement verb and an exit span. The span grounds against the room's exits, never the objects,
 * so `enter box` names an exit called "box"; whether the room has one is Identify's and the dry
 * run's to judge, never the pattern's.
 */
export const navigationTemplate = defineAttemptTemplate({
    name: 'navigation',
    pattern: [MOVEMENT_VERB_ELEMENT, exitSpan('destination')],
    build: buildNavigation,
})

/**
 * A bare exit name (`north`): the exit span alone. It fits every command, and an exit's exact pool
 * is empty for nearly all of them, so the reading drops out before selection unless the whole
 * command names an exit.
 */
export const bareNavigationTemplate = defineAttemptTemplate({
    name: 'navigation',
    pattern: [exitSpan('destination')],
    build: buildNavigation,
})

/**
 * The bare exit reading's fill: the whole command as one exit span. It fits every command, so it is
 * no evidence that a template read the command (the LLM route's `Unimplemented` asks just that).
 */
export const isBareExitFill = ({ skeleton }: SkeletonFill): boolean => (
    skeleton.length === 1 && skeleton[0].type === 'objectSpan' && skeleton[0].catalog === 'exits'
)
