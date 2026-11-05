import type { SceneModel, SceneRelation } from '../../positions/ludicCache/sceneModel'
import { judgeRulesLines, rulesLines } from './sceneRules'

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

describe('judgeRulesLines', () => {
    const contents = [entry('table1', [entry('teapot1')])]

    it('states the hosted rule plainly, whichever end the securing is held on, with no until clause', () => {
        const rule = '- [teapot1] cannot leave [table1]. Moving [table1] gives no reason to doubt that [teapot1] is on [table1].'
        expect(judgeRulesLines(sceneOf(contents, { teapot1: [glued('table1')] }))).toEqual(['Rules:', rule])
        expect(judgeRulesLines(sceneOf(contents, { table1: [glued('teapot1')] }))).toEqual(['Rules:', rule])
    })

    it('says "in" for a child hosted In', () => {
        const inside = [{ ...entry('box1', [{ ...entry('coin1'), hostingKind: 'In' }]) }] as SceneModel['contents']
        expect(judgeRulesLines(sceneOf(inside, { coin1: [glued('box1')] }))[1]).toContain('that [coin1] is in [box1].')
    })

    it('binds a pair neither of which hosts the other, and a thing secured to what is not shown', () => {
        expect(judgeRulesLines(sceneOf([entry('boat1'), entry('post1')], { boat1: [{ kind: 'SecuredTo', target: { kind: 'thing', handle: 'post1' } }] }))[1])
            .toBe('- [boat1] and [post1] cannot be moved apart. They can still be moved together.')
        expect(judgeRulesLines(sceneOf([entry('boat1')], { boat1: [{ kind: 'SecuredTo', target: { kind: 'notShown' } }] }))[1])
            .toBe('- [boat1] cannot leave what it is secured to.')
    })

    it('has no section without a securing, and says no "until" anywhere', () => {
        expect(judgeRulesLines(sceneOf([], {}))).toEqual([])
        expect(judgeRulesLines(sceneOf(contents, { teapot1: [glued('table1')] })).join('\n')).not.toContain('until')
    })

    it('leaves the control rules as they were', () => {
        expect(rulesLines(sceneOf(contents, { teapot1: [glued('table1')] }), 'action')[1]).toContain('until [teapot1] is freed')
    })
})
