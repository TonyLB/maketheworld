import { schemaFromParse, schemaToWML } from '../simpleSchema'
import { SchemaTagTree } from './schema'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'
import parse from '../simpleParser'
import { deIndentWML } from '../simpleSchema/utils'

describe('SchemaTagTree', () => {
    it('should condense order-independent entries', () => {
        const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
            <Asset key=(test)>
                <Room key=(room1)>
                    <Description>Test description</Description>
                    <Name>Test room</Name>
                    <Exit to=(room2) />
                </Room>
                <Room key=(room2) />
                <Room key=(room1)>
                    <Description>: Added</Description>
                </Room>
            </Asset>
        `))))
        const tagTree = new SchemaTagTree(testTree)
        expect(schemaToWML(tagTree.tree)).toEqual(deIndentWML(`
            <Asset key=(test)>
                <Room key=(room1)>
                    <Description>Test description: Added</Description>
                    <Name>Test room</Name>
                    <Exit to=(room2) />
                </Room>
                <Room key=(room2) />
            </Asset>
        `))
    })

})