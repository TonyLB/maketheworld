import { deIndentWML, filterEditableTree } from '.'
import { treeFromWML, schemaToWML } from '../index'
import { wrappedNodeTypeGuard } from '.'
import { isSchemaFeature, isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaExample } from "@tonylb/mtw-base/ts/schema/example"
import { treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree'

describe('deIndentWML', () => {
    it('should leave unindented WML unchanged', () => {
        const testWML = '<Asset uuid=(Test)>\n    <Room key=(ABC)>\n        <Exit to=(DEF)>Test Exit</Exit>\n    </Room>\n</Asset>'
        expect(deIndentWML(testWML)).toEqual(testWML)
    })

    it('should unindent', () => {
        expect(deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(ABC)>
                    <Exit to=(DEF)>Test Exit</Exit>
                </Room>
            </Asset>
        `)).toEqual('<Asset uuid=(Test)>\n    <Room key=(ABC)>\n        <Exit to=(DEF)>Test Exit</Exit>\n    </Room>\n</Asset>')
    })
})

describe('filterEditableTree', () => {

    it('should filter nodes matching the typeguard without Remove wrappers', () => {
        const tree = treeFromWML(deIndentWML(`
            <Room key=(room1) />
            <Feature key=(feat1) />
            <Room key=(room2) />
            <Example key=(ex1) />
        `))
        
        const result = filterEditableTree({ tree, typeguard: treeNodeTypeguard(isSchemaRoom) })
        
        expect(result.length).toBe(2)
        expect(schemaToWML(result)).toContain('Room key=(room1)')
        expect(schemaToWML(result)).toContain('Room key=(room2)')
        expect(schemaToWML(result)).not.toContain('Feature')
        expect(schemaToWML(result)).not.toContain('Example')
    })

    it('should preserve Remove wrappers around matching nodes', () => {
        const tree = treeFromWML(deIndentWML(`
            <Room key=(room1) />
            <Remove><Feature key=(feat1) /></Remove>
            <Remove><Feature key=(feat2) /></Remove>
        `))
        
        const result = filterEditableTree({ tree, typeguard: treeNodeTypeguard(isSchemaFeature) })
        
        expect(result.length).toBe(2)
        expect(schemaToWML(result)).toContain('<Remove><Feature key=(feat1) /></Remove>')
        expect(schemaToWML(result)).toContain('<Remove><Feature key=(feat2) /></Remove>')
        expect(schemaToWML(result)).not.toContain('Room')
    })

    it('should handle nested Remove wrappers recursively', () => {
        const tree = treeFromWML(deIndentWML(`
            <Remove>
                <Remove>
                    <Feature key=(feat1) />
                </Remove>
            </Remove>
        `))
        
        const result = filterEditableTree({ tree, typeguard: treeNodeTypeguard(isSchemaFeature) })
        
        expect(result.length).toBe(1)
        expect(schemaToWML(result)).toContain('<Remove>')
        expect(schemaToWML(result)).toContain('Feature key=(feat1)')
    })

    it('should filter mixed wrapped and unwrapped nodes', () => {
        const tree = treeFromWML(deIndentWML(`
            <Feature key=(feat1) />
            <Remove><Feature key=(feat2) /></Remove>
            <Feature key=(feat3) />
            <Room key=(room1) />
        `))
        
        const result = filterEditableTree({ tree, typeguard: treeNodeTypeguard(isSchemaFeature) })
        
        expect(result.length).toBe(3)
        expect(schemaToWML(result)).toContain('Feature key=(feat1)')
        expect(schemaToWML(result)).toContain('<Remove><Feature key=(feat2) /></Remove>')
        expect(schemaToWML(result)).toContain('Feature key=(feat3)')
        expect(schemaToWML(result)).not.toContain('Room')
    })

    it('should return empty array when no nodes match', () => {
        const tree = treeFromWML(deIndentWML(`
            <Room key=(room1) />
            <Example key=(ex1) />
        `))
        
        const result = filterEditableTree({ tree, typeguard: treeNodeTypeguard(isSchemaFeature) })
        
        expect(result.length).toBe(0)
    })

    it('should return empty array for empty tree', () => {
        const tree = treeFromWML(deIndentWML(`<Asset uuid=(test) />`))
        
        const result = filterEditableTree({ tree, typeguard: treeNodeTypeguard(isSchemaFeature) })
        
        expect(result.length).toBe(0)
    })

    it('should not include Remove wrappers with no matching children', () => {
        const tree = treeFromWML(deIndentWML(`
            <Remove><Room key=(room1) /></Remove>
            <Feature key=(feat1) />
        `))
        
        const result = filterEditableTree({ tree, typeguard: treeNodeTypeguard(isSchemaFeature) })
        
        expect(result.length).toBe(1)
        expect(schemaToWML(result)).toContain('Feature key=(feat1)')
        expect(schemaToWML(result)).not.toContain('Remove')
        expect(schemaToWML(result)).not.toContain('Room')
    })

    it('should only find top-level matches, ignoring nested nodes', () => {
        const tree = treeFromWML(deIndentWML(`
            <Room key=(room1)>
                <Feature key=(feat1) />
                <Example key=(ex1) />
            </Room>
            <Room key=(room2)>
                <Feature key=(feat2) />
            </Room>
            <Feature key=(feat3) />
        `))
        
        const result = filterEditableTree({ tree, typeguard: treeNodeTypeguard(isSchemaFeature) })
        
        // Should only find the top-level feature, not nested ones
        expect(result.length).toBe(1)
        expect(schemaToWML(result)).toContain('Feature key=(feat3)')
        expect(schemaToWML(result)).not.toContain('feat1')
        expect(schemaToWML(result)).not.toContain('feat2')
        expect(schemaToWML(result)).not.toContain('Room')
        expect(schemaToWML(result)).not.toContain('Example')
    })

})
