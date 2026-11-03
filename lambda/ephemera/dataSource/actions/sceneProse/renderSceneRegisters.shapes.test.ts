/** Shapes no scene fixture has, and the rules behind the foreground and the examples, on hand-built scene models. */
import type { SceneEntry, SceneLine, SceneModel, SceneRelation, SceneThing } from '../../positions/ludicCache/sceneModel'
import { renderScene } from '.'
import { exampleHandles } from './renderSceneRegisters'

const line = (handle: string, hostingKind: SceneLine['hostingKind'], children: SceneEntry[] = [], extra: Partial<SceneLine> = {}): SceneLine => ({
    kind: 'line', handle, hostingKind, first: true, elsewhere: [], joins: [], children, ...extra,
})
const thing = (name: string, relations: SceneRelation[] = []): SceneThing => ({ kind: 'Object', name, relations })
const model = (partial: Partial<SceneModel> & Pick<SceneModel, 'things'>): SceneModel => ({
    room: {}, contents: [], concepts: [], held: [], exits: [], ...partial,
})
const secured = (handle: string, label = 'tied to'): SceneRelation => ({ kind: 'Custom', label, target: { kind: 'thing', handle }, secured: true })

describe('multi-register renders: shapes without a fixture', () => {
    it('states a bare SecuredTo and a secured tie alike, and nothing for an unsecured relation', () => {
        const scene = model({
            contents: [line('post1', 'In'), line('rope1', 'In'), line('lamp1', 'In'), line('mat1', 'In')],
            things: {
                post1: thing('Post'),
                rope1: thing('Rope', [secured('post1')]),
                lamp1: thing('Lamp', [{ kind: 'SecuredTo', target: { kind: 'thing', handle: 'mat1' } }]),
                mat1: thing('Mat'),
            },
        })
        const text = renderScene(scene, 'affordance')
        expect(text).toContain('- [rope1] and [post1] cannot be moved while [rope1] is tied to [post1].')
        expect(text).toContain('- [lamp1] and [mat1] cannot be moved while [lamp1] is secured to [mat1].')
        const unsecured = model({
            contents: [line('post1', 'In'), line('rope1', 'In')],
            things: { post1: thing('Post'), rope1: thing('Rope', [{ kind: 'Custom', label: 'tied to', target: { kind: 'thing', handle: 'post1' }, secured: false }]) },
        })
        expect(renderScene(unsecured, 'affordance')).toBe(renderScene(unsecured, 'registers'))
    })

    it('states no travel for a thing spread over several hosts, or with a spread thing under it', () => {
        const scene = model({
            contents: [
                line('table1', 'In', [line('cloth1', 'On', [], { elsewhere: [{ kind: 'otherRoom' }] })]),
                line('chest1', 'In', [line('box1', 'In')]),
            ],
            things: { table1: thing('Table'), cloth1: thing('Cloth'), chest1: thing('Chest'), box1: thing('Box') },
        })
        const text = renderScene(scene, 'affordance')
        expect(text).not.toContain('Moving [table1]')
        expect(text).toContain('Moving [chest1] also moves [box1].')
    })

    it('words a held thing, an empty room and a part, and leaves the examples out when no shape fits', () => {
        const scene = model({
            room: { name: 'Yard' },
            held: [line('bag1', 'Held')],
            contents: [line('chair1', 'In', [line('arm1', 'PartOf')])],
            things: { bag1: thing('Bag'), chair1: thing('Chair'), arm1: thing('Arm') },
        })
        const text = renderScene(scene, 'registers')
        expect(text).toContain('You are holding [bag1] Bag.')
        expect(text).toContain('[arm1] Arm is part of [chair1].')
        expect(renderScene(model({ things: {} }), 'registers')).toContain('In the room there is nothing.\nYou are holding nothing.')
        expect(renderScene(model({ things: {} }), 'examples')).not.toContain('Worked examples')
    })

    it('chooses the consequence example from the first thing with something under it that is clear of the secured', () => {
        const scene = model({
            contents: [
                line('table1', 'In', [line('teapot1', 'On')]),
                line('shelf1', 'In', [line('book1', 'On')]),
            ],
            things: { table1: thing('Table'), teapot1: thing('Teapot', [secured('table1', 'glued to')]), shelf1: thing('Shelf'), book1: thing('Book') },
        })
        expect(exampleHandles(scene)).toEqual(['shelf1', 'teapot1', 'table1'])
        const text = renderScene(scene, 'examples')
        expect(text).toContain('Example: if someone picks up [shelf1], what happens?')
        expect(text).toContain('- In the world: [book1] comes with it, and nothing else does.')
        expect(text).toContain('Example: can [teapot1] be moved to the floor?')
        expect(text).toContain('(untie [teapot1] from [table1]), then (move [teapot1] to the room).')
    })
})
