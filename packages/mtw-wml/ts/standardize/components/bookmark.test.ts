import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardBookmarkData } from "./dataTypes/bookmark"
import StandardBookmark from './bookmark'
import { mergeTest } from './utils/testing'
import { treeNodeTypeguard } from "../../tree/baseClasses"
import { isSchemaDescription } from "../../schema/baseClasses"

describe('StandardBookmark class', () => {

    it('should construct StandardBookmark from WML', () => {
        const testSource = deIndentWML(`
            <Bookmark key=(test)>Description Test</Bookmark>
        `)
        const testBookmark = new StandardBookmark(testSource)
        expect(testBookmark.key).toEqual('test')
        expect(testBookmark.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] })
        expect(schemaToWML([testBookmark.schema])).toEqual(testSource)
    })

    it('should construct StandardBookmark from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Bookmark key=(test)>Description Test</Bookmark>
        `)
        schema.loadWML(testSource)
        const testBookmark = new StandardBookmark(schema.schema[0])
        expect(testBookmark.key).toEqual('test')
        expect(testBookmark.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] })
        expect(schemaToWML([testBookmark.schema])).toEqual(testSource)
    })

    it('should construct StandardBookmark from StandardBookmarkData', () => {
        const testBookmarkData: StandardBookmarkData = {
            key: 'test',
            tag: 'Bookmark',
            description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] },
        }
        const testBookmark = new StandardBookmark(testBookmarkData)
        expect(testBookmark.key).toEqual('test')
        expect(testBookmark.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] })
        expect(testBookmark.toJSON()).toEqual(testBookmarkData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            '<Bookmark key=(test)>A plain lobby.</Bookmark>',
            StandardBookmark,
            '<Bookmark key=(test)><Space />Shadows cling to the corners of the room.</Bookmark>'
        )).toEqual(deIndentWML(`
            <Bookmark key=(test)>
                A plain lobby.<Space />Shadows cling to the corners of the room.
            </Bookmark>
        `))
    })

    it('should map contents correctly', () => {
        const test = new StandardBookmark(`<Bookmark key=(test)>A plain lobby.</Bookmark>`)
        const callback = (tree) => {
            return tree.map((node) => {
                if (treeNodeTypeguard(isSchemaDescription)(node)) {
                    return {
                        ...node,
                        children: [...node.children, { data: { tag: 'String', value: 'Narf!' }, children: [] }]
                    }
                }
                else {
                    return {
                        ...node,
                        children: callback(node.children)
                    }
                }
            })
        }
        expect(schemaToWML([test.mapContents(callback).schema])).toEqual(`<Bookmark key=(test)>A plain lobby.Narf!</Bookmark>`)
    })
})