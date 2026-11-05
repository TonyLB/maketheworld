/**
 * The Rules section (user, 2026-11-04; SP-10, reopening the foreground for the judge): one sentence per securing in the scene, naming
 * its things by handle and saying what it does and does not bind. Code applies the rule, because the scene model knows the
 * arrangement; the frame no longer teaches it. A general `SECURED` passage was tried first and made things worse: Nova Micro refused
 * every case, and both Nova models reasoned "the table cannot be moved without also moving the teapot, so it cannot be moved".
 *
 * The two ends are not restricted alike. Moving a host cannot change where its child sits relative to it, so a securing between
 * them binds only the child. Two things with neither hosting the other have no such guarantee, so it binds either one moved alone.
 * What it permits depends on the link, so the relation's own words stay in the rule, named as the securing's fictional cause. The base
 * render keeps the relation where it was, in the form `[teapot1] glued to [table1]`, and loses its "secured" mark, which English cannot
 * scope to one clause of a line (user, 2026-11-04); `withoutSecuredMark` does that. A cascade (a thing also secured to something
 * outside what is moved) is not stated. A scene with no securing has no section. The wording is provisional.
 */
import type { SceneHandle, SceneModel, SceneRelation, SceneRelationTarget } from '../../positions/ludicCache/sceneModel'
import { sceneEntries } from './renderSceneRegisters'
import { bracket, hostingClause } from './sceneWording'

/** A relation's own words, if it secures its subject. */
const securingWords = (relation: SceneRelation): string | undefined => {
    if (relation.kind === 'Custom') {
        return relation.secured ? relation.label : undefined
    }
    return relation.kind === 'SecuredTo' ? 'secured to' : undefined
}

/** The scene as a base render should show it beside the Rules section: each tie's relation stays, without its `secured` mark. */
export const withoutSecuredMark = (scene: SceneModel): SceneModel => ({
    ...scene,
    things: Object.fromEntries(Object.entries(scene.things).map(([handle, thing]) => [handle, {
        ...thing,
        relations: thing.relations.map((relation) => (relation.kind === 'Custom' ? { ...relation, secured: false } : relation)),
    }])),
})

/**
 * The rule as what each move does, with no "relative to" (user, 2026-11-04), a temporary branch for `rulesAction`. "Moving X relative to
 * Y" is symmetric as a phrase, and the replies swapped its ends ("the table is glued to the teapot") and read a host's move as relative
 * movement, 10 of 10 on picking up the table. Handles in place of pronouns, since those are where direction slips.
 */
const actionRule = (subject: SceneHandle, target: SceneRelationTarget, hosts: Map<SceneHandle, Set<SceneHandle>>): string => {
    if (target.kind !== 'thing') {
        return `${bracket(subject)} cannot leave what it is secured to until ${bracket(subject)} is freed.`
    }
    const other = target.handle
    const hosted = (child: SceneHandle, host: SceneHandle): string => (
        `${bracket(child)} cannot leave ${bracket(host)} until ${bracket(child)} is freed. ${bracket(host)} can still be moved, because that defaults to moving ${bracket(child)} with ${bracket(host)}.`
    )
    if (hosts.get(subject)?.has(other)) {
        return hosted(subject, other)
    }
    if (hosts.get(other)?.has(subject)) {
        return hosted(other, subject)
    }
    return `${bracket(subject)} and ${bracket(other)} cannot be moved apart until they are freed. They can still be moved together.`
}

/** What directly hosts each thing: a thing in several places has several. */
const hostsOf = (scene: SceneModel): Map<SceneHandle, Set<SceneHandle>> => sceneEntries(scene).reduce((hosts, entry) => {
    const pairs: [SceneHandle, SceneHandle][] = [
        ...entry.children.map((child): [SceneHandle, SceneHandle] => [child.handle, entry.handle]),
        ...(entry.kind === 'join' ? [[entry.handle, entry.host] as [SceneHandle, SceneHandle]] : []),
    ]
    pairs.forEach(([child, host]) => hosts.set(child, new Set([...(hosts.get(child) ?? []), host])))
    return hosts
}, new Map<SceneHandle, Set<SceneHandle>>())

