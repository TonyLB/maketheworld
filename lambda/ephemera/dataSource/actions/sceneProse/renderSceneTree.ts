/**
 * Format D (chosen in Slice 3 by SP-7, reopened 2026-11-03 against `fans`): an indented tree whose lines each name their
 * parent by handle, with the kind in words ("on [table1]"), so the structure does not depend on counting indentation.
 * Flat D (a probe candidate, 2026-11-03) is the same lines with no indentation, to test whether the indent's YAML-like
 * register costs the reader anything.
 */
import type { EphemeraHostingKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { SceneEntry, SceneModel } from '../../positions/ludicCache/sceneModel'
import { bracket, conceptText, exitsLine, heading, headText, hostingClause, lineNotes, lineRelations, roomRef } from './sceneWording'

export type Parent = { kind: 'room' } | { kind: 'held' } | { kind: 'thing'; handle: string }

/** The parent clause. A join names the host its parents all belong to (SP-9), not the line it happens to sit under. */
export const parentClause = (scene: SceneModel, entry: SceneEntry, parent: Parent): string => {
    const hostingKind: EphemeraHostingKind = entry.hostingKind
    if (entry.kind === 'join') {
        return hostingClause(hostingKind, bracket(entry.host))
    }
    switch (parent.kind) {
        case 'room': return hostingClause(hostingKind, roomRef(scene))
        case 'held': return hostingClause('Held', 'you')
        case 'thing': return hostingClause(hostingKind, bracket(parent.handle))
    }
}

const renderEntries = (scene: SceneModel, entries: readonly SceneEntry[], parent: Parent, depth: number, step: string): string[] => (
    entries.flatMap((entry) => [
        `${step.repeat(depth)}- ${[
            headText(scene, entry),
            `, ${parentClause(scene, entry, parent)}`,
            ...lineNotes(scene, entry).map((note) => ` ${note}`),
            ...lineRelations(scene, entry).map((phrase) => `, ${phrase}`),
        ].join('')}`,
        ...renderEntries(scene, entry.children, { kind: 'thing', handle: entry.handle }, depth + 1, step),
    ])
)

/** D's lines after the heading and before the exits: the room's contents, the Concepts and what is held. */
export const sceneListLines = (scene: SceneModel, step: string): string[] => {
    const room = roomRef(scene)
    return [
        ...(scene.contents.length === 0
            ? [`Contents of ${room}: nothing.`]
            : [`Contents of ${room}:`, ...renderEntries(scene, scene.contents, { kind: 'room' }, 0, step)]),
        ...(scene.concepts.length === 0 ? [] : ['Concepts here:', ...scene.concepts.map((handle) => `- ${conceptText(scene, handle)}`)]),
        ...(scene.held.length === 0
            ? ['You are holding: nothing.']
            : ['You are holding:', ...renderEntries(scene, scene.held, { kind: 'held' }, 0, step)]),
    ]
}

const renderD = (scene: SceneModel, step: string): string => [
    heading(scene),
    ...sceneListLines(scene, step),
    ...(exitsLine(scene) !== undefined ? [exitsLine(scene) as string] : []),
].join('\n')

export const renderSceneD = (scene: SceneModel): string => renderD(scene, '  ')

export const renderSceneFlatD = (scene: SceneModel): string => renderD(scene, '')
