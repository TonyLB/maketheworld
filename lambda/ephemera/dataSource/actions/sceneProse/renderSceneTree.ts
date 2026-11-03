/**
 * Format D (chosen in Slice 3 by SP-7, reopened 2026-11-03 against `fans`): an indented tree whose lines each name their
 * parent by handle, with the kind in words ("on [table1]"), so the structure does not depend on counting indentation.
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

const renderEntries = (scene: SceneModel, entries: readonly SceneEntry[], parent: Parent, depth: number): string[] => (
    entries.flatMap((entry) => [
        `${'  '.repeat(depth)}- ${[
            headText(scene, entry),
            `, ${parentClause(scene, entry, parent)}`,
            ...lineNotes(scene, entry).map((note) => ` ${note}`),
            ...lineRelations(scene, entry).map((phrase) => `, ${phrase}`),
        ].join('')}`,
        ...renderEntries(scene, entry.children, { kind: 'thing', handle: entry.handle }, depth + 1),
    ])
)

export const renderSceneD = (scene: SceneModel): string => {
    const room = roomRef(scene)
    const lines = [
        heading(scene),
        ...(scene.contents.length === 0
            ? [`Contents of ${room}: nothing.`]
            : [`Contents of ${room}:`, ...renderEntries(scene, scene.contents, { kind: 'room' }, 0)]),
        ...(scene.concepts.length === 0 ? [] : ['Concepts here:', ...scene.concepts.map((handle) => `- ${conceptText(scene, handle)}`)]),
        ...(scene.held.length === 0
            ? ['You are holding: nothing.']
            : ['You are holding:', ...renderEntries(scene, scene.held, { kind: 'held' }, 0)]),
        ...(exitsLine(scene) !== undefined ? [exitsLine(scene) as string] : []),
    ]
    return lines.join('\n')
}
