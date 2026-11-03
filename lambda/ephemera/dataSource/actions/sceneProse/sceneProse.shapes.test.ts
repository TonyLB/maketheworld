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

describe('scene renderer: shapes without a fixture', () => {
    it('nests a chained child that carries a relation, naming each parent', () => {
        const scene = model({
            contents: [line('table1', 'In', [line('box1', 'On', [line('bag1', 'In')])])],
            things: {
                table1: thing('Table'),
                box1: thing('Box'),
                bag1: thing('Bag', [{ kind: 'Custom', label: 'tied to', target: { kind: 'notShown' }, secured: false }]),
            },
        })
        expect(renderScene(scene)).toBe([
            'The room',
            'Contents of the room:',
            '- [table1] Table, in the room',
            '  - [box1] Box, on [table1]',
            '    - [bag1] Bag, in [box1], tied to something not shown here',
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
        expect(renderScene(scene)).toBe([
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
        expect(renderScene(scene)).toContain('- [object1] (unnamed object), in the room\n- [rope1] Rope, in the room\n')
    })
})
