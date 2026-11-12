//
// What the imagination's pieces render and check in common (AGENT.imagination.planning.md, step 1.5): the fixture's sub-scene and the
// actions, the `rules` option, and the block, a line per thing per action and a list of problems, shared while IM-5 is open.
//
import { judgeSceneSections } from '../../dataSource/actions/sceneProse/renderSceneJudge'
import { judgeRules } from '../../dataSource/actions/sceneProse/sceneRules'
import { subScene } from '../../dataSource/actions/sceneProse/subScene'
import { heading } from '../../dataSource/actions/sceneProse/sceneWording'
import { buildSceneFixture, sceneFixture } from '../../dataSource/positions/ludicCache/sceneFixtures'
import type { SceneHandle, SceneModel } from '../../dataSource/positions/ludicCache/sceneModel'
import { splitMarkdownReasoningAndJson } from '../../llm/splitMarkdownReasoningAndJson'
import { oracleCases } from '../oracleLoop/oracleCases'

export type ImaginationOptions = {
    /**
     * How the sub-scene's rules are shown: `none` (the default), or `consequence`, each rule's fact and what it does when the thing its
     * subject is secured to is moved (user, 2026-11-10). Whether a rule blocks is the rule cell's, so an ask is shown only what a rule
     * causes (PB-2, PR-1). Replaces a `sceneRules` boolean that showed v45's sentences.
     */
    rules: 'none' | 'consequence'
}

export const IMAGINATION_OPTIONS: ImaginationOptions = { rules: 'none' }

export const parseImaginationOptions = (value: unknown): ImaginationOptions | string => {
    if (value === undefined) {
        return IMAGINATION_OPTIONS
    }
    const shape = "options must be { rules?: 'none' | 'consequence' }"
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return shape
    }
    const { rules = IMAGINATION_OPTIONS.rules, ...rest } = value as Record<string, unknown>
    return Object.keys(rest).length > 0 || (rules !== 'none' && rules !== 'consequence') ? shape : { rules }
}

export const fixtureScene = async (name: string): Promise<SceneModel> => {
    const fixture = sceneFixture(name)
    return (await buildSceneFixture(fixture)).scene({ exits: fixture.exits }).scene
}

/** The handles a text names in brackets, in order. */
export const namedHandles = (text: string): SceneHandle[] => [...text.matchAll(/\[([^\]]+)\]/g)].map(([, handle]) => handle)

/** The handles a list of actions names, each once, in order. */
export const actionsHandles = (actions: readonly string[]): SceneHandle[] => [...new Set(actions.flatMap(namedHandles))]

/** The handles listed more than once, each once. */
export const listedTwice = (handles: readonly SceneHandle[]): SceneHandle[] => [...new Set(handles.filter((handle, index) => handles.indexOf(handle) !== index))]

/** The sub-scene's rules as fact and consequence, or none when it has no securing. */
const consequenceRules = (scene: SceneModel): string[] => {
    const lines = judgeRules(scene).map(({ handle, parts }) => `- ${handle}: ${parts.fact} ${parts.consequence}`)
    return lines.length === 0 ? [] : [['Rules:', ...lines].join('\n')]
}

/**
 * The prompt's parts up to the actions: the sub-scene of the shown things and every thing the actions name, so the prompt names nothing
 * the scene doesn't show (mine), then each action in order. The asks add their own parts after.
 */
export const renderSceneAndActions = async (
    { fixture, actions, shown }: { fixture: string; actions: readonly string[]; shown: readonly SceneHandle[] },
    { rules }: ImaginationOptions,
): Promise<string[]> => {
    if (actions.length === 0) {
        throw new Error('No actions')
    }
    const full = await fixtureScene(fixture)
    const named = actionsHandles(actions)
    const unknown = named.filter((handle) => full.things[handle] === undefined)
    if (unknown.length > 0) {
        throw new Error(`The actions name ${unknown.join(', ')}, not in ${fixture}'s scene`)
    }
    const sub = subScene(full, [...new Set([...shown, ...named])])
    const sections = judgeSceneSections(sub)
    return [
        `Scene: ${heading(full)}`,
        sections.fiction,
        sections.graph,
        ...(rules === 'consequence' ? consequenceRules(sub) : []),
        'End of scene.',
        ...actions.map((says, index) => `Action ${index + 1}: ${says}`),
    ]
}

export const thingsLine = (things: readonly SceneHandle[]): string => `The things: ${things.map((handle) => `[${handle}]`).join(', ')}`

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
 * described things and no others, keyed by handle with or without its brackets. A described thing with no line is silent, not a form
 * failure: it keeps its relations and stays in its frame (user, 2026-11-10).
 */
export const checkActionsBlock = (reply: string, actionCount: number, things: readonly SceneHandle[]): string[] => {
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
        ...(given.length === actionCount ? [] : [`expected ${actionCount} actions, got ${given.length}`]),
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
export const caseActions = (id: string): readonly string[] => oracleCases[id].candidates[0].steps.map(({ says }) => says)
export const caseSource = (id: string): string => `oracleCases ${id}, candidate ${oracleCases[id].candidates[0].id}`
