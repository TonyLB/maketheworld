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

        it('should filter Remove node children to only include matching tags', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Remove>
                        <Feature key=(feat1) />
                        <Situation key=(ex1) />
                    </Remove>
                </Room>
            `))
            const roomNode = roomTree[0]
            
            // Querying for Feature should return Remove with only Feature
            const featureResult = findTaggedChildren({ children: roomNode.children, tag: 'Feature' })
            expect(featureResult.length).toBe(1)
            expect(featureResult.map((node) => (schemaToWML([node])))).toEqual([
                deIndentWML(`<Remove><Feature key=(feat1) /></Remove>`)
            ])
            
            // Querying for Example should return Remove with only Example
            const exampleResult = findTaggedChildren({ children: roomNode.children, tag: 'Situation' })
            expect(exampleResult.length).toBe(1)
            expect(exampleResult.map((node) => (schemaToWML([node])))).toEqual([
                deIndentWML(`<Remove><Situation key=(ex1) /></Remove>`)
            ])
        })

        it('should filter Replace node children to only include matching tags in ReplaceMatch and ReplacePayload', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Replace>
                        <Feature key=(feat1) />
                    </Replace>
                    <With>
                        <Feature key=(feat2) />
                        <Situation key=(ex1) />
                    </With>
                </Room>
            `))
            const roomNode = roomTree[0]
            
            // Querying for Feature should return Replace with Feature in both ReplaceMatch and ReplacePayload
            const featureResult = findTaggedChildren({ children: roomNode.children, tag: 'Feature' })
            expect(featureResult.length).toBe(1)
            expect(featureResult.map((node) => (schemaToWML([node])))).toEqual([
                deIndentWML(`<Replace><Feature key=(feat1) /></Replace><With><Feature key=(feat2) /></With>`)
            ])
            
            // Querying for Example should return Replace with Example only in ReplacePayload
            // (ReplaceMatch is preserved but empty, to maintain valid Replace structure)
            const exampleResult = findTaggedChildren({ children: roomNode.children, tag: 'Situation' })
            expect(exampleResult.length).toBe(1)
            // Both ReplaceMatch and ReplacePayload should be preserved
            const exampleNode = exampleResult[0]
            expect(exampleNode.data.tag).toBe('Replace')
            expect(exampleNode.children.length).toBe(2)
            // ReplaceMatch should be present but empty
            const replaceMatch = exampleNode.children.find(child => child.data.tag === 'ReplaceMatch')
            expect(replaceMatch).toBeDefined()
            expect(replaceMatch?.children.length).toBe(0)
            // ReplacePayload should contain Example
            const replacePayload = exampleNode.children.find(child => child.data.tag === 'ReplacePayload')
            expect(replacePayload).toBeDefined()
            expect(replacePayload?.children.length).toBe(1)
            expect(replacePayload?.children[0].data.tag).toBe('Situation')
            expect((replacePayload?.children[0].data as any).key).toBe('ex1')
        })

        it('should handle Remove node with multiple instances of the same tag', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Remove>
                        <Feature key=(feat1) />
                        <Feature key=(feat2) />
                        <Situation key=(ex1) />
                    </Remove>
                </Room>
            `))
            const roomNode = roomTree[0]
            
            // Querying for Feature should return Remove with both Features
            const featureResult = findTaggedChildren({ children: roomNode.children, tag: 'Feature' })
            expect(featureResult.length).toBe(1)
            expect(featureResult.map((node) => (schemaToWML([node])))).toEqual([
                deIndentWML(`
                    <Remove>
                        <Feature key=(feat1) />
                        <Feature key=(feat2) />
                    </Remove>
                `)
            ])
        })

    })

})
