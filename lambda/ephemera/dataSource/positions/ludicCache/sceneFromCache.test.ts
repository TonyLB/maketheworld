/**
 * The scene model (sceneProjection Slice 1), asserted as structure, never as prose. Each fixture is folded through the
 * production path (`buildSceneFixture`), so these pin what the actor's cache yields, not a hand-written cache. The last
 * block builds caches by hand for the shapes no fixture has.
 */
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraHostingKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { sceneFromCache } from './sceneFromCache'
import type { SceneEntry, SceneLine, SceneLocation, SceneRelation, SceneResult } from './sceneModel'
import { buildSceneFixture, sceneFixture } from './sceneFixtures'
import type { EphemeraLudicCacheCoverEntry, EphemeraLudicCacheData, EphemeraLudicCacheNode } from './types'

const sceneOf = async (name: string): Promise<SceneResult> => {
    const fixture = sceneFixture(name)
    return (await buildSceneFixture(fixture)).scene({ exits: fixture.exits })
}

/** A line with the defaults of a thing placed once: first, nothing elsewhere, no joins. */
const line = (handle: string, hostingKind: EphemeraHostingKind, children: SceneEntry[] = [], extra: Partial<SceneLine> = {}): SceneLine => ({
    kind: 'line', handle, hostingKind, first: true, elsewhere: [], joins: [], children, ...extra,
})
const on = (handle: string, hostingKind: EphemeraHostingKind = 'On'): SceneLocation => ({ kind: 'thing', handle, hostingKind })
const tied = (handle: string, secured = false): SceneRelation => ({ kind: 'Custom', label: 'tied to', target: { kind: 'thing', handle }, secured })
const relationsOf = (result: SceneResult) => Object.fromEntries(
    Object.entries(result.scene.things).flatMap(([handle, { relations }]) => relations.length > 0 ? [[handle, relations]] : [])
)

