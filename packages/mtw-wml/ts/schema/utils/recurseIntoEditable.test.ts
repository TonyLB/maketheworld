import { recurseIntoEditable } from './recurseIntoEditable'
import { deIndentWML } from './index'
import { treeFromWML } from '../index'
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { isSchemaMark } from "@tonylb/mtw-base/ts/schema/worldState"

describe('recurseIntoEditable', () => {
    
    describe('Plain nodes', () => {
        it('should apply function to plain node directly', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <ShortName>Test Room</ShortName>
                </Room>
            `))
            const roomNode = roomTree[0]
            
            const result = recurseIntoEditable(roomNode, (node) => node.data.tag)
            
            expect(result).toEqual(['Room'])
        })
        
    })
    
    describe('Remove-wrapped nodes', () => {
        it('should apply function to content within Remove wrapper', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Remove>
                        <Feature key=(feat1) />
                    </Remove>
                </Room>
            `))
            const roomNode = roomTree[0]
            const removeNode = roomNode.children[0]
            
            const result = recurseIntoEditable(removeNode, (node) => node.data.tag)
            
            expect(result).toEqual(['Feature'])
        })
        
        it('should handle Remove with multiple children', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Remove>
                        <Feature key=(feat1) />
                        <Feature key=(feat2) />
                    </Remove>
                </Room>
            `))
            const roomNode = roomTree[0]
            const removeNode = roomNode.children[0]
            
            const result = recurseIntoEditable(removeNode, (node) => (node.data as any).key)
            
            expect(result).toEqual(['feat1', 'feat2'])
        })
        
    })
    
    describe('Replace-wrapped nodes', () => {
        it('should apply function to both ReplaceMatch and ReplacePayload content', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Replace>
                        <Feature key=(feat1) />
                    </Replace>
                    <With>
                        <Feature key=(feat2) />
                    </With>
                </Room>
            `))
            const roomNode = roomTree[0]
            const replaceNode = roomNode.children.find(child => child.data.tag === 'Replace')!
            
            const result = recurseIntoEditable(replaceNode, (node) => (node.data as any).key)
            
            expect(result).toEqual(['feat1', 'feat2'])
        })
        
        it('should handle Replace with multiple children in each part', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Replace>
                        <Feature key=(feat1) />
                        <Feature key=(feat2) />
                    </Replace>
                    <With>
                        <Feature key=(feat3) />
                    </With>
                </Room>
            `))
            const roomNode = roomTree[0]
            const replaceNode = roomNode.children.find(child => child.data.tag === 'Replace')!
            
            const result = recurseIntoEditable(replaceNode, (node) => (node.data as any).key)
            
            expect(result).toEqual(['feat1', 'feat2', 'feat3'])
        })
        
        it('should handle Replace with empty ReplaceMatch', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Replace></Replace>
                    <With>
                        <Feature key=(feat1) />
                    </With>
                </Room>
            `))
            const roomNode = roomTree[0]
            const replaceNode = roomNode.children.find(child => child.data.tag === 'Replace')!
            
            const result = recurseIntoEditable(replaceNode, (node) => (node.data as any).key)
            
            expect(result).toEqual(['feat1'])
        })
        
        it('should handle Replace with empty ReplacePayload', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Replace>
                        <Feature key=(feat1) />
                    </Replace>
                    <With></With>
                </Room>
            `))
            const roomNode = roomTree[0]
            const replaceNode = roomNode.children.find(child => child.data.tag === 'Replace')!
            
            const result = recurseIntoEditable(replaceNode, (node) => (node.data as any).key)
            
            expect(result).toEqual(['feat1'])
        })
    })
    
    describe('Complex scenarios', () => {
        it('should handle nested edit wrappers', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Remove>
                        <Remove>
                            <Feature key=(feat1) />
                        </Remove>
                    </Remove>
                </Room>
            `))
            const roomNode = roomTree[0]
            const outerRemoveNode = roomNode.children[0]
            
            const result = recurseIntoEditable(outerRemoveNode, (node) => {
                if (node.data.tag === 'Remove') {
                    return 'Remove'
                }
                return (node.data as any).key
            })
            
            // Should return the inner Remove node (not unwrap it further)
            expect(result).toEqual(['Remove'])
        })
    })
})
