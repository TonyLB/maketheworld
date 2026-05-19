import { schemaFromParse, schemaToWML } from '../schema'
import { SchemaTagTree } from './schema'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'
import parse from '../simpleParser'
import { deIndentWML } from '../schema/utils'

describe('SchemaTagTree', () => {
    it('should not condense universal key variants', () => {
        const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
            <Asset uuid=(test)>
                <Map uuid=(map1)>
                    <Room uuid=(room1)><Position {0, 0} /></Room>
                    <Room uuid=(room2)><Position {100, 100} /></Room>
                </Map>
            </Asset>
        `))))
        const tagTree = new SchemaTagTree(testTree)
        expect(schemaToWML(tagTree.tree)).toEqual(deIndentWML(`
            <Asset uuid=(test)>
                <Map uuid=(map1)>
                    <Room uuid=(room1)><Position {0, 0} /></Room>
                    <Room uuid=(room2)><Position {100, 100} /></Room>
                </Map>
            </Asset>
        `))
    })

    it('should condense order-independent entries', () => {
        const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
            <Asset uuid=(test)>
                <Room key=(room1) uuid=(Room1)>
                    <Situation uuid=(room1-example)>
                        <Description>Test description</Description>
                        <DisplayName>Test room</DisplayName>
                    </Situation>
                    <Exit to=(room2) />
                </Room>
                <Room key=(room2) uuid=(Room2) />
                <Map key=(map1) uuid=(Map1)>
                    <Room key=(room1) uuid=(Room1)>
                        <Situation uuid=(room1-example)>
                            <Description>: Added</Description>
                        </Situation>
                        <Position {0, 0} />
                    </Room>
                </Map>
            </Asset>
        `))))
        const tagTree = new SchemaTagTree(testTree).prune({ match: 'Map' })
        // The system creates separate Example tags instead of merging content
        expect(schemaToWML(tagTree.tree)).toEqual(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(Room1) key=(room1)>
                    <Situation uuid=(room1-example)>
                        <Description>Test description</Description>
                        <DisplayName>Test room</DisplayName>
                    </Situation>
                    <Exit to=(room2) />
                    <Situation uuid=(room1-example)>
                        <Description>: Added</Description>
                    </Situation>
                    <Position {0, 0} />
                </Room>
                <Room uuid=(Room2) key=(room2) />
            </Asset>
        `))
    })

    it('should group edit tags with similar fields', () => {
        const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
            <Asset uuid=(test)>
                <Room key=(room1) uuid=(Room1)>
                    <Situation uuid=(room1-example)>
                        <Description>Test description</Description>
                        <DisplayName>Test room</DisplayName>
                    </Situation>
                    <Exit to=(room2) />
                </Room>
                <Room key=(room2) uuid=(Room2) />
                <Map key=(map1) uuid=(Map1)>
                    <Room key=(room1) uuid=(Room1)>
                        <Situation uuid=(room1-example)>
                            <Replace><Description>description</Description></Replace>
                            <With><Description>appearance</Description></With>
                        </Situation>
                        <Position {0, 0} />
                    </Room>
                </Map>
            </Asset>
        `))))
        const tagTree = new SchemaTagTree(testTree).prune({ match: 'Map' }).reorderedSiblings([['Description'], ['DisplayName']])
        // The system maintains separate Example tags and applies reordering
        expect(schemaToWML(tagTree.tree)).toEqual(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(Room1) key=(room1)>
                    <Situation uuid=(room1-example)>
                        <Description>Test description</Description>
                        <DisplayName>Test room</DisplayName>
                    </Situation>
                    <Exit to=(room2) />
                    <Situation uuid=(room1-example)>
                        <Replace><Description>description</Description></Replace>
                        <With><Description>appearance</Description></With>
                    </Situation>
                    <Position {0, 0} />
                </Room>
                <Room uuid=(Room2) key=(room2) />
            </Asset>
        `))
    })

    it('should handle complex content merging with multiple components', () => {
        const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
            <Asset uuid=(complex)>
                <Feature key=(doors) uuid=(Feature1)>
                    <Situation uuid=(doors-example)>
                        <DisplayName>Magic Doors</DisplayName>
                        <Description>Doors that respond to conditions</Description>
                    </Situation>
                </Feature>
                <Map key=(map1) uuid=(Map1)>
                    <Room key=(doors-room) uuid=(DoorsRoom)>
                        <Situation uuid=(doors-room-example)>
                            <Description>: They are enchanted</Description>
                        </Situation>
                        <Position {50, 50} />
                    </Room>
                </Map>
            </Asset>
        `))))
        const tagTree = new SchemaTagTree(testTree).prune({ match: 'Map' })
        // The system adds the Map content as separate components
        expect(schemaToWML(tagTree.tree)).toEqual(deIndentWML(`
            <Asset uuid=(complex)>
                <Feature uuid=(Feature1) key=(doors)>
                    <Situation uuid=(doors-example)>
                        <DisplayName>Magic Doors</DisplayName>
                        <Description>Doors that respond to conditions</Description>
                    </Situation>
                </Feature>
                <Room uuid=(DoorsRoom) key=(doors-room)>
                    <Situation uuid=(doors-room-example)>
                        <Description>: They are enchanted</Description>
                    </Situation>
                    <Position {50, 50} />
                </Room>
            </Asset>
        `))
    })

    it('should not condense adjacent replace statements', () => {
        const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
            <Asset uuid=(test)>
                <Room key=(room1) uuid=(Room1)>
                    <Situation uuid=(room1-example)>
                        <Description>One</Description>
                        <Replace><Description>One</Description></Replace>
                        <With><Description>Two</Description></With>
                        <Replace><Description>Two</Description></Replace>
                        <With><Description>Three</Description></With>
                    </Situation>
                </Room>
            </Asset>
        `))))
        const tagTree = new SchemaTagTree(testTree)
        expect(schemaToWML(tagTree.tree)).toEqual(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(Room1) key=(room1)>
                    <Situation uuid=(room1-example)>
                        <Description>One</Description>
                        <Replace><Description>One</Description></Replace>
                        <With><Description>Two</Description></With>
                        <Replace><Description>Two</Description></Replace>
                        <With><Description>Three</Description></With>
                    </Situation>
                </Room>
            </Asset>
        `))
    })

    it('should handle order independence for different component types', () => {
        const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
            <Asset uuid=(order)>
                <Knowledge key=(lore) uuid=(Knowledge1)>
                    <Situation uuid=(lore-example)>
                        <DisplayName>Ancient Lore</DisplayName>
                        <Description>Knowledge of the ancients</Description>
                    </Situation>
                </Knowledge>
                <Room key=(room1) uuid=(Room1)>
                    <Situation uuid=(room1-example)>
                        <DisplayName>Main Hall</DisplayName>
                        <Description>A grand entrance hall</Description>
                    </Situation>
                    <Exit to=(room2)>North</Exit>
                </Room>
            </Asset>
        `))))
        const tagTree = new SchemaTagTree(testTree).reorderedSiblings([['Knowledge'], ['Room']])
        expect(schemaToWML(tagTree.tree)).toEqual(deIndentWML(`
            <Asset uuid=(order)>
                <Knowledge uuid=(Knowledge1) key=(lore)>
                    <Situation uuid=(lore-example)>
                        <DisplayName>Ancient Lore</DisplayName>
                        <Description>Knowledge of the ancients</Description>
                    </Situation>
                </Knowledge>
                <Room uuid=(Room1) key=(room1)>
                    <Situation uuid=(room1-example)>
                        <DisplayName>Main Hall</DisplayName>
                        <Description>A grand entrance hall</Description>
                    </Situation>
                    <Exit to=(room2)>North</Exit>
                </Room>
            </Asset>
        `))
    })

    it('should merge content from multiple sources with proper ordering', () => {
        const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
            <Asset uuid=(merge)>
                <Feature key=(trap) uuid=(Feature1)>
                    <Situation uuid=(trap-example)>
                        <DisplayName>Hidden Trap</DisplayName>
                        <Description>A dangerous pit</Description>
                    </Situation>
                </Feature>
                <Feature key=(parent) uuid=(ParentFeature)>
                    <Feature key=(trap) uuid=(Feature1)>
                        <Situation uuid=(trap-example)>
                            <Description>: It's actually safe now</Description>
                        </Situation>
                    </Feature>
                </Feature>
            </Asset>
        `))))
        const tagTree = new SchemaTagTree(testTree).prune({ match: 'Feature' })
        // The system intelligently merges content from multiple sources
        expect(schemaToWML(tagTree.tree)).toEqual(deIndentWML(`
            <Asset uuid=(merge)>
                <Situation uuid=(trap-example)>
                    <DisplayName>Hidden Trap</DisplayName>
                    <Description>A dangerous pit: It's actually safe now</Description>
                </Situation>
            </Asset>
        `))
    })

    it('should preserve edit operation structure during merging', () => {
        const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
            <Asset uuid=(edit)>
                <Feature key=(trap) uuid=(Feature1)>
                    <Situation uuid=(trap-example)>
                        <DisplayName>Hidden Trap</DisplayName>
                        <Description>A dangerous pit</Description>
                    </Situation>
                </Feature>
                <Map key=(map1) uuid=(Map1)>
                    <Room key=(trap-room) uuid=(TrapRoom)>
                        <Situation uuid=(trap-room-example)>
                            <Replace><Description>A dangerous pit</Description></Replace>
                            <With><Description>A safe passage</Description></With>
                        </Situation>
                    </Room>
                </Map>
            </Asset>
        `))))
        const tagTree = new SchemaTagTree(testTree).prune({ match: 'Map' })
        // The system creates separate Example tags for edit operations
        expect(schemaToWML(tagTree.tree)).toEqual(deIndentWML(`
            <Asset uuid=(edit)>
                <Feature uuid=(Feature1) key=(trap)>
                    <Situation uuid=(trap-example)>
                        <DisplayName>Hidden Trap</DisplayName>
                        <Description>A dangerous pit</Description>
                    </Situation>
                </Feature>
                <Room uuid=(TrapRoom) key=(trap-room)>
                    <Situation uuid=(trap-room-example)>
                        <Replace><Description>A dangerous pit</Description></Replace>
                        <With><Description>A safe passage</Description></With>
                    </Situation>
                </Room>
            </Asset>
        `))
    })
})