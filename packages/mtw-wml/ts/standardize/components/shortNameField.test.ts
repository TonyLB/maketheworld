import { deIndentWML } from "../../schema/utils"
import { treeFromWML } from "../../schema"
import { StandardLiteral } from "../literal"
import {
    createShortNameFromJSON,
    invertShortName,
    mergeShortName,
    shortNameSchemaChildren,
    shortNameToJSON,
    standardizeShortNameConsumer,
    type ShortNamePayloadHost,
} from "./shortNameField"
import { processWithConsumers } from "./fromSchemaPipeline"

describe('shortNameField', () => {
    describe('createShortNameFromJSON', () => {
        it('returns undefined when data is absent', () => {
            expect(createShortNameFromJSON(undefined)).toBeUndefined()
        })

        it('builds StandardLiteral with ShortName tag', () => {
            const literal = createShortNameFromJSON('Test Name')
            expect(literal).toBeInstanceOf(StandardLiteral)
            expect(literal!.toJSON()).toEqual('Test Name')
        })
    })

    describe('shortNameToJSON', () => {
        it('returns undefined for absent literal', () => {
            expect(shortNameToJSON(undefined)).toBeUndefined()
        })

        it('delegates to literal.toJSON()', () => {
            const literal = createShortNameFromJSON('Label')
            expect(shortNameToJSON(literal)).toEqual('Label')
        })
    })

    describe('mergeShortName', () => {
        it('returns right when left is absent', () => {
            const right = createShortNameFromJSON('B')
            expect(mergeShortName(undefined, right)?.toJSON()).toEqual('B')
        })

        it('returns left when right is absent', () => {
            const left = createShortNameFromJSON('A')
            expect(mergeShortName(left, undefined)?.toJSON()).toEqual('A')
        })

        it('merges Replace/With edits', () => {
            const original = createShortNameFromJSON('Original')
            const updated = createShortNameFromJSON({
                tag: 'Replace',
                match: 'Original',
                payload: 'Updated',
            })
            expect(mergeShortName(original, updated)?.toJSON()).toEqual('Updated')
        })
    })

    describe('invertShortName', () => {
        it('returns undefined when literal is absent', () => {
            expect(invertShortName(undefined)).toBeUndefined()
        })

        it('inverts a plain literal', () => {
            const literal = createShortNameFromJSON('Test')
            const inverted = invertShortName(literal)
            expect(inverted).toBeInstanceOf(StandardLiteral)
            expect(inverted!.toJSON()).toBeDefined()
        })
    })

    describe('shortNameSchemaChildren', () => {
        it('returns empty array when literal is absent', () => {
            expect(shortNameSchemaChildren(undefined)).toEqual([])
        })

        it('returns nestedSchema for present literal', () => {
            const literal = createShortNameFromJSON('Room Name')
            const children = shortNameSchemaChildren(literal)
            expect(children.length).toBeGreaterThan(0)
            expect(children[0].data.tag).toBe('ShortName')
        })
    })

    describe('standardizeShortNameConsumer', () => {
        it('consumes ShortName tag via processWithConsumers', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <ShortName>Main Room</ShortName>
                </Room>
            `))
            const children = roomTree[0].children
            const host: ShortNamePayloadHost = {}
            const consumer = standardizeShortNameConsumer(host)
            processWithConsumers(host, [consumer], children)
            expect(host._shortName).toBeInstanceOf(StandardLiteral)
            expect(host._shortName!.toJSON()).toBe('Main Room')
        })

        it('clears shortName when tag is absent', () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test) />
            `))
            const children = roomTree[0].children
            const host: ShortNamePayloadHost = {
                _shortName: createShortNameFromJSON('Stale'),
            }
            const consumer = standardizeShortNameConsumer(host)
            processWithConsumers(host, [consumer], children)
            expect(host._shortName).toBeUndefined()
        })
    })
})
