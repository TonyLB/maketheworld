//
// The play-by-play, the imagination's more-detail ask (AGENT.imagination.planning.md): a read piece. Given a fixture and a candidate's
// actions in order, it says how each action would ordinarily be done, as a line for each thing the actions name, and what in the scene
// might get in the way. There is no answer set: code checks each reply's form, and a reader reads the replies against each cell's
// `lookFor`. What happens to the things the actions don't move is `consequences`' (step 1.5's sort).
//
import type { SceneHandle } from '../../dataSource/positions/ludicCache/sceneModel'
import { registerPiece, type ReadPiece, type ReadPieceCell } from '../pieceProbe/oraclePiece'
import {
    IMAGINATION_OPTIONS, actionsHandles, caseActions, caseSource, checkActionsBlock, listedTwice, parseImaginationOptions, renderSceneAndActions, thingsLine,
    type ImaginationOptions,
} from './imaginationScene'

export { namedHandles } from './imaginationScene'

export type PlayByPlayInputs = {
    fixture: string
    /** The candidate's actions in order, each in its words (`says`). The things described are the handles they name (PB-1). */
    actions: readonly string[]
    /**
     * The other things the sub-scene shows, by handle, listed by hand: a sub-scene of the named handles alone keeps only them and their
     * containers, so a relation to anything else (OC-20's chain to the wall) would drop out.
     */
    alsoShown: readonly SceneHandle[]
}

export type PlayByPlayOptions = ImaginationOptions

export const PLAY_BY_PLAY_OPTIONS: PlayByPlayOptions = IMAGINATION_OPTIONS

/** The things a cell describes: the handles its actions name, each once, in order. */
export const playByPlayThings = ({ actions }: PlayByPlayInputs): SceneHandle[] => actionsHandles(actions)

export const renderPlayByPlay = async ({ inputs }: ReadPieceCell<PlayByPlayInputs>, options: PlayByPlayOptions): Promise<string> => {
    const twice = listedTwice(inputs.alsoShown)
    if (twice.length > 0) {
        throw new Error(`Things shown twice: ${twice.join(', ')}`)
    }
    const parts = await renderSceneAndActions({ fixture: inputs.fixture, actions: inputs.actions, shown: inputs.alsoShown }, options)
    const things = playByPlayThings(inputs)
    if (things.length === 0) {
        throw new Error('The actions name no things to describe')
    }
    return [...parts, thingsLine(things)].join('\n\n')
}

/** The form problems of one reply, against the things its actions name (`checkActionsBlock`). */
export const checkPlayByPlay = (reply: string, { inputs }: ReadPieceCell<PlayByPlayInputs>): string[] =>
    checkActionsBlock(reply, inputs.actions.length, playByPlayThings(inputs))

export const playByPlayCells: Record<string, ReadPieceCell<PlayByPlayInputs>> = {
    'OC-1': {
        inputs: { fixture: 'teaTable', actions: caseActions('OC-1'), alsoShown: ['teapot1', 'cup1', 'saucer1'] },
        lookFor: 'the table lifted the ordinary way; things that might fall from it are a fair flag, and the glue flagged is an over-flag',
        source: caseSource('OC-1'),
    },
    'OC-6': {
        inputs: { fixture: 'teaTable', actions: caseActions('OC-6'), alsoShown: ['table1'] },
        lookFor: 'the teapot lifted or tilted off the table, as pouring needs, and not written to fit the glue (PR-1)',
        source: caseSource('OC-6'),
    },
    'OC-19': {
        inputs: { fixture: 'teaTableHammerHeld', actions: caseActions('OC-19'), alsoShown: [] },
        lookFor: 'the teapot levered up and off the table, the table staying',
        source: caseSource('OC-19'),
    },
    'OC-20': {
        inputs: { fixture: 'teaTableChained', actions: ['pick up [table1]'], alsoShown: ['wall1'] },
        lookFor: 'the table lifted and pulled from the wall, the wall staying',
        source: 'hand-written',
        note: "The oracle probe has no candidate, since the template refuses the move; the action is written by hand, as the rule cell's was.",
    },
}

/**
 * Draft 5's replies ran past 512 tokens (PB-P6), so the cap is raised while the drafts tune what is said. Shortening the reply is booked
 * for when the replies are good (user, 2026-11-10: needlessly verbose).
 */
export const PLAY_BY_PLAY_MAX_TOKENS = 1024

export const playByPlay: ReadPiece<PlayByPlayInputs, PlayByPlayOptions> = {
    kind: 'read',
    name: 'playByPlay',
    maxTokens: PLAY_BY_PLAY_MAX_TOKENS,
    cells: playByPlayCells,
    check: checkPlayByPlay,
    parseOptions: parseImaginationOptions,
    render: renderPlayByPlay,
}

export const registeredPlayByPlay = registerPiece(playByPlay)
