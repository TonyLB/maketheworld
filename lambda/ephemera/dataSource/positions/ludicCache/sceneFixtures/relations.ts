/**
 * Scenes about relations (corpus scenes 8 and 11): a tie beside a bare `Custom` edge and a bare `SecuredTo`, and a
 * relation to a thing with no short name.
 */
import { binding, characterId, hostGraph, member, objectId, roomId, type SceneFixture } from './worldBuilders'

const actor = characterId('Actor')

const dock = roomId('Dock')
const [post, boat, crate, ladder, barrel] = ['Post', 'Boat', 'Crate', 'Ladder', 'Barrel'].map(objectId)

export const dockScene: SceneFixture = {
    name: 'dock',
    description: 'A tie (Custom, SecuredTo and the Justifies between them), a bare Custom edge, and a bare SecuredTo whose Custom was dissolved.',
    roomId: dock,
    actorId: actor,
    graphs: [
        hostGraph(dock, [
            ...[post, boat, crate, ladder, barrel].map((id) => member(id, 'In')),
            binding('Base', [], [post, boat, crate, ladder, barrel].map((id) => [id, 'inDock'] as const)),
        ], {
            edges: [
                { tag: 'Relational', edgeId: 'e1', from: boat, to: post, kind: 'Custom', relationLabel: 'tied to' },
                { tag: 'Relational', edgeId: 'e2', from: boat, to: post, kind: 'SecuredTo' },
                { tag: 'Relational', edgeId: 'e3', from: { edgeId: 'e1' }, to: { edgeId: 'e2' }, kind: 'Justifies' },
                { tag: 'Relational', edgeId: 'e4', from: ladder, to: crate, kind: 'Custom', relationLabel: 'leaning against' },
                { tag: 'Relational', edgeId: 'e5', from: barrel, to: post, kind: 'SecuredTo' },
            ],
        }),
        ...[post, boat, crate, ladder, barrel].map((id) => hostGraph(id, [binding('inDock', [[dock, 'Base']])])),
        hostGraph(actor, [binding('inRoom', [[dock, 'Base']])]),
    ],
    names: {
        [dock]: { shortName: 'Dock' },
        [post]: { shortName: 'Post' },
        [boat]: { shortName: 'Boat' },
        [crate]: { shortName: 'Crate' },
        [ladder]: { shortName: 'Ladder' },
        [barrel]: { shortName: 'Barrel' },
    },
    questions: [
        { type: 'relatedFrom', target: 'post1', label: 'tied to' },
        { type: 'securedTo', target: 'post1' },
        { type: 'relatedTo', subject: 'ladder1', label: 'leaning against' },
        { type: 'movesWith', subject: 'crate1' },
        { type: 'securedTo', target: 'post1', asked: 'Can [post1] be taken as things stand?' },
    ],
}

const shed = roomId('Shed')
const thing = objectId('Thing')
const key = objectId('Key')
const lantern = objectId('Lantern')

export const unnamedScene: SceneFixture = {
    name: 'unnamed',
    description: 'A node with no short name that is both a container and a relation end.',
    roomId: shed,
    actorId: actor,
    graphs: [
        hostGraph(shed, [
            member(thing, 'In'), member(lantern, 'In'),
            binding('Base', [], [[thing, 'inShed'], [lantern, 'inShed']]),
        ], {
            edges: [{ tag: 'Relational', from: lantern, to: thing, kind: 'Custom', relationLabel: 'hanging from' }],
        }),
        hostGraph(thing, [member(key, 'In'), binding('inShed', [[shed, 'Base']], [[key, 'inThing']])]),
        hostGraph(key, [binding('inThing', [[thing, 'inShed']])]),
        hostGraph(lantern, [binding('inShed', [[shed, 'Base']])]),
        hostGraph(actor, [binding('inRoom', [[shed, 'Base']])]),
    ],
    names: {
        [shed]: { shortName: 'Shed' },
        [key]: { shortName: 'Key' },
        [lantern]: { shortName: 'Lantern' },
    },
    questions: [
        { type: 'placedOn', subject: 'key1' },
        { type: 'relatedTo', subject: 'lantern1', label: 'hanging from' },
        { type: 'movesWith', subject: 'object1' },
    ],
}
