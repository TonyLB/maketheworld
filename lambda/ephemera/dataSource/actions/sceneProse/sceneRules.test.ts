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

    it('states the hosted rule as an invariant under a handle, whichever end the securing is held on', () => {
        const rule = "- teapot-secured-to-table: [teapot1] stays fixed relative to [table1]'s frame. When [table1]'s frame moves, [teapot1] travels along with [table1]."
        expect(judgeRulesLines(sceneOf(contents, { teapot1: [glued('table1')] }))).toEqual(['Rules:', rule])
        expect(judgeRulesLines(sceneOf(contents, { table1: [glued('teapot1')] }))).toEqual(['Rules:', rule])
    })

    it('words the rule the same for a child hosted In', () => {
        const inside = [{ ...entry('box1', [{ ...entry('coin1'), hostingKind: 'In' }]) }] as SceneModel['contents']
        expect(judgeRulesLines(sceneOf(inside, { coin1: [glued('box1')] }))[1]).toContain("- coin-secured-to-box: [coin1] stays fixed relative to [box1]'s frame.")
    })

    it('binds a pair neither of which hosts the other, and a thing secured to what is not shown', () => {
        expect(judgeRulesLines(sceneOf([entry('boat1'), entry('post1')], { boat1: [{ kind: 'SecuredTo', target: { kind: 'thing', handle: 'post1' } }] }))[1])
            .toBe('- boat-secured-to-post: [boat1] and [post1] stay fixed relative to each other.')
        expect(judgeRulesLines(sceneOf([entry('boat1')], { boat1: [{ kind: 'SecuredTo', target: { kind: 'notShown' } }] }))[1])
            .toBe('- boat-secured: [boat1] stays fixed relative to what [boat1] is secured to.')
    })

    it('keeps rule handles distinct when two things share a stem', () => {
        const pots = [entry('table1', [entry('teapot1'), entry('teapot2')])]
        expect(judgeRulesLines(sceneOf(pots, { teapot1: [glued('table1')], teapot2: [glued('table1')] })).slice(1).map((line) => line.split(':')[0]))
            .toEqual(['- teapot1-secured-to-table1', '- teapot2-secured-to-table1'])
    })

    it('has no section without a securing, and says no "until" anywhere', () => {
        expect(judgeRulesLines(sceneOf([], {}))).toEqual([])
        expect(judgeRulesLines(sceneOf(contents, { teapot1: [glued('table1')] })).join('\n')).not.toContain('until')
    })

    it('leaves the control rules as they were', () => {
        expect(rulesLines(sceneOf(contents, { teapot1: [glued('table1')] }), 'action')[1]).toContain('until [teapot1] is freed')
    })
})

describe('judgeRulesLines, worded as a violation (oracle drafts)', () => {
    it('states each rule as a test of a method, under the v45 handle, whichever end hosts the other', () => {
        const contents = [entry('table1', [entry('teapot1')])]
        expect(judgeRulesLines(sceneOf(contents, { teapot1: [glued('table1')] }), 'violation')).toEqual([
            'Rules:',
            '- teapot-secured-to-table: [teapot1] is glued to [table1]. A method keeps this rule if it moves [teapot1] and [table1] together, or first changes that [teapot1] is glued to [table1]. A method breaks it if it moves [teapot1] and [table1] relative to each other more than "glued to" allows while [teapot1] is still glued to [table1].',
        ])
        expect(judgeRulesLines(sceneOf([entry('boat1'), entry('post1')], { boat1: [{ kind: 'SecuredTo', target: { kind: 'thing', handle: 'post1' } }] }), 'violation')[1])
            .toBe('- boat-secured-to-post: [boat1] is secured to [post1]. A method keeps this rule if it moves [boat1] and [post1] together, or first changes that [boat1] is secured to [post1]. A method breaks it if it moves [boat1] and [post1] relative to each other more than "secured to" allows while [boat1] is still secured to [post1].')
    })

    it('words a securing to something not shown', () => {
        expect(judgeRulesLines(sceneOf([entry('boat1')], { boat1: [{ kind: 'SecuredTo', target: { kind: 'notShown' } }] }), 'violation')[1])
            .toBe('- boat-secured: [boat1] is secured to something not shown here. A method keeps this rule if it first changes that [boat1] is secured to it. A method breaks it if it moves [boat1] relative to that thing more than "secured to" allows while [boat1] is still secured to it.')
    })

    it('leaves the v45 wording as the default', () => {
        const scene = sceneOf([entry('table1', [entry('teapot1')])], { teapot1: [glued('table1')] })
        expect(judgeRulesLines(scene, 'v45')).toEqual(judgeRulesLines(scene))
        expect(judgeRulesLines(scene)[1]).toContain("stays fixed relative to [table1]'s frame")
    })
})
