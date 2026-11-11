//
// The play-by-play (a Prototype of the oracle loop plan's Slice 4.5): a read piece. Given a fixture, a candidate's actions in order and the
// things to describe, it says what each thing does physically in each action, transient motion included. Its block is a line per thing per
// action, the shape of the rule cell's `motions` for any pair of the things. There is no answer set: code checks each reply's form, and a
// reader reads the replies against each cell's `lookFor` (AGENT.imagination.planning.md: the imagination family's first ask, more detail).
//
import { judgeSceneSections } from '../../dataSource/actions/sceneProse/renderSceneJudge'
import { judgeRules } from '../../dataSource/actions/sceneProse/sceneRules'
import { subScene } from '../../dataSource/actions/sceneProse/subScene'
import { heading } from '../../dataSource/actions/sceneProse/sceneWording'
import { buildSceneFixture, sceneFixture } from '../../dataSource/positions/ludicCache/sceneFixtures'
import type { SceneHandle, SceneModel } from '../../dataSource/positions/ludicCache/sceneModel'
import { splitMarkdownReasoningAndJson } from '../../llm/splitMarkdownReasoningAndJson'
import { oracleCases } from '../oracleLoop/oracleCases'
import { registerPiece, type ReadPiece, type ReadPieceCell } from '../pieceProbe/oraclePiece'

export type PlayByPlayInputs = {
    fixture: string
    /** The candidate's actions in order, each in its words (`says`). */
    actions: readonly string[]
    /** The things to describe, by handle (PB-1: listed by hand). */
    things: readonly SceneHandle[]
}

export type PlayByPlayOptions = {
    /**
     * How the sub-scene's rules are shown: `none` (the default), or `consequence`, each rule's fact and what it does when the thing its
     * subject is secured to is moved (user, 2026-11-10). Whether a rule blocks is the rule cell's, so the play-by-play is shown only what a
     * rule causes (PB-2, PR-1). Replaces a `sceneRules` boolean that showed v45's sentences.
     */
    rules: 'none' | 'consequence'
}

export const PLAY_BY_PLAY_OPTIONS: PlayByPlayOptions = { rules: 'none' }

const parsePlayByPlayOptions = (value: unknown): PlayByPlayOptions | string => {
    if (value === undefined) {
        return PLAY_BY_PLAY_OPTIONS
    }
    const shape = "options must be { rules?: 'none' | 'consequence' }"
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return shape
    }
    const { rules = PLAY_BY_PLAY_OPTIONS.rules, ...rest } = value as Record<string, unknown>
    return Object.keys(rest).length > 0 || (rules !== 'none' && rules !== 'consequence') ? shape : { rules }
}

const fixtureScene = async (name: string): Promise<SceneModel> => {
    const fixture = sceneFixture(name)
    return (await buildSceneFixture(fixture)).scene({ exits: fixture.exits }).scene
}

/** The handles a text names in brackets, in order. */
export const namedHandles = (text: string): SceneHandle[] => [...text.matchAll(/\[([^\]]+)\]/g)].map(([, handle]) => handle)

/** The sub-scene's rules as fact and consequence, or none when it has no securing. */
const consequenceRules = (scene: SceneModel): string[] => {
    const lines = judgeRules(scene).map(({ handle, parts }) => `- ${handle}: ${parts.fact} ${parts.consequence}`)
    return lines.length === 0 ? [] : [['Rules:', ...lines].join('\n')]
}

export const renderPlayByPlay = async ({ inputs: { fixture, actions, things } }: ReadPieceCell<PlayByPlayInputs>, { rules }: PlayByPlayOptions): Promise<string> => {
    if (actions.length === 0) {
        throw new Error('No actions')
    }
    if (things.length === 0) {
        throw new Error('No things to describe')
    }
    const twice = things.filter((handle, index) => things.indexOf(handle) !== index)
    if (twice.length > 0) {
        throw new Error(`Things listed twice: ${[...new Set(twice)].join(', ')}`)
    }
    const full = await fixtureScene(fixture)
    const named = [...new Set(actions.flatMap(namedHandles))]
    const unknown = named.filter((handle) => full.things[handle] === undefined)
    if (unknown.length > 0) {
        throw new Error(`The actions name ${unknown.join(', ')}, not in ${fixture}'s scene`)
    }
    // The listed things and every thing the actions name, so the prompt names nothing the scene doesn't show (mine).
    const sub = subScene(full, [...new Set([...things, ...named])])
    const sections = judgeSceneSections(sub)
    return [
        `Scene: ${heading(full)}`,
        sections.fiction,
        sections.graph,
        ...(rules === 'consequence' ? consequenceRules(sub) : []),
        'End of scene.',
        ...actions.map((says, index) => `Action ${index + 1}: ${says}`),
        `The things: ${things.map((handle) => `[${handle}]`).join(', ')}`,
    ].join('\n\n')
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * An entry's lines by bare handle: `[teapot1]` and `teapot1` are the same key, as the prompt writes every handle in brackets (user, 2026-11-10).
 * Where both spellings appear, their values are merged in the entry's order.
 */
const linesByHandle = (entry: Record<string, unknown>): Map<SceneHandle, unknown[]> => Object.entries(entry).reduce((lines, [key, value]) => {
    const handle = key.trim().replace(/^\[(.*)\]$/, '$1')
    return lines.set(handle, [...(lines.get(handle) ?? []), value])
}, new Map<SceneHandle, unknown[]>())

/**
 * The form problems of one reply: a fenced `json` block whose `actions` has an entry per action, each a non-empty line for some of the
 * listed things and no others, keyed by handle with or without its brackets. A listed thing with no line is silent, not a form failure:
 * it keeps its relations and stays in its frame (user, 2026-11-10).
 */
export const checkPlayByPlay = (reply: string, { inputs: { actions, things } }: ReadPieceCell<PlayByPlayInputs>): string[] => {
    const split = splitMarkdownReasoningAndJson(reply)
    if (!split.ok) {
        return ['no JSON block']
    }
    let value: unknown
    try {
        value = JSON.parse(split.jsonText)
    } catch {
        return ['the JSON block does not parse']
    }
    const given = isRecord(value) ? value.actions : undefined
    if (!Array.isArray(given)) {
        return ['the JSON block has no "actions" array']
    }
    return [
        ...(given.length === actions.length ? [] : [`expected ${actions.length} actions, got ${given.length}`]),
        ...given.flatMap((entry, index): string[] => {
            const action = `action ${index + 1}`
            if (!isRecord(entry)) {
                return [`${action} is not an object`]
            }
            const lines = linesByHandle(entry)
            return [
                ...[...lines.keys()].filter((handle) => !things.includes(handle)).map((handle) => `${action}: ${handle} is not a listed thing`),
                ...things.flatMap((handle) => {
                    const values = lines.get(handle)
                    if (values === undefined) {
                        return []
                    }
                    if (!values.every((value): value is string => typeof value === 'string')) {
                        return [`${action}: ${handle}'s line is not a string`]
                    }
                    return values.join(' ').trim() === '' ? [`${action}: ${handle}'s line is empty`] : []
                }),
            ]
        }),
    ]
}

/** A case's first candidate's actions, as the oracle probe has them. */
const caseActions = (id: string): readonly string[] => oracleCases[id].candidates[0].steps.map(({ says }) => says)
const caseSource = (id: string): string => `oracleCases ${id}, candidate ${oracleCases[id].candidates[0].id}`

export const playByPlayCells: Record<string, ReadPieceCell<PlayByPlayInputs>> = {
    'OC-1': {
        inputs: { fixture: 'teaTable', actions: caseActions('OC-1'), things: ['table1', 'teapot1', 'cup1', 'saucer1'] },
        lookFor: 'everything on the table rises with it; nothing moves relative to the table unless the reply says why',
        source: caseSource('OC-1'),
    },
    'OC-6': {
        inputs: { fixture: 'teaTable', actions: caseActions('OC-6'), things: ['teapot1', 'table1', 'cup1'] },
        lookFor: 'the teapot lifted or tilted off the table, as pouring needs, and not written to fit the glue (PR-1)',
        source: caseSource('OC-6'),
    },
    'OC-30/2': {
        inputs: { fixture: 'teaTable', actions: caseActions('OC-30/2'), things: ['table1', 'teapot1', 'cup1', 'saucer1'] },
        lookFor: "the teapot tips with the table; the saucer and cup slide (the corpus's end result)",
        source: caseSource('OC-30/2'),
    },
    'OC-19': {
        inputs: { fixture: 'teaTableHammerHeld', actions: caseActions('OC-19'), things: ['teapot1', 'table1', 'hammer1'] },
        lookFor: 'the teapot levered up and off the table, the table staying',
        source: caseSource('OC-19'),
    },
    'OC-20': {
        inputs: { fixture: 'teaTableChained', actions: ['pick up [table1]'], things: ['table1', 'wall1'] },
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
    parseOptions: parsePlayByPlayOptions,
    render: renderPlayByPlay,
}

export const registeredPlayByPlay = registerPiece(playByPlay)
