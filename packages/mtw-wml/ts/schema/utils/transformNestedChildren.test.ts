import { transformNestedChildren } from './transformNestedChildren'
import { deIndentWML } from './index'
import { treeFromWML, schemaToWML } from '../index'
import { TagMismatchError } from "@tonylb/mtw-base/ts/standardize"

describe('transformNestedChildren', () => {

    describe('Plain nodes', () => {
        it('should transform children of plain node without tag validation', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Feature key=(feat1) />
                    <Feature key=(feat2) />
                </Room>
            `))
            const roomNode = roomTree[0]
            
            const transform = transformNestedChildren({
                transform: (children) => [
                    ...children,
                    { data: { tag: 'Feature' as const, key: 'feat3' }, children: [] }
                ]
            })
            
            const result = transform(roomNode)
            
            expect(schemaToWML([result])).toBe(deIndentWML(`
                <Room key=(test)>
                    <Feature key=(feat1) />
                    <Feature key=(feat2) />
                    <Feature key=(feat3) />
                </Room>
            `))
        })

        it('should transform children of plain node with tag validation', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Feature key=(feat1) />
                </Room>
            `))
            const roomNode = roomTree[0]
            
            const transform = transformNestedChildren({
                tag: 'Room',
                transform: (children) => [
                    ...children,
                    { data: { tag: 'Feature' as const, key: 'feat2' }, children: [] }
                ]
            })
            
            const result = transform(roomNode)
            
            expect(schemaToWML([result])).toBe(deIndentWML(`
                <Room key=(test)>
                    <Feature key=(feat1) />
                    <Feature key=(feat2) />
                </Room>
            `))
        })

        it('should throw TagMismatchError when tag validation fails for plain node', () => {
            const featureTree = treeFromWML(deIndentWML(`
                <Feature key=(feat1) />
            `))
            const featureNode = featureTree[0]
            
            const transform = transformNestedChildren({
                tag: 'Room',
                transform: (children) => children
            })
            
            expect(() => transform(featureNode)).toThrow(TagMismatchError)
            expect(() => transform(featureNode)).toThrow('Node has Feature tag, expected Room')
        })

        it('should prepend child to existing children', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Feature key=(feat1) />
                </Room>
            `))
            const roomNode = roomTree[0]
            
            const transform = transformNestedChildren({
                tag: 'Room',
                transform: (children) => [
                    { data: { tag: 'Position' as const, x: 10, y: 20 }, children: [] },
                    ...children
                ]
            })
            
            const result = transform(roomNode)
            
            expect(schemaToWML([result])).toBe(deIndentWML(`
                <Room key=(test)>
                    <Position x="10" y="20" />
                    <Feature key=(feat1) />
                </Room>
            `))
        })
    })

    describe('Remove-wrapped nodes', () => {
        it('should transform children of inner node and re-wrap in Remove', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Remove>
                        <Room key=(test2)>
                            <Feature key=(feat1) />
                        </Room>
                    </Remove>
                </Room>
            `))
            const roomNode = roomTree[0]
            const removeNode = roomNode.children[0]
            
            const transform = transformNestedChildren({
                tag: 'Room',
                transform: (children) => [
                    ...children,
                    { data: { tag: 'Feature' as const, key: 'feat2' }, children: [] }
                ]
            })
            
            const result = transform(removeNode)
            
            expect(result.data.tag).toBe('Remove')
            expect(result.children.length).toBe(1)
            const innerRoom = result.children[0]
            expect(innerRoom.data.tag).toBe('Room')
            expect(schemaToWML([innerRoom])).toBe(deIndentWML(`
                <Room key=(test2)>
                    <Feature key=(feat1) />
                    <Feature key=(feat2) />
                </Room>
            `))
        })

        it('should throw TagMismatchError when tag validation fails for Remove-wrapped node', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Remove>
                        <Feature key=(feat1) />
                    </Remove>
                </Room>
            `))
            const roomNode = roomTree[0]
            const removeNode = roomNode.children[0]
            
            const transform = transformNestedChildren({
                tag: 'Room',
                transform: (children) => children
            })
            
            expect(() => transform(removeNode)).toThrow(TagMismatchError)
            expect(() => transform(removeNode)).toThrow('Node has Feature tag, expected Room')
        })

        it('should throw error when Remove node has no children', () => {
            const removeNode = {
                data: { tag: 'Remove' as const },
                children: []
            }
            
            const transform = transformNestedChildren({
                transform: (children) => children
            })
            
            expect(() => transform(removeNode)).toThrow('Remove node has no children')
        })
    })

    describe('Replace-wrapped nodes', () => {
        it('should transform children of both ReplaceMatch and ReplacePayload inner nodes', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Replace>
                        <Room key=(test2)>
                            <Feature key=(feat1) />
                        </Room>
                    </Replace>
                    <With>
                        <Room key=(test3)>
                            <Feature key=(feat2) />
                        </Room>
                    </With>
                </Room>
            `))
            const roomNode = roomTree[0]
            const replaceNode = roomNode.children.find(child => child.data.tag === 'Replace')!
            
            const transform = transformNestedChildren({
                tag: 'Room',
                transform: (children) => [
                    ...children,
                    { data: { tag: 'Position' as const, x: 5, y: 10 }, children: [] }
                ]
            })
            
            const result = transform(replaceNode)
            
            expect(result.data.tag).toBe('Replace')
            expect(result.children.length).toBe(2)
            
            const replaceMatch = result.children.find(child => child.data.tag === 'ReplaceMatch')!
            const replacePayload = result.children.find(child => child.data.tag === 'ReplacePayload')!
            
            expect(replaceMatch.children.length).toBe(1)
            expect(replacePayload.children.length).toBe(1)
            
            const matchRoom = replaceMatch.children[0]
            const payloadRoom = replacePayload.children[0]
            
            expect(matchRoom.data.tag).toBe('Room')
            expect(schemaToWML([matchRoom])).toBe(deIndentWML(`
                <Room key=(test2)>
                    <Feature key=(feat1) />
                    <Position x="5" y="10" />
                </Room>
            `))
            
            expect(payloadRoom.data.tag).toBe('Room')
            expect(schemaToWML([payloadRoom])).toBe(deIndentWML(`
                <Room key=(test3)>
                    <Feature key=(feat2) />
                    <Position x="5" y="10" />
                </Room>
            `))
        })

        it('should throw TagMismatchError when ReplaceMatch tag validation fails', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Replace>
                        <Feature key=(feat1) />
                    </Replace>
                    <With>
                        <Room key=(test2) />
                    </With>
                </Room>
            `))
            const roomNode = roomTree[0]
            const replaceNode = roomNode.children.find(child => child.data.tag === 'Replace')!
            
            const transform = transformNestedChildren({
                tag: 'Room',
                transform: (children) => children
            })
            
            expect(() => transform(replaceNode)).toThrow(TagMismatchError)
            expect(() => transform(replaceNode)).toThrow('Node has Feature tag, expected Room')
        })

        it('should throw TagMismatchError when ReplacePayload tag validation fails', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Replace>
                        <Room key=(test2) />
                    </Replace>
                    <With>
                        <Feature key=(feat1) />
                    </With>
                </Room>
            `))
            const roomNode = roomTree[0]
            const replaceNode = roomNode.children.find(child => child.data.tag === 'Replace')!
            
            const transform = transformNestedChildren({
                tag: 'Room',
                transform: (children) => children
            })
            
            expect(() => transform(replaceNode)).toThrow(TagMismatchError)
            expect(() => transform(replaceNode)).toThrow('Node has Feature tag, expected Room')
        })

        it('should throw error when Replace node is missing ReplaceMatch or ReplacePayload', () => {
            const replaceNode = {
                data: { tag: 'Replace' as const },
                children: [
                    { data: { tag: 'ReplaceMatch' as const }, children: [] }
                ]
            }
            
            const transform = transformNestedChildren({
                transform: (children) => children
            })
            
            expect(() => transform(replaceNode)).toThrow('Replace node must have both ReplaceMatch and ReplacePayload children')
        })

        it('should throw error when ReplaceMatch or ReplacePayload has no children', () => {
            const replaceNode = {
                data: { tag: 'Replace' as const },
                children: [
                    { data: { tag: 'ReplaceMatch' as const }, children: [] },
                    { data: { tag: 'ReplacePayload' as const }, children: [
                        { data: { tag: 'Room' as const, key: 'test' }, children: [] }
                    ] }
                ]
            }
            
            const transform = transformNestedChildren({
                transform: (children) => children
            })
            
            expect(() => transform(replaceNode)).toThrow('ReplaceMatch and ReplacePayload must have children')
        })
    })

    describe('Complex scenarios', () => {
        it('should handle empty children array', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test) />
            `))
            const roomNode = roomTree[0]
            
            const transform = transformNestedChildren({
                tag: 'Room',
                transform: (children) => [
                    { data: { tag: 'Feature' as const, key: 'feat1' }, children: [] }
                ]
            })
            
            const result = transform(roomNode)
            
            expect(schemaToWML([result])).toBe(deIndentWML(`
                <Room key=(test)><Feature key=(feat1) /></Room>
            `))
        })

        it('should preserve node data when transforming children', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test) uuid=(123)>
                    <Feature key=(feat1) />
                </Room>
            `))
            const roomNode = roomTree[0]
            
            const transform = transformNestedChildren({
                tag: 'Room',
                transform: (children) => children
            })
            
            const result = transform(roomNode)
            
            expect((result.data as any).key).toBe('test')
            expect((result.data as any).uuid).toBe('ROOM#123')
        })

        it('should handle transform that removes all children', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Feature key=(feat1) />
                    <Feature key=(feat2) />
                </Room>
            `))
            const roomNode = roomTree[0]
            
            const transform = transformNestedChildren({
                tag: 'Room',
                transform: () => []
            })
            
            const result = transform(roomNode)
            
            expect(result.children).toEqual([])
            expect(schemaToWML([result])).toBe(deIndentWML(`
                <Room key=(test) />
            `))
        })
    })

})