describe('sceneFromCache', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it('the tavern: a nested subtree, the room\'s name and gloss, held inventory, exits and the handle table', async () => {
        const { scene, handles } = await sceneOf('tavern')

        expect(scene.room).toEqual({ name: 'Tavern', gloss: 'A low-beamed common room, smoky from the hearth.' })
        expect(scene.contents).toEqual([
            line('table1', 'In', [
                line('saucer1', 'On', [line('cup1', 'On')]),
                line('candle1', 'On'),
            ]),
        ])
        expect(scene.concepts).toEqual([])
        expect(scene.held).toEqual([line('hammer1', 'Held')])
        expect(scene.exits).toEqual([{ name: 'north', to: 'Street' }])
        expect(scene.things.cup1).toEqual({ kind: 'Object', name: 'Cup', gloss: 'a red tin cup, fist-sized, light', relations: [] })
        expect(handles).toEqual([
            { handle: 'table1', id: 'OBJECT#Table' },
            { handle: 'saucer1', id: 'OBJECT#Saucer' },
            { handle: 'cup1', id: 'OBJECT#Cup' },
            { handle: 'candle1', id: 'OBJECT#Candle' },
            { handle: 'hammer1', id: 'OBJECT#Hammer' },
        ])
    })

    it('a sibling fan, and a fan inside a fan', async () => {
        expect((await sceneOf('siblingFan')).scene.contents).toEqual([
            line('table1', 'In', ['fork1', 'knife1', 'plate1', 'cup1'].map((handle) => line(handle, 'On'))),
        ])
        expect((await sceneOf('branchInBranch')).scene.contents).toEqual([
            line('table1', 'In', [
                line('saucer1', 'On', [line('cup1', 'On')]),
                line('candle1', 'On'),
                line('tray1', 'On', [line('teapot1', 'On'), line('jug1', 'On')]),
            ]),
        ])
    })

    it('a deep chain keeps each level\'s kind', async () => {
        expect((await sceneOf('deepChain')).scene.contents).toEqual([
            line('table1', 'In', [line('box1', 'On', [line('bag1', 'In', [line('coin1', 'In')])])]),
        ])
    })

    it('the Lab: a composed crossing, a Concept listed apart with its member pointing to it, and a far end left unrendered', async () => {
        const result = await sceneOf('lab')
        const { scene, handles } = result

        expect(scene.contents).toEqual([
            line('box1', 'In', [line('cup1', 'In'), line('spring1', 'In')]),
            line('hook1', 'In'),
            line('rope1', 'In', [line('end1', 'SectionOf')], { elsewhere: [{ kind: 'otherRoom' }] }),
        ])
        expect(scene.concepts).toEqual(['contraption1'])
        expect(scene.things.contraption1).toEqual({ kind: 'Concept', name: 'Contraption', gloss: 'a half-built mousetrap mechanism', relations: [] })
        expect(relationsOf(result)).toEqual({
            spring1: [{ kind: 'Associated', target: { kind: 'thing', handle: 'contraption1' } }],
            hook1: [tied('rope1')],
            rope1: [tied('cup1')],
        })
        // The far end (under the binding in the Hall) has no line and no handle; the ConnectedTo between the ends gives no relation.
        expect(handles.map(({ id }) => id)).not.toContain('OBJECT#RopeEndB')
        expect(scene.exits).toEqual([{ name: 'east', to: 'Hall' }])
    })

    it('held inventory and a half-held rope: one handle, a line per binding, relations on its first line only', async () => {
        const result = await sceneOf('heldInventory')

        expect(result.scene.contents).toEqual([
            line('table1', 'In', [
                line('lamp1', 'On'),
                line('rope1', 'On', [], { elsewhere: [{ kind: 'held' }] }),
            ]),
        ])
        expect(result.scene.held).toEqual([
            line('bag1', 'Held', [line('coin1', 'In')]),
            line('rope1', 'Held', [], { first: false, elsewhere: [on('table1')] }),
        ])
        expect(relationsOf(result)).toEqual({
            lamp1: [{ kind: 'Custom', label: 'is near', target: { kind: 'thing', handle: 'rope1' }, secured: false }],
            rope1: [tied('coin1')],
        })
    })

    it('two things with one short name are numbered where each is placed', async () => {
        const { scene, handles } = await sceneOf('twoCups')

        expect(scene.contents).toEqual([line('table1', 'In', [line('cup1', 'On')]), line('cup2', 'In')])
        expect(handles).toEqual([
            { handle: 'table1', id: 'OBJECT#Table' },
            { handle: 'cup1', id: 'OBJECT#CupA' },
            { handle: 'cup2', id: 'OBJECT#CupB' },
        ])
    })

    it('a tie is one secured relation, a bare Custom keeps its label, and a bare SecuredTo stands alone', async () => {
        expect(relationsOf(await sceneOf('dock'))).toEqual({
            boat1: [tied('post1', true)],
            ladder1: [{ kind: 'Custom', label: 'leaning against', target: { kind: 'thing', handle: 'crate1' }, secured: false }],
            barrel1: [{ kind: 'SecuredTo', target: { kind: 'thing', handle: 'post1' } }],
        })
    })

    it('an open leg is named by its far owner; a composed crossing names the thing', async () => {
        expect(relationsOf(await sceneOf('openLegs')).table1).toEqual([
            tied('bag1'),
            { kind: 'Custom', label: 'tied to', target: { kind: 'someoneElse' }, secured: false },
        ])
    })

    it('a draped cloth: one handle on two lines, each noting the other', async () => {
        expect((await sceneOf('drapedCloth')).scene.contents).toEqual([
            line('table1', 'In', [line('cloth1', 'On', [], { elsewhere: [{ kind: 'room' }] })]),
            line('cloth1', 'In', [], { first: false, elsewhere: [on('table1')] }),
        ])
    })

    it('a node with no short name takes its kind as its handle and has no name', async () => {
        const result = await sceneOf('unnamed')

        expect(result.scene.contents).toEqual([line('object1', 'In', [line('key1', 'In')]), line('lantern1', 'In')])
        expect(result.scene.things.object1).toEqual({ kind: 'Object', relations: [] })
        expect(relationsOf(result)).toEqual({
            lantern1: [{ kind: 'Custom', label: 'hanging from', target: { kind: 'thing', handle: 'object1' }, secured: false }],
        })
    })

    it('an empty room', async () => {
        const { scene, handles } = await sceneOf('emptyRoom')

        expect(scene).toEqual({ room: { name: 'Cellar' }, contents: [], concepts: [], held: [], exits: [], things: {} })
        expect(handles).toEqual([])
    })

    it('the steamer chest: placed once, associated with two Concepts, which are never placed', async () => {
        const result = await sceneOf('steamerChest')

        expect(result.scene.contents).toEqual([
            line('steamer-chest1', 'In', [
                line('backgammon-set1', 'In', [line('die1', 'In')]),
                line('chess-set1', 'In'),
            ]),
        ])
        expect(result.scene.concepts).toEqual(['inherited-furniture1', 'boardgames1'])
        expect(result.scene.held).toEqual([line('spare-die1', 'Held')])
        expect(relationsOf(result)).toEqual({
            'steamer-chest1': [
                { kind: 'Associated', target: { kind: 'thing', handle: 'inherited-furniture1' } },
                { kind: 'Associated', target: { kind: 'thing', handle: 'boardgames1' } },
            ],
        })
    })

    it('a join is described once, after the last of its parent lines, and each parent line refers to it (SP-9)', async () => {
        const { scene, handles } = await sceneOf('join')

        expect(scene.contents).toEqual([
            line('table-a1', 'In', [
                line('tablecloth1', 'On', [], { elsewhere: [on('table-b1')], joins: ['fruit-bowl1'] }),
            ]),
            line('table-b1', 'In', [
                line('tablecloth1', 'On', [line('napkin1', 'On')], { first: false, elsewhere: [on('table-a1')], joins: ['fruit-bowl1'] }),
                {
                    kind: 'join',
                    handle: 'fruit-bowl1',
                    hostingKind: 'On',
                    first: true,
                    elsewhere: [],
                    host: 'tablecloth1',
                    across: [on('table-a1'), on('table-b1')],
                    children: [line('apple1', 'In')],
                },
            ]),
        ])
        expect(handles.map(({ handle }) => handle)).toEqual(['table-a1', 'tablecloth1', 'table-b1', 'napkin1', 'fruit-bowl1', 'apple1', 'pear1'])
    })

    it('a Feature is placed like an object, with what it hosts under it', async () => {
        const { scene } = await sceneOf('feature')

        expect(scene.contents).toEqual([line('altar1', 'PartOf', [line('candle1', 'On')]), line('hymnal1', 'In')])
        expect(scene.things.altar1).toEqual({ kind: 'Feature', name: 'Altar', gloss: 'a slab of grey stone', relations: [] })
    })

    describe('shapes no fixture has', () => {
        const room = 'ROOM#Yard' as EphemeraRoomId
        const actor = 'CHARACTER#Actor' as EphemeraCharacterId
        const crate = 'OBJECT#Crate' as EphemeraObjectId
        const pole = 'OBJECT#Pole' as EphemeraObjectId
        const base = 'PRESENCE#Base' as EphemeraPresenceNodeId
        const inYard = 'PRESENCE#inYard' as EphemeraPresenceNodeId
        const node = (universalKey: string, shortName: string | undefined, presenceNodes: EphemeraLudicCacheNode['presenceNodes'] = []): EphemeraLudicCacheNode => (
            { tag: universalKey.startsWith('ROOM#') ? 'Room' : universalKey.startsWith('CHARACTER#') ? 'Character' : 'Object', universalKey, ...(shortName !== undefined ? { shortName } : {}), presenceNodes } as EphemeraLudicCacheNode
        )
        const yard = (edges: EphemeraLudicCacheData['edges'], members: EphemeraLudicCacheCoverEntry[] = [{ host: crate, presence: inYard, hostingKind: 'In' }]): EphemeraLudicCacheData => ({
            hostId: room,
            nodes: [
                node(room, 'Yard', [{ tag: 'Presence', universalKey: base, fromHostPresences: [], cover: { members } }]),
                node(crate, 'Crate', [{ tag: 'Presence', universalKey: inYard, fromHostPresences: [{ host: room, presence: base }], cover: { members: [] } }]),
                node(pole, 'Pole', [{ tag: 'Presence', universalKey: inYard, fromHostPresences: [{ host: room, presence: base }], cover: { members: [] } }]),
            ],
            edges,
        })
        const endHosts = { from: room, to: room }

        it('an open leg into a thing in the scene reads as inside it, and one into another room as another room', () => {
            const { scene } = sceneFromCache(yard([
                { tag: 'Relational', from: pole, to: { owner: crate, port: 'PORT-a' }, kind: 'Custom', relationLabel: 'tied to', endHosts },
                { tag: 'Relational', from: crate, to: { owner: 'ROOM#Elsewhere' as EphemeraRoomId, port: 'PORT-b' }, kind: 'Custom', relationLabel: 'tied to', endHosts },
            ], [{ host: crate, presence: inYard, hostingKind: 'In' }, { host: pole, presence: inYard, hostingKind: 'In' }]), { roomId: room, actorId: actor })

            expect(scene.things.pole1.relations).toEqual([{ kind: 'Custom', label: 'tied to', target: { kind: 'inside', handle: 'crate1' }, secured: false }])
            expect(scene.things.crate1.relations).toEqual([{ kind: 'Custom', label: 'tied to', target: { kind: 'otherRoom' }, secured: false }])
        })

        it('a relation to a thing with no line names it as not shown, and one from a thing with no line is left out', () => {
            const { scene } = sceneFromCache(yard([
                { tag: 'Relational', from: crate, to: pole, kind: 'Custom', relationLabel: 'leaning on', endHosts },
                { tag: 'Relational', from: pole, to: crate, kind: 'Custom', relationLabel: 'propping', endHosts },
            ]), { roomId: room, actorId: actor })

            expect(scene.things.crate1.relations).toEqual([{ kind: 'Custom', label: 'leaning on', target: { kind: 'notShown' }, secured: false }])
            expect(scene.things.pole1).toBeUndefined()
        })

        it('a cover entry that names no binding gives a line with nothing under it', () => {
            const { scene } = sceneFromCache(yard([], [{ host: crate }]), { roomId: room, actorId: actor })

            // No kind on the entry: the arrival default for an object in a room. No binding named: nothing claimed elsewhere.
            expect(scene.contents).toEqual([line('crate1', 'In')])
        })
    })
})
