/**
 * A proposal as the judge reads it: its moves, the place after them, or both. The scene above it is already the "before", so only the
 * "after" is rendered, named with the before's handles (`handleSeed`). The fiction alone leaves the graph register to code and the story to the
 * judge; the whole render repeats `Graph` and `Rules`. A proposal with no moves has an "after" equal to its "before".
 */
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { SceneHandleTable, SceneModel } from '../../positions/ludicCache/sceneModel'
import type { ProposedMove } from '../../positions/manipulation/proposedMoves'
import { judgeSceneSections } from './renderSceneJudge'
import { bracket, roomRef } from './sceneWording'

export type ProposedOutcomeForm = 'moves' | 'after' | 'both'
export type ProposedOutcomeAfter = 'fiction' | 'whole'

export const PROPOSED_OUTCOME_FORMS: readonly ProposedOutcomeForm[] = ['moves', 'after', 'both']
export const PROPOSED_OUTCOME_AFTERS: readonly ProposedOutcomeAfter[] = ['fiction', 'whole']

/** One move in words, named with the before scene's handles: `[tea2] moves from [teapot1] into [cup1]`, with no closing stop. */
export const moveText = (move: ProposedMove, handles: SceneHandleTable, scene: SceneModel): string => {
    const nameOf = (id: string): string => {
        if (isEphemeraCharacterId(id)) {
            return 'you'
        }
        if (isEphemeraRoomId(id)) {
            return roomRef(scene)
        }
        const entry = handles.find((candidate) => candidate.id === id)
        if (entry === undefined) {
            throw new Error(`renderProposedOutcome: ${id} has no handle in the scene`)
        }
        return bracket(entry.handle)
    }
    const preposition = move.hostingKind === 'In' ? 'into' : move.hostingKind === 'On' ? 'onto' : 'to'
    return `${nameOf(move.moved)} moves from ${nameOf(move.from)} ${preposition} ${nameOf(move.to)}`
}

const movesSection = (moves: readonly ProposedMove[], handles: SceneHandleTable, scene: SceneModel): string => (
    moves.length === 0
        ? 'Moves: none.'
        : ['Moves:', ...moves.map((move) => `- ${moveText(move, handles, scene)}.`)].join('\n')
)

const afterSection = (scene: SceneModel, after: ProposedOutcomeAfter): string => {
    const { fiction, graph, rules } = judgeSceneSections(scene)
    return ['After:', ...(after === 'fiction' ? [fiction] : [fiction, graph, ...(rules === undefined ? [] : [rules])])].join('\n\n')
}

export const renderProposedOutcome = ({ moves, handles, scene, form, after }: {
    moves: readonly ProposedMove[]
    /** The before scene's handles, which the after scene was seeded with. */
    handles: SceneHandleTable
    /** The scene after the moves. */
    scene: SceneModel
    form: ProposedOutcomeForm
    after: ProposedOutcomeAfter
}): string => [
    ...(form === 'after' ? [] : [movesSection(moves, handles, scene)]),
    ...(form === 'moves' ? [] : [afterSection(scene, after)]),
].join('\n\n')
