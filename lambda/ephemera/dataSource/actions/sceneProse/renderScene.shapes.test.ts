/** Shapes no scene fixture has, rendered from hand-built scene models. */
import type { SceneEntry, SceneLine, SceneModel, SceneRelation, SceneThing } from '../../positions/ludicCache/sceneModel'
import { renderScene } from '.'

const line = (handle: string, hostingKind: SceneLine['hostingKind'], children: SceneEntry[] = [], extra: Partial<SceneLine> = {}): SceneLine => ({
    kind: 'line', handle, hostingKind, first: true, elsewhere: [], joins: [], children, ...extra,
})
const thing = (name: string, relations: SceneRelation[] = []): SceneThing => ({ kind: 'Object', name, relations })
const model = (partial: Partial<SceneModel> & Pick<SceneModel, 'things'>): SceneModel => ({
    room: {}, contents: [], concepts: [], held: [], exits: [], ...partial,
})

describe('scene renderers: shapes without a fixture', () => {
    it('hoists a one-deep chain into its parent\'s block in blocksD, relation and all, and promotes a two-deep one', () => {
        const scene = model({
            contents: [line('table1', 'In', [line('box1', 'On', [line('bag1', 'In')])])],
            things: {
                table1: thing('Table'),
                box1: thing('Box'),
                bag1: thing('Bag', [{ kind: 'Custom', label: 'tied to', target: { kind: 'notShown' }, secured: false }]),
            },
        })
        expect(renderScene('blocksD', scene)).toBe([
            'The room',
            'In the room:',
            '- [table1] Table, in the room (see below)',
            'On [table1]:',
            '- [box1] Box, on [table1]',
            '- [bag1] Bag, in [box1], tied to something not shown here',
            'You are holding: nothing.',
        ].join('\n'))
    })

    it('in blocksDLabelled, gives a two-deep run a layers block that hands off to a fan block where it fans out, and a one-deep chain a fan block', () => {
        const scene = model({
            contents: [line('table1', 'In', [
                line('box1', 'On', [line('bag1', 'In', [line('pouch1', 'In', [line('coin1', 'In'), line('ring1', 'In')])])]),
                line('mug1', 'On', [line('coffee1', 'In')]),
            ])],
            things: {
                table1: thing('Table'), box1: thing('Box'), bag1: thing('Bag'), pouch1: thing('Pouch'),
                coin1: thing('Coin'), ring1: thing('Ring'), mug1: thing('Mug'), coffee1: thing('Coffee'),
            },
        })
        expect(renderScene('blocksDLabelled', scene)).toBe([
            'The room',
            'Directly in the room:',
            '- [table1] Table, in the room (see below)',
            'Directly on [table1]:',
            '- [box1] Box, on [table1] (see below)',
            '- [mug1] Mug, on [table1] (see below)',
            '[box1] and what is on or in it, in layers:',
            '- [bag1] Bag, in [box1]',
            '- [pouch1] Pouch, in [bag1] (see below)',
            'Directly in [pouch1]:',
            '- [coin1] Coin, in [pouch1]',
            '- [ring1] Ring, in [pouch1]',
            'Directly in [mug1]:',
            '- [coffee1] Coffee, in [mug1]',
            'You are holding: nothing.',
        ].join('\n'))
    })

    it('promotes a chained child that carries a relation, in Blocks (and nests it plainly in A and D)', () => {
        const scene = model({
            contents: [line('table1', 'In', [line('box1', 'On', [line('bag1', 'In')])])],
            things: {
                table1: thing('Table'),
                box1: thing('Box'),
                bag1: thing('Bag', [{ kind: 'Custom', label: 'tied to', target: { kind: 'notShown' }, secured: false }]),
            },
        })
        expect(renderScene('blocks', scene)).toBe([
            'The room',
            'In the room: [table1] Table (see below).',
            'On [table1]: [box1] Box (see below).',
            'In [box1]: [bag1] Bag, tied to something not shown here.',
            'You are holding: nothing.',
        ].join('\n'))
        expect(renderScene('A', scene)).toBe([
            'The room',
            'Contents of the room:',
            '- [table1] Table',
            '  - [box1] Box',
            '    - [bag1] Bag, tied to something not shown here',
            'You are holding: nothing.',
        ].join('\n'))
    })

    it('gives members of different hosting kinds a block each, in first-appearance order', () => {
        const scene = model({
            room: { name: 'Chapel' },
            contents: [line('hymnal1', 'In'), line('altar1', 'PartOf'), line('pew1', 'In')],
            things: { hymnal1: thing('Hymnal'), altar1: thing('Altar'), pew1: thing('Pew') },
        })
        expect(renderScene('blocks', scene)).toBe([
            'The Chapel',
            'In the Chapel: [hymnal1] Hymnal; [pew1] Pew.',
            'Parts of the Chapel: [altar1] Altar.',
            'You are holding: nothing.',
        ].join('\n'))
    })

    it('words open legs, other bindings held by someone else, and several exits', () => {
        const scene = model({
            room: { name: 'Yard' },
            contents: [line('cart1', 'In', [], { elsewhere: [{ kind: 'someoneElse' }, { kind: 'otherRoom' }] })],
            exits: [{ name: 'north', to: 'Street' }, { name: 'east', to: 'Hall' }],
            things: {
                cart1: thing('Cart', [
                    { kind: 'Custom', label: 'tied to', target: { kind: 'inside', handle: 'cart1' }, secured: false },
                    { kind: 'Custom', label: 'tied to', target: { kind: 'otherRoom' }, secured: true },
                    { kind: 'SecuredTo', target: { kind: 'someoneElse' } },
                ]),
            },
        })
        expect(renderScene('D', scene)).toBe([
            'The Yard',
            'Contents of the Yard:',
            '- [cart1] Cart, in the Yard (also held by someone else) (also in another room), tied to something inside [cart1], tied to something in another room, secured, secured to something someone else is holding',
            'You are holding: nothing.',
            'Exits: north to the Street, east to the Hall.',
        ].join('\n'))
    })

    it('shows a thing with no name and no gloss as its kind, and a gloss on its first line only', () => {
        const scene = model({
            contents: [line('object1', 'In'), line('rope1', 'In', [], { first: false })],
            things: { object1: { kind: 'Object', relations: [] }, rope1: { kind: 'Object', name: 'Rope', gloss: 'a coil', relations: [] } },
        })
        expect(renderScene('A', scene)).toContain('- [object1] (unnamed object)\n- [rope1] Rope\n')
    })
})
