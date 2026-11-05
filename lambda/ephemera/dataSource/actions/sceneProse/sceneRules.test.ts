import type { SceneModel, SceneRelation } from '../../positions/ludicCache/sceneModel'
import { rulesLines } from './sceneRules'

const entry = (handle: string, children: SceneModel['contents'] = []) => ({
    kind: 'line', handle, hostingKind: 'On', first: true, elsewhere: [], joins: [], children,
}) as unknown as SceneModel['contents'][number]

const sceneOf = (contents: SceneModel['contents'], relations: Record<string, SceneRelation[]>): SceneModel => ({
    contents,
    held: [],
    things: Object.fromEntries(Object.entries(relations).map(([handle, list]) => [handle, { relations: list }])),
}) as unknown as SceneModel

const glued = (handle: string): SceneRelation => ({ kind: 'Custom', label: 'glued to', target: { kind: 'thing', handle }, secured: true })

describe('rulesLines', () => {
    it('binds only the child, whichever end the securing is held on', () => {
        const contents = [entry('table1', [entry('teapot1')])]
        const rule = 'Prevents moving [teapot1] relative to [table1] more than "glued to" would permit. Does not prevent moving [table1] and its contents as a whole.'
        expect(rulesLines(sceneOf(contents, { teapot1: [glued('table1')] }))[1]).toBe(`- [teapot1] is secured to [table1]; its fictional cause is "glued to". ${rule}`)
        expect(rulesLines(sceneOf(contents, { table1: [glued('teapot1')] }))[1]).toBe(`- [table1] is secured to [teapot1]; its fictional cause is "glued to". ${rule}`)
    })

    it('binds either of two things neither of which hosts the other', () => {
        const lines = rulesLines(sceneOf([entry('boat1'), entry('post1')], { boat1: [{ kind: 'SecuredTo', target: { kind: 'thing', handle: 'post1' } }] }))
        expect(lines[1]).toBe('- [boat1] is secured to [post1]. Prevents moving [boat1] or [post1] relative to the other more than "secured to" would permit. Does not prevent moving them together.')
    })

    it('still holds a thing secured to something not shown', () => {
        const lines = rulesLines(sceneOf([entry('boat1')], { boat1: [{ kind: 'SecuredTo', target: { kind: 'notShown' } }] }))
        expect(lines[1]).toBe('- [boat1] is secured to what is not shown here. Prevents moving [boat1] away from it more than "secured to" would permit.')
    })

    it('has no section for a relation that does not secure, or none at all', () => {
        const unsecured: SceneRelation = { kind: 'Custom', label: 'leaning against', target: { kind: 'thing', handle: 'post1' }, secured: false }
        expect(rulesLines(sceneOf([entry('boat1'), entry('post1')], { boat1: [unsecured] }))).toEqual([])
        expect(rulesLines(sceneOf([], {}))).toEqual([])
    })
})
