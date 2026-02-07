import { GenericTreeNode } from '@tonylb/mtw-base/ts/genericTree'
import { SchemaTag, isSchemaComponent } from '@tonylb/mtw-base/ts/schema'
import { treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree'
import { splitChildrenByPredicate } from './splitChildrenByPredicate'
import { deIndentWML } from './index'
import { treeFromWML, schemaToWML } from '../index'

const isInlineRef0 = (node: GenericTreeNode<SchemaTag>) =>
    treeNodeTypeguard(isSchemaComponent)(node) && (node.data as { ref?: number }).ref === 0

describe('splitChildrenByPredicate', () => {
    it('no match: matched empty, remainder equals children', () => {
        const roomTree = treeFromWML(deIndentWML(`
            <Room key=(test)>
                <ShortName>Main</ShortName>
                <Feature key=(feat1) />
            </Room>
        `))
        const children = roomTree[0].children
        const { matched, remainder } = splitChildrenByPredicate(children, isInlineRef0)
        expect(matched).toEqual([])
        expect(remainder.length).toBe(2)
        expect(schemaToWML(remainder)).toEqual(schemaToWML(children))
    })

    it('direct match: ref=0 Mark in matched, rest in remainder', () => {
        const roomTree = treeFromWML(deIndentWML(`
            <Room key=(test)>
                <ShortName>Main</ShortName>
                <Mark key=(m1) ref={0}><ShortName>Mark One</ShortName></Mark>
                <Feature key=(feat1) />
            </Room>
        `))
        const children = roomTree[0].children
        const { matched, remainder } = splitChildrenByPredicate(children, isInlineRef0)
        expect(matched.length).toBe(1)
        expect(matched[0].data.tag).toBe('Mark')
        expect((matched[0].data as { ref?: number }).ref).toBe(0)
        expect(remainder.length).toBe(2)
        expect(remainder.map((n) => n.data.tag)).toEqual(['ShortName', 'Feature'])
    })

    it('Remove containing one matching child: split preserves wrapper', () => {
        const roomTree = treeFromWML(deIndentWML(`
            <Room key=(test)>
                <Remove>
                    <Mark key=(m1) ref={0}><ShortName>Mark One</ShortName></Mark>
                </Remove>
                <Feature key=(feat1) />
            </Room>
        `))
        const children = roomTree[0].children
        const { matched, remainder } = splitChildrenByPredicate(children, isInlineRef0)
        expect(matched.length).toBe(1)
        expect(matched[0].data.tag).toBe('Remove')
        expect(matched[0].children.length).toBe(1)
        expect(matched[0].children[0].data.tag).toBe('Mark')
        expect(remainder.length).toBe(1)
        expect(remainder[0].data.tag).toBe('Feature')
    })

    it('empty children: matched and remainder both empty', () => {
        const roomTree = treeFromWML(deIndentWML(`<Room key=(test) />`))
        const children = roomTree[0].children
        const { matched, remainder } = splitChildrenByPredicate(children, isInlineRef0)
        expect(matched).toEqual([])
        expect(remainder).toEqual([])
    })

    it('predicate by tag only: matches all Mark nodes', () => {
        const roomTree = treeFromWML(deIndentWML(`
            <Room key=(test)>
                <Mark key=(m1)><ShortName>One</ShortName></Mark>
                <Feature key=(f1) />
                <Mark key=(m2)><ShortName>Two</ShortName></Mark>
            </Room>
        `))
        const isMark = (node: GenericTreeNode<SchemaTag>) => node.data.tag === 'Mark'
        const { matched, remainder } = splitChildrenByPredicate(roomTree[0].children, isMark)
        expect(matched.length).toBe(2)
        expect(matched.every((n) => n.data.tag === 'Mark')).toBe(true)
        expect(remainder.length).toBe(1)
        expect(remainder[0].data.tag).toBe('Feature')
    })
})
