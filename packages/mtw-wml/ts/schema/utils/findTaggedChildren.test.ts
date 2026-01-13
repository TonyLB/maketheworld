import { findTaggedChildren } from './findTaggedChildren'
import { deIndentWML } from './index'
import { treeFromWML, schemaToWML } from '../index'

describe('findTaggedChildren', () => {

    describe('Basic Functionality', () => {

        it('should find direct Exit children (no wrapping)', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Exit to=(room1)>North</Exit>
                    <Exit to=(room2)>South</Exit>
                    <Feature key=(feat1) />
                </Room>
            `))
            const roomNode = roomTree[0]
            const result = findTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            
            expect(result.map((node) => (schemaToWML([node])))).toEqual([
                deIndentWML(`<Exit to=(room1)>North</Exit>`),
                deIndentWML(`<Exit to=(room2)>South</Exit>`)
            ])
        })

        it('should find Remove-wrapped children', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Remove><Exit to=(room1)>North</Exit></Remove>
                    <Feature key=(feat1) />
                </Room>
            `))
            const roomNode = roomTree[0]
            const result = findTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            
            expect(result.map((node) => (schemaToWML([node])))).toEqual([
                deIndentWML(`<Remove><Exit to=(room1)>North</Exit></Remove>`)
            ])
        })

        it('should find Replace-wrapped children', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Replace><Exit to=(room1)>North</Exit></Replace>
                    <With><Exit to=(room2)>South</Exit></With>
                    <Feature key=(feat1) />
                </Room>
            `))
            const roomNode = roomTree[0]
            const result = findTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            
            expect(result.map((node) => (schemaToWML([node])))).toEqual([
                deIndentWML(`
                    <Replace><Exit to=(room1)>North</Exit></Replace>
                    <With><Exit to=(room2)>South</Exit></With>
                `)
            ])
        })

        it('should find mixed wrapped and unwrapped children', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Exit to=(room1)>North</Exit>
                    <Remove><Exit to=(room2)>South</Exit></Remove>
                    <Replace><Exit to=(room3)>East</Exit></Replace>
                    <With><Exit to=(room4)>West</Exit></With>
                    <Feature key=(feat1) />
                </Room>
            `))
            const roomNode = roomTree[0]
            const result = findTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            
            expect(result.map((node) => (schemaToWML([node])))).toEqual([
                deIndentWML(`<Exit to=(room1)>North</Exit>`),
                deIndentWML(`<Remove><Exit to=(room2)>South</Exit></Remove>`),
                deIndentWML(`
                    <Replace><Exit to=(room3)>East</Exit></Replace>
                    <With><Exit to=(room4)>West</Exit></With>
                `)
            ])
        })

    })

    describe('Edge Cases', () => {

        it('should return empty array when no children match the tag', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Feature key=(feat1) />
                    <Feature key=(feat2) />
                </Room>
            `))
            const roomNode = roomTree[0]
            const result = findTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            
            expect(result).toEqual([])
        })

        it('should return empty array for empty children', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test) />
            `))
            const roomNode = roomTree[0]
            const result = findTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            
            expect(result).toEqual([])
        })

        it('should only find direct children, not nested tags', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <ShortName>Main Room</ShortName>
                    <Feature key=(feat1)>
                        <ShortName>Feature One</ShortName>
                    </Feature>
                    <Feature key=(feat2)>
                        <ShortName>Feature Two</ShortName>
                    </Feature>
                </Room>
            `))
            const roomNode = roomTree[0]
            const result = findTaggedChildren({ children: roomNode.children, tag: 'ShortName' })
            
            // Should only find the direct ShortName child, not the ones nested inside Features
            expect(result.length).toBe(1)
            expect(result.map((node) => (schemaToWML([node])))).toEqual([
                deIndentWML(`<ShortName>Main Room</ShortName>`)
            ])
        })

    })

})
