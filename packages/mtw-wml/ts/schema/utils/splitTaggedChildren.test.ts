import { findTaggedChildren } from './findTaggedChildren'
import { splitTaggedChildren } from './splitTaggedChildren'
import { deIndentWML } from './index'
import { treeFromWML, schemaToWML } from '../index'

describe('splitTaggedChildren', () => {

    describe('Parity with findTaggedChildren', () => {
        it('matched equals findTaggedChildren for direct Exit children', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Exit to=(room1)>North</Exit>
                    <Exit to=(room2)>South</Exit>
                    <Feature key=(feat1) />
                </Room>
            `))
            const roomNode = roomTree[0]
            const findResult = findTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            const { matched } = splitTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            expect(matched.map((node) => schemaToWML([node]))).toEqual(findResult.map((node) => schemaToWML([node])))
        })

        it('matched equals findTaggedChildren for Remove-wrapped children', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Remove><Exit to=(room1)>North</Exit></Remove>
                    <Feature key=(feat1) />
                </Room>
            `))
            const roomNode = roomTree[0]
            const findResult = findTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            const { matched } = splitTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            expect(matched.map((node) => schemaToWML([node]))).toEqual(findResult.map((node) => schemaToWML([node])))
        })

        it('matched equals findTaggedChildren for Replace-wrapped children', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Replace><Exit to=(room1)>North</Exit></Replace>
                    <With><Exit to=(room2)>South</Exit></With>
                    <Feature key=(feat1) />
                </Room>
            `))
            const roomNode = roomTree[0]
            const findResult = findTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            const { matched } = splitTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            expect(matched.map((node) => schemaToWML([node]))).toEqual(findResult.map((node) => schemaToWML([node])))
        })

        it('matched equals findTaggedChildren for mixed wrapped and unwrapped', () => {
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
            const findResult = findTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            const { matched } = splitTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            expect(matched.map((node) => schemaToWML([node]))).toEqual(findResult.map((node) => schemaToWML([node])))
        })

        it('matched equals findTaggedChildren when no children match', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Feature key=(feat1) />
                    <Feature key=(feat2) />
                </Room>
            `))
            const roomNode = roomTree[0]
            const findResult = findTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            const { matched } = splitTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            expect(matched).toEqual(findResult)
            expect(matched).toEqual([])
        })

        it('matched equals findTaggedChildren for empty children', () => {
            const roomTree = treeFromWML(deIndentWML(`<Room key=(test) />`))
            const roomNode = roomTree[0]
            const findResult = findTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            const { matched } = splitTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            expect(matched).toEqual(findResult)
            expect(matched).toEqual([])
        })

        it('matched equals findTaggedChildren for direct ShortName only', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <ShortName>Main Room</ShortName>
                    <Feature key=(feat1)><ShortName>Feature One</ShortName></Feature>
                    <Feature key=(feat2)><ShortName>Feature Two</ShortName></Feature>
                </Room>
            `))
            const roomNode = roomTree[0]
            const findResult = findTaggedChildren({ children: roomNode.children, tag: 'ShortName' })
            const { matched } = splitTaggedChildren({ children: roomNode.children, tag: 'ShortName' })
            expect(matched.map((node) => schemaToWML([node]))).toEqual(findResult.map((node) => schemaToWML([node])))
        })

        it('matched equals findTaggedChildren for Remove with Feature and Example', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Remove>
                        <Feature key=(feat1) />
                        <Situation key=(ex1) />
                    </Remove>
                </Room>
            `))
            const roomNode = roomTree[0]
            const featureFind = findTaggedChildren({ children: roomNode.children, tag: 'Feature' })
            const { matched: featureMatched } = splitTaggedChildren({ children: roomNode.children, tag: 'Feature' })
            expect(featureMatched.map((node) => schemaToWML([node]))).toEqual(featureFind.map((node) => schemaToWML([node])))
            const exampleFind = findTaggedChildren({ children: roomNode.children, tag: 'Situation' })
            const { matched: exampleMatched } = splitTaggedChildren({ children: roomNode.children, tag: 'Situation' })
            expect(exampleMatched.map((node) => schemaToWML([node]))).toEqual(exampleFind.map((node) => schemaToWML([node])))
        })

        it('matched equals findTaggedChildren for Replace with Feature and Example', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Replace><Feature key=(feat1) /></Replace>
                    <With><Feature key=(feat2) /><Situation key=(ex1) /></With>
                </Room>
            `))
            const roomNode = roomTree[0]
            const featureFind = findTaggedChildren({ children: roomNode.children, tag: 'Feature' })
            const { matched: featureMatched } = splitTaggedChildren({ children: roomNode.children, tag: 'Feature' })
            expect(featureMatched.map((node) => schemaToWML([node]))).toEqual(featureFind.map((node) => schemaToWML([node])))
        })

        it('matched equals findTaggedChildren for Remove with multiple Features', () => {
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
            const findResult = findTaggedChildren({ children: roomNode.children, tag: 'Feature' })
            const { matched } = splitTaggedChildren({ children: roomNode.children, tag: 'Feature' })
            expect(matched.map((node) => schemaToWML([node]))).toEqual(findResult.map((node) => schemaToWML([node])))
        })
    })

    describe('Basic functionality', () => {
        it('splits direct children: matched has Exit, remainder has Feature only', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Exit to=(room1)>North</Exit>
                    <Exit to=(room2)>South</Exit>
                    <Feature key=(feat1) />
                </Room>
            `))
            const roomNode = roomTree[0]
            const { matched, remainder } = splitTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            expect(matched.map((node) => schemaToWML([node]))).toEqual([
                deIndentWML(`<Exit to=(room1)>North</Exit>`),
                deIndentWML(`<Exit to=(room2)>South</Exit>`),
            ])
            expect(remainder.length).toBe(1)
            expect(remainder[0].data.tag).toBe('Feature')
            expect(schemaToWML(remainder)).toEqual(deIndentWML(`<Feature key=(feat1) />`))
        })

        it('empty children: matched and remainder both empty', () => {
            const roomTree = treeFromWML(deIndentWML(`<Room key=(test) />`))
            const roomNode = roomTree[0]
            const { matched, remainder } = splitTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            expect(matched).toEqual([])
            expect(remainder).toEqual([])
        })

        it('no matches: matched empty, remainder round-trips to same WML as input', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Feature key=(feat1) />
                    <Feature key=(feat2) />
                </Room>
            `))
            const roomNode = roomTree[0]
            const { matched, remainder } = splitTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            expect(matched).toEqual([])
            expect(schemaToWML(remainder)).toEqual(schemaToWML(roomNode.children))
        })
    })

    describe('Remainder correctness', () => {
        it('re-splitting remainder by Feature finds Feature nodes', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Exit to=(room1)>North</Exit>
                    <Feature key=(feat1) />
                    <Feature key=(feat2) />
                </Room>
            `))
            const roomNode = roomTree[0]
            const { remainder: afterExit } = splitTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            const { matched: features, remainder: afterFeature } = splitTaggedChildren({ children: afterExit, tag: 'Feature' })
            expect(features.length).toBe(2)
            expect(afterFeature).toEqual([])
        })

        it('pipeline: split by ShortName then Exit then Feature leaves remainder empty', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <ShortName>Main</ShortName>
                    <Exit to=(room1)>North</Exit>
                    <Feature key=(feat1) />
                </Room>
            `))
            const roomNode = roomTree[0]
            let children = roomNode.children
            const { remainder: r1 } = splitTaggedChildren({ children, tag: 'ShortName' })
            children = r1
            const { remainder: r2 } = splitTaggedChildren({ children, tag: 'Exit' })
            children = r2
            const { remainder: r3 } = splitTaggedChildren({ children, tag: 'Feature' })
            expect(r3).toEqual([])
        })
    })

    describe('Remove wrapper splitting', () => {
        it('Remove with only matching (Exit): matched has Remove with Exit, remainder empty', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Remove><Exit to=(room1)>North</Exit></Remove>
                    <Feature key=(feat1) />
                </Room>
            `))
            const roomNode = roomTree[0]
            const { matched, remainder } = splitTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            expect(matched.map((node) => schemaToWML([node]))).toEqual([
                deIndentWML(`<Remove><Exit to=(room1)>North</Exit></Remove>`),
            ])
            expect(remainder.length).toBe(1)
            expect(remainder[0].data.tag).toBe('Feature')
        })

        it('Remove with only non-matching: matched empty, remainder has Remove', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Remove><Feature key=(feat1) /></Remove>
                </Room>
            `))
            const roomNode = roomTree[0]
            const { matched, remainder } = splitTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            expect(matched).toEqual([])
            expect(remainder.length).toBe(1)
            expect(remainder[0].data.tag).toBe('Remove')
            expect(schemaToWML(remainder)).toEqual(deIndentWML(`<Remove><Feature key=(feat1) /></Remove>`))
        })

        it('Remove with both Exit and Feature, split by Exit: matched Remove(Exit), remainder Remove(Feature)', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Remove>
                        <Exit to=(room1)>North</Exit>
                        <Feature key=(feat1) />
                    </Remove>
                </Room>
            `))
            const roomNode = roomTree[0]
            const { matched, remainder } = splitTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            expect(matched.map((node) => schemaToWML([node]))).toEqual([
                deIndentWML(`<Remove><Exit to=(room1)>North</Exit></Remove>`),
            ])
            expect(remainder.length).toBe(1)
            expect(remainder[0].data.tag).toBe('Remove')
            expect(schemaToWML(remainder)).toEqual(deIndentWML(`<Remove><Feature key=(feat1) /></Remove>`))
        })

        it('Remove with Feature and Example, split by Feature: remainder has Remove(Example)', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Remove>
                        <Feature key=(feat1) />
                        <Situation key=(ex1) />
                    </Remove>
                </Room>
            `))
            const roomNode = roomTree[0]
            const { matched, remainder } = splitTaggedChildren({ children: roomNode.children, tag: 'Feature' })
            expect(matched.map((node) => schemaToWML([node]))).toEqual([
                deIndentWML(`<Remove><Feature key=(feat1) /></Remove>`),
            ])
            expect(remainder.length).toBe(1)
            expect(remainder[0].data.tag).toBe('Remove')
            expect(schemaToWML(remainder)).toEqual(deIndentWML(`<Remove><Situation key=(ex1) /></Remove>`))
        })
    })

    describe('Replace wrapper splitting', () => {
        it('Replace with only matching: matched has full Replace, remainder empty', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Replace><Exit to=(room1)>North</Exit></Replace>
                    <With><Exit to=(room2)>South</Exit></With>
                    <Feature key=(feat1) />
                </Room>
            `))
            const roomNode = roomTree[0]
            const { matched, remainder } = splitTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            expect(matched.map((node) => schemaToWML([node]))).toEqual([
                deIndentWML(`
                    <Replace><Exit to=(room1)>North</Exit></Replace>
                    <With><Exit to=(room2)>South</Exit></With>
                `),
            ])
            expect(remainder.length).toBe(1)
            expect(remainder[0].data.tag).toBe('Feature')
        })

        it('Replace with only non-matching: matched empty, remainder has Replace', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Replace><Feature key=(feat1) /></Replace>
                    <With><Feature key=(feat2) /></With>
                </Room>
            `))
            const roomNode = roomTree[0]
            const { matched, remainder } = splitTaggedChildren({ children: roomNode.children, tag: 'Exit' })
            expect(matched).toEqual([])
            expect(remainder.length).toBe(1)
            expect(remainder[0].data.tag).toBe('Replace')
        })

        it('Replace with mixed Feature and Example: split by Feature gives matched Replace(Feature) and remainder Replace(Example)', () => {
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
            const { matched, remainder } = splitTaggedChildren({ children: roomNode.children, tag: 'Feature' })
            expect(matched.map((node) => schemaToWML([node]))).toEqual([
                deIndentWML(`<Replace><Feature key=(feat1) /></Replace><With><Feature key=(feat2) /></With>`),
            ])
            expect(remainder.length).toBe(1)
            expect(remainder[0].data.tag).toBe('Replace')
            expect(remainder[0].children.length).toBe(2)
            const replaceMatch = remainder[0].children.find((c) => c.data.tag === 'ReplaceMatch')
            const replacePayload = remainder[0].children.find((c) => c.data.tag === 'ReplacePayload')
            expect(replaceMatch?.children.length).toBe(0)
            expect(replacePayload?.children.length).toBe(1)
            expect(replacePayload?.children[0].data.tag).toBe('Situation')
        })
    })

    describe('Integration-style pipeline', () => {
        it('Room children consumed in order ShortName, Exit, Lens, Feature, Example, Guidance, Character leaves empty remainder', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <ShortName>Main</ShortName>
                    <Exit to=(r1)>North</Exit>
                    <Feature key=(f1) />
                    <Situation key=(e1) />
                </Room>
            `))
            const roomNode = roomTree[0]
            const tags = ['ShortName', 'Exit', 'Feature', 'Situation'] as const
            let children = roomNode.children
            for (const tag of tags) {
                const { remainder } = splitTaggedChildren({ children, tag })
                children = remainder
            }
            expect(children).toEqual([])
        })
    })
})
