//
// The play-by-play, the imagination's more-detail ask (AGENT.imagination.planning.md): a read piece. Given a fixture and a candidate's
// actions in order, it says how each action would ordinarily be done, as a line for each thing the actions name, and what in the scene
// might get in the way. There is no answer set: code checks each reply's form, and a reader reads the replies against each cell's
// `lookFor`. What happens to the things the actions don't move is `consequences`' (step 1.5's sort).
//
import type { SceneHandle } from '../../dataSource/positions/ludicCache/sceneModel'
import { parseProblems, replyJsonObject, type StageContract } from '../../llm/stageContract'
import { planOf, renderPlanForGenerator, type ActionPlan, type UnmintedItem } from '../oracleLoop/actionPlan'
import { registerPiece, type ReadPiece, type ReadPieceCell } from '../pieceProbe/oraclePiece'
import type { ReadGroup } from '../pieceProbe/readPiece'
import {
    IMAGINATION_OPTIONS, actionsHandles, caseActions, caseSource, checkActionsBlock, linesByHandle, listedTwice, parseImaginationOptions, renderSceneAndActions,
    thingsLine, type ImaginationOptions,
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
    return [...parts, thingsLine(things, options)].join('\n\n')
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** The step a problem names, by the render's own label (`Action N`, N in range; the first such mention), else the last (mine). */
const problemStep = (problem: string, actionCount: number): number => {
    const named = [...problem.matchAll(/\bAction (\d+)\b/g)].map(([, number]) => Number(number)).find((number) => number >= 1 && number <= actionCount)
    return (named ?? actionCount) - 1
}

/**
 * A checked reply's block as a plan (AP-5; step 0 of AGENT.actionPlan.planning.md): each action a step, supplied by the system; each
 * described thing's line an unintended consequence with its `thing`, in the things' order (mine); each problem a concern on the step it
 * names, else the last. Code mints every path, so the model names nothing. The block is taken as the contract has checked it.
 */
export const planFromPlayByPlay = (inputs: PlayByPlayInputs, block: { actions: readonly Record<string, unknown>[]; problems?: readonly string[] }): ActionPlan => {
    const things = playByPlayThings(inputs)
    const concerns = (block.problems ?? []).map((says) => ({ step: problemStep(says, inputs.actions.length), says }))
    return planOf(inputs.actions.map((says, index) => {
        const lines = linesByHandle(block.actions[index] ?? {})
        return {
            step: { says, suppliedBy: 'system' as const },
            items: [
                ...things.flatMap((thing): UnmintedItem[] => {
                    const values = lines.get(thing)
                    return values === undefined ? [] : [{ kind: 'consequence', thing, says: values.join(' ').trim() }]
                }),
                ...concerns.filter(({ step }) => step === index).map(({ says }): UnmintedItem => ({ kind: 'concern', says })),
            ],
        }
    }))
}

/** The `problems` list's form: absent, or a list of non-empty strings, since each becomes a concern (mine, the one rule beyond the block's). */
const problemsProblems = (problems: unknown): string[] => {
    if (problems === undefined) {
        return []
    }
    if (!Array.isArray(problems)) {
        return ['"problems" is not a list']
    }
    return problems.flatMap((problem, index) => (typeof problem === 'string' && problem.trim() !== '' ? [] : [`problem ${index + 1} is not a non-empty string`]))
}

/**
 * The stage's contract: the reply's block as a plan. The form is `checkActionsBlock`'s, unchanged, and the `problems` list's; with no
 * problem, the value is `planFromPlayByPlay` of the block.
 */
export const playByPlayContract: StageContract<PlayByPlayInputs, ActionPlan> = {
    name: 'playByPlay',
    parse: (reply, { input }) => {
        const blockProblems = checkActionsBlock(reply, input.actions.length, playByPlayThings(input))
        const parsed = replyJsonObject(reply)
        const problems = [...blockProblems, ...('object' in parsed ? problemsProblems(parsed.object.problems) : [])]
        if (problems.length > 0 || !('object' in parsed)) {
            return { problems }
        }
        const { actions, problems: given } = parsed.object
        return { value: planFromPlayByPlay(input, { actions: (actions as unknown[]).filter(isRecord), problems: given as string[] | undefined }) }
    },
}

/** The probe's form check: the contract's parse problems. */
export const checkPlayByPlay = (reply: string, { inputs }: ReadPieceCell<PlayByPlayInputs>, rendered = ''): string[] =>
    parseProblems(playByPlayContract.parse(reply, { input: inputs, rendered }))

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

/** A batch's replies for reading (`read-plans`): per cell and repeat, the plan the contract builds as a generator would read it, or why none. */
export const playByPlayPlansText = (groups: readonly ReadGroup[]): string => groups.flatMap(({ cell, replies }) => {
    const known = playByPlayCells[cell]
    return replies.map(({ repeat, reply, error }) => {
        const heading = `## ${cell}, repeat ${repeat}`
        if (known === undefined) {
            return `${heading}\nnot a playByPlay cell`
        }
        if (reply === undefined) {
            return `${heading}\nerror: ${error ?? 'no reply'}`
        }
        const parsed = playByPlayContract.parse(reply, { input: known.inputs, rendered: '' })
        return 'value' in parsed ? `${heading}\n${renderPlanForGenerator(parsed.value)}` : `${heading}\nform: ${parsed.problems.join('; ')}`
    })
}).join('\n\n')