/** The securing itself, and its fictional cause where the relation has words of its own. */
const securingClause = (subject: SceneHandle, target: string, words: string): string => (
    words === 'secured to' ? `${bracket(subject)} is secured to ${target}.` : `${bracket(subject)} is secured to ${target}; its fictional cause is "${words}".`
)

const hostedRule = (child: SceneHandle, host: SceneHandle, words: string): string => (
    `Prevents moving ${bracket(child)} relative to ${bracket(host)} more than "${words}" would permit. Does not prevent moving ${bracket(host)} and its contents as a whole.`
)

const actionSentences = (scene: SceneModel): string[] => {
    const hosts = hostsOf(scene)
    return Object.entries(scene.things).flatMap(([subject, { relations }]) => relations.flatMap((relation) => (
        securingWords(relation) === undefined || relation.kind === 'Associated' ? [] : [actionRule(subject, relation.target, hosts)]
    )))
}

const ruleSentences = (scene: SceneModel): string[] => {
    const hosts = hostsOf(scene)
    return Object.entries(scene.things).flatMap(([subject, { relations }]) => relations.flatMap((relation) => {
        const words = securingWords(relation)
        if (words === undefined || relation.kind === 'Associated') {
            return []
        }
        if (relation.target.kind !== 'thing') {
            return [`${securingClause(subject, 'what is not shown here', words)} Prevents moving ${bracket(subject)} away from it more than "${words}" would permit.`]
        }
        const target = relation.target.handle
        if (hosts.get(subject)?.has(target)) {
            return [`${securingClause(subject, bracket(target), words)} ${hostedRule(subject, target, words)}`]
        }
        if (hosts.get(target)?.has(subject)) {
            return [`${securingClause(subject, bracket(target), words)} ${hostedRule(target, subject, words)}`]
        }
        return [`${securingClause(subject, bracket(target), words)} Prevents moving ${bracket(subject)} or ${bracket(target)} relative to the other more than "${words}" would permit. Does not prevent moving them together.`]
    }))
}

export const rulesLines = (scene: SceneModel, style: 'relative' | 'action' = 'relative'): string[] => {
    const sentences = style === 'action' ? actionSentences(scene) : ruleSentences(scene)
    return sentences.length === 0
        ? []
        : ['Rules. Check the handles you are reasoning over, and consult only the rules that touch upon them.', ...sentences.map((sentence) => `- ${sentence}`)]
}

/**
 * The judge's Rules section (judgePrompt plan, v24; notes 8 and 21): each rule states its constraint plainly, with no "until" clause
 * and no instruction in front of the list, since `Reading the scene` has already said what rules are and that a player can set out to
 * change the facts behind one. The hosted sentence is the agreed text. The other two are derived from it and were not agreed
 * (M26): the pair and the not-shown cases say what cannot be done, and the pair what still can. Returns the lines of a `Rules:` section,
 * or none when the scene has no securing.
 */
const judgeRule = (subject: SceneHandle, target: SceneRelationTarget, hosts: Map<SceneHandle, Set<SceneHandle>>, scene: SceneModel): string => {
    if (target.kind !== 'thing') {
        return `${bracket(subject)} cannot leave what it is secured to.`
    }
    const other = target.handle
    const hosted = (child: SceneHandle, host: SceneHandle): string => {
        const kind = sceneEntries(scene).find((entry) => entry.handle === host)?.children.find((member) => member.handle === child)?.hostingKind
        return `${bracket(child)} cannot leave ${bracket(host)}. Moving ${bracket(host)} gives no reason to doubt that ${bracket(child)} is ${hostingClause(kind ?? 'On', bracket(host))}.`
    }
    if (hosts.get(subject)?.has(other)) {
        return hosted(subject, other)
    }
    if (hosts.get(other)?.has(subject)) {
        return hosted(other, subject)
    }
    return `${bracket(subject)} and ${bracket(other)} cannot be moved apart. They can still be moved together.`
}

export const judgeRulesLines = (scene: SceneModel): string[] => {
    const hosts = hostsOf(scene)
    const sentences = Object.entries(scene.things).flatMap(([subject, { relations }]) => relations.flatMap((relation) => (
        securingWords(relation) === undefined || relation.kind === 'Associated' ? [] : [judgeRule(subject, relation.target, hosts, scene)]
    )))
    return sentences.length === 0 ? [] : ['Rules:', ...sentences.map((sentence) => `- ${sentence}`)]
}
