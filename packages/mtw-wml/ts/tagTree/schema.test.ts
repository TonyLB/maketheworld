import { schemaFromParse, schemaToWML } from '../schema'
import { SchemaTagTree } from './schema'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'
import parse from '../simpleParser'
import { deIndentWML } from '../schema/utils'

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
                <Map key=(map1)>
                    <Room key=(room1)>
                        <Description>: Added</Description>
                        <Position x="0" y="0" />
                    </Room>
                </Map>
            </Asset>
        `))))
        const tagTree = new SchemaTagTree(testTree).prune({ match: 'Map' })
        expect(schemaToWML(tagTree.tree)).toEqual(deIndentWML(`
            <Asset key=(test)>
                <Room key=(room1)>
                    <Description>Test description: Added</Description>
                    <Name>Test room</Name>
                    <Exit to=(room2) />
                    <Position x="0" y="0" />
                </Room>
                <Room key=(room2) />
            </Asset>
        `))
    })

    it('should group edit tags with similar fields', () => {
        const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
            <Asset key=(test)>
                <Room key=(room1)>
                    <Description>Test description</Description>
                    <Name>Test room</Name>
                    <Exit to=(room2) />
                </Room>
                <Room key=(room2) />
                <Map key=(map1)>
                    <Room key=(room1)>
                        <Replace><Description>description</Description></Replace>
                        <With><Description>appearance</Description></With>
                        <Position x="0" y="0" />
                    </Room>
                </Map>
            </Asset>
        `))))
        const tagTree = new SchemaTagTree(testTree).prune({ match: 'Map' }).reorderedSiblings([['Description'], ['Name']])
        expect(schemaToWML(tagTree.tree)).toEqual(deIndentWML(`
            <Asset key=(test)>
                <Room key=(room1)>
                    <Description>Test description</Description>
                    <Replace><Description>description</Description></Replace>
                    <With><Description>appearance</Description></With>
                    <Name>Test room</Name>
                    <Exit to=(room2) />
                    <Position x="0" y="0" />
                </Room>
                <Room key=(room2) />
            </Asset>
        `))
    })

    it('should not condense adjacent condition statements', () => {
        const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
            <Asset key=(test)>
                <Room key=(room1)>
                    <Description>
                        Test
                        <If {false}>Item one</If><If {true}>Item two</If>
                    </Description>
                </Room>
            </Asset>
        `))))
        const tagTree = new SchemaTagTree(testTree)
        expect(schemaToWML(tagTree.tree)).toEqual(deIndentWML(`
            <Asset key=(test)>
                <Room key=(room1)>
                    <Description>
                        Test <If {false}>Item one</If><If {true}>Item two</If>
                    </Description>
                </Room>
            </Asset>
        `))
    })

})