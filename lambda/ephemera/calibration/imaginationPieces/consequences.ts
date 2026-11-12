//
// Consequences, the imagination's other-things ask (AGENT.imagination.planning.md, steps 1.5 and 3): a read piece. Given a fixture, a
// method already chosen as actions in order, the things to describe and the intent, it says how each of those things moves as the
// actions happen, and flags the consequences that work against the intent. Collateral consequences are listed, not flagged: the oracle
// family judges them. There is no answer set: code checks each reply's form, and a reader reads the replies against each cell's `lookFor`.
//
import type { SceneHandle } from '../../dataSource/positions/ludicCache/sceneModel'
import { oracleCases } from '../oracleLoop/oracleCases'
import { registerPiece, type ReadPiece, type ReadPieceCell } from '../pieceProbe/oraclePiece'
import {
    IMAGINATION_OPTIONS, caseActions, caseSource, checkActionsBlock, listedTwice, parseImaginationOptions, renderSceneAndActions, thingsLine,
    type ImaginationOptions,
} from './imaginationScene'

export type ConsequencesInputs = {
    fixture: string
    /** The method's actions in order, each in its words (`says`). */
    actions: readonly string[]
    /** The player's original full command, given and never derived (user, 2026-11-11). */
    intent: string
    /**
     * The things to describe, by handle, listed by hand: those whose motion the method doesn't state, named or not (user, 2026-11-11:
     * OC-30/2's cup, which the action names, ends up no longer under the spout).
     */
    things: readonly SceneHandle[]
}

export type ConsequencesOptions = ImaginationOptions

export const CONSEQUENCES_OPTIONS: ConsequencesOptions = IMAGINATION_OPTIONS

export const renderConsequences = async ({ inputs: { fixture, actions, intent, things } }: ReadPieceCell<ConsequencesInputs>, options: ConsequencesOptions): Promise<string> => {
    if (things.length === 0) {
        throw new Error('No things to describe')
    }
    const twice = listedTwice(things)
    if (twice.length > 0) {
        throw new Error(`Things listed twice: ${twice.join(', ')}`)
    }
    if (intent.trim() === '') {
        throw new Error('No intent')
    }
    const parts = await renderSceneAndActions({ fixture, actions, shown: things }, options)
    return [...parts, `The intent: ${intent}`, thingsLine(things)].join('\n\n')
}

/** The form problems of one reply, against the listed things (`checkActionsBlock`). */
export const checkConsequences = (reply: string, { inputs: { actions, things } }: ReadPieceCell<ConsequencesInputs>): string[] =>
    checkActionsBlock(reply, actions.length, things)

/** A case's first candidate as the method, with its request as the intent. */
const caseInputs = (id: string, things: readonly SceneHandle[]): ConsequencesInputs => ({
    fixture: oracleCases[id].scene.fixture, actions: caseActions(id), intent: oracleCases[id].request, things,
})

export const consequencesCells: Record<string, ReadPieceCell<ConsequencesInputs>> = {
    'OC-30/2': {
        inputs: caseInputs('OC-30/2', ['saucer1', 'cup1']),
        lookFor: 'the saucer and cup slide off the tipped table, and the cup no longer under the spout is a problem against the intent',
        source: caseSource('OC-30/2'),
    },
    'OC-1': {
        inputs: caseInputs('OC-1', ['teapot1', 'cup1', 'saucer1']),
        lookFor: 'everything on the table rises with it, and nothing works against the intent',
        source: caseSource('OC-1'),
        note: 'The control (step 1.5): a carry with no problem.',
    },
}

/** As the play-by-play's, while the drafts tune what is said (PB-P6, PB-L16: the cap is per piece). */
export const CONSEQUENCES_MAX_TOKENS = 1024

export const consequences: ReadPiece<ConsequencesInputs, ConsequencesOptions> = {
    kind: 'read',
    name: 'consequences',
    maxTokens: CONSEQUENCES_MAX_TOKENS,
    cells: consequencesCells,
    check: checkConsequences,
    parseOptions: parseImaginationOptions,
    render: renderConsequences,
}

export const registeredConsequences = registerPiece(consequences)
