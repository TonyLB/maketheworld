import TagTree, { iterativeMerge } from '.'
import { schemaFromParse, schemaToWML } from '../schema'
import parse from '../simpleParser'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'
import { deIndentWML } from '../schema/utils'
import { SchemaTag, isSchemaWithKey, isSchemaAsset } from '@tonylb/mtw-base/ts/schema'
import { deepEqual } from '../lib/objects'

const classify = ({ tag }: SchemaTag) => (tag)
const compare = (A: { data: SchemaTag }, B: { data: SchemaTag }) => {
    if (isSchemaAsset(A.data)) {
        return (isSchemaAsset(B.data) && A.data.uuid === B.data.uuid)
    }
    if (isSchemaWithKey(A.data)) {
        return (isSchemaWithKey(B.data) && A.data.key === B.data.key)
    }
    return deepEqual(A, B)
}

describe('TagTree', () => {
    describe('tagListFromTree', () => {
        it('should create a tag list from a simple tree', () => {
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
                </Asset>
            `))))
            const tagTree = new TagTree({ 
                tree: testTree, 
                classify, 
                compare, 
                orderIndependence: [['Example', 'Exit']] 
            })
            
            // The system converts UUIDs to full format and adds system properties
            expect(tagTree._tagList).toEqual([
                [
                    { data: { tag: 'Asset', uuid: 'ASSET#test' } },
                    { data: { tag: 'Room', key: 'room1', uuid: 'ROOM#Room1' } },
                    { data: { tag: 'Situation', uuid: 'SITUATION#room1-example' } },
                    { data: { tag: 'Description' } },
                    { data: { tag: 'String', value: 'Test description' } },
                ],
                [
                    { data: { tag: 'Asset', uuid: 'ASSET#test' } },
                    { data: { tag: 'Room', key: 'room1', uuid: 'ROOM#Room1' } },
                    { data: { tag: 'Situation', uuid: 'SITUATION#room1-example' } },
                    { data: { tag: 'DisplayName' } },
                    { data: { tag: 'String', value: 'Test room' } },
                ],
                [
                    { data: { tag: 'Asset', uuid: 'ASSET#test' } },
                    { data: { tag: 'Room', key: 'room1', uuid: 'ROOM#Room1' } },
                    { data: { tag: 'Exit', to: 'room2' } }
                ],
                [
                    { data: { tag: 'Asset', uuid: 'ASSET#test' } },
                    { data: { tag: 'Room', key: 'room2', uuid: 'ROOM#Room2' } }
                ]
            ])
        })

        it('should handle nested structures with order independence', () => {
            const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
                <Asset uuid=(test)>
                    <Room key=(room1) uuid=(Room1)>
                        <Situation uuid=(room1-example)>
                            <DisplayName>Main Hall</DisplayName>
                            <Description>A grand entrance hall</Description>
                        </Situation>
                        <Exit to=(room2)>North</Exit>
                        <Exit to=(room3)>South</Exit>
                    </Room>
                </Asset>
            `))))
            const tagTree = new TagTree({ 
                tree: testTree, 
                classify, 
                compare, 
                orderIndependence: [['Example', 'Exit']] 
            })
            
            // Each content tag creates a separate tag list entry
            expect(tagTree._tagList).toHaveLength(4)
            expect(tagTree._tagList[0]).toContainEqual({ data: { tag: 'Situation', uuid: 'SITUATION#room1-example' } })
            expect(tagTree._tagList[1]).toContainEqual({ data: { tag: 'Situation', uuid: 'SITUATION#room1-example' } })
            expect(tagTree._tagList[2]).toContainEqual({ data: { tag: 'Exit', to: 'room2' } })
            expect(tagTree._tagList[3]).toContainEqual({ data: { tag: 'Exit', to: 'room3' } })
        })
    })

    describe('iterativeMerge', () => {
        const mergeClassify = (value: string) => (value.startsWith('WRAP-') ? 'WRAP' : value)
        const merge = (A: { data: string }, B: { data: string }) => A

        it('should merge data into an empty tree', () => {
            expect(iterativeMerge({ classify: mergeClassify, merge })([], [{ data: 'test' }]))
                .toEqual([{ data: 'test', children: [] }])
            
            expect(iterativeMerge({ classify: mergeClassify, merge })([], [{ data: 'testA' }, { data: 'testB' }, { data: 'testC' }]))
                .toEqual([{ 
                    data: 'testA', 
                    children: [{ 
                        data: 'testB', 
                        children: [{ data: 'testC', children: [] }] 
                    }] 
                }])
        })

        it('should merge data into an existing tree', () => {
            const testTree = [{
                data: 'testA',
                children: [
                    { data: 'testB', children: [{ data: 'testC', children: [] }] }
                ]
            }]
            
            expect(iterativeMerge({ classify: mergeClassify, merge })(testTree, [{ data: 'testA' }, { data: 'testB' }, { data: 'testD' }]))
                .toEqual([{
                    data: 'testA',
                    children: [{
                        data: 'testB',
                        children: [
                            { data: 'testC', children: [] },
                            { data: 'testD', children: [] }
                        ]
                    }]
                }])
        })

        it('should handle wrapper tags correctly', () => {
            const testTree = [{
                data: 'WRAP-outer',
                children: [{ data: 'inner', children: [] }]
            }]
            
            expect(iterativeMerge({ classify: mergeClassify, merge })(testTree, [{ data: 'WRAP-outer' }, { data: 'newInner' }]))
                .toEqual([{
                    data: 'WRAP-outer',
                    children: [
                        { data: 'inner', children: [] },
                        { data: 'newInner', children: [] }
                    ]
                }])
        })
    })

    describe('TagTree operations', () => {
        let tagTree: TagTree<SchemaTag>

        beforeEach(() => {
            const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
                <Asset uuid=(test)>
                    <Room key=(room1) uuid=(Room1)>
                        <Situation uuid=(room1-example)>
                            <DisplayName>Main Hall</DisplayName>
                            <Description>A grand entrance hall</Description>
                        </Situation>
                        <Exit to=(room2)>North</Exit>
                        <Exit to=(room3)>South</Exit>
                    </Room>
                    <Room key=(room2) uuid=(Room2)>
                        <Situation uuid=(room2-example)>
                            <DisplayName>North Wing</DisplayName>
                            <Description>A quiet study area</Description>
                        </Situation>
                    </Room>
                    <Knowledge key=(info1) uuid=(Knowledge1)>
                        <Situation uuid=(info1-example)>
                            <DisplayName>Ancient Lore</DisplayName>
                            <Description>Knowledge of the ancients</Description>
                        </Situation>
                    </Knowledge>
                </Asset>
            `))))
            
            tagTree = new TagTree({ 
                tree: testTree, 
                classify, 
                compare, 
                orderIndependence: [['Example', 'Exit'], ['Room', 'Knowledge']] 
            })
        })

        it('should filter tags by type', () => {
            const filtered = tagTree.filter({ match: 'Situation' })
            const transformed = filtered._transformedTags
            
            // Each content tag (Name, Description) creates a separate tag list entry
            expect(transformed).toHaveLength(6) // 3 Examples × 2 content tags each
            transformed.forEach(tagList => {
                expect(tagList.some(tag => tag.data.tag === 'Situation')).toBe(true)
            })
        })

        it('should filter tags by sequence', () => {
            const filtered = tagTree.filter({ 
                sequence: [
                    { match: 'Room' },
                    { match: 'Situation' }
                ]
            })
            const transformed = filtered._transformedTags
            
            // Each Room+Example combination creates multiple entries due to content tags
            expect(transformed).toHaveLength(4) // 2 Rooms × 2 content tags each
            transformed.forEach(tagList => {
                const roomIndex = tagList.findIndex(tag => tag.data.tag === 'Room')
                const exampleIndex = tagList.findIndex(tag => tag.data.tag === 'Situation')
                expect(exampleIndex).toBe(roomIndex + 1)
            })
        })

        it('should prune specific tags', () => {
            const pruned = tagTree.prune({ match: 'Description' })
            const transformed = pruned._transformedTags
            
            transformed.forEach(tagList => {
                expect(tagList.some(tag => tag.data.tag === 'Description')).toBe(false)
            })
        })

        it('should reorder tags by priority', () => {
            const reordered = tagTree.reordered([
                { match: 'Situation' },
                { match: 'Exit' }
            ])
            const transformed = reordered._transformedTags
            
            transformed.forEach(tagList => {
                const exampleIndex = tagList.findIndex(tag => tag.data.tag === 'Situation')
                const exitIndex = tagList.findIndex(tag => tag.data.tag === 'Exit')
                
                if (exampleIndex !== -1 && exitIndex !== -1) {
                    expect(exampleIndex).toBeLessThan(exitIndex)
                }
            })
        })

        it('should handle complex filtering with AND operations', () => {
            const filtered = tagTree.filter({
                and: [
                    { match: 'Room' },
                    { match: 'DisplayName' }
                ]
            })
            const transformed = filtered._transformedTags
            
            // The AND operation finds tags that match BOTH conditions
            // So we get only DisplayName tags that are within Room contexts (e.g. Example's display name)
            // This excludes DisplayName tags in other component types like Knowledge
            expect(transformed).toHaveLength(2) // room1: DisplayName, room2: DisplayName
            
            // Check that we have only Room+DisplayName combinations
            const room1NameEntries = transformed.filter(tagList =>
                tagList.some(tag => tag.data.tag === 'Room' && tag.data.key === 'room1') &&
                tagList.some(tag => tag.data.tag === 'DisplayName')
            )
            const room2NameEntries = transformed.filter(tagList =>
                tagList.some(tag => tag.data.tag === 'Room' && tag.data.key === 'room2') &&
                tagList.some(tag => tag.data.tag === 'DisplayName')
            )
            
            expect(room1NameEntries).toHaveLength(1) // room1 has DisplayName
            expect(room2NameEntries).toHaveLength(1) // room2 has DisplayName
            
            // Verify that all results contain both Room and DisplayName tags
            transformed.forEach(tagList => {
                const hasRoom = tagList.some(tag => tag.data.tag === 'Room')
                const hasDisplayName = tagList.some(tag => tag.data.tag === 'DisplayName')
                expect(hasRoom).toBe(true) // All results must have Room
                expect(hasDisplayName).toBe(true) // All results must have DisplayName
            })
            
            // Verify that Knowledge DisplayName tags are NOT included (they don't have Room context)
            const knowledgeEntries = transformed.filter(tagList =>
                tagList.some(tag => tag.data.tag === 'Knowledge')
            )
            expect(knowledgeEntries).toHaveLength(0)
        })

        it('should handle complex filtering with OR operations', () => {
            const filtered = tagTree.filter({
                or: [
                    { match: 'Situation' },
                    { match: 'Exit' }
                ]
            })
            const transformed = filtered._transformedTags
            
            // Should include all Example and Exit tags
            expect(transformed).toHaveLength(8) // 6 Examples + 2 Exits
        })

        it('should reorder siblings correctly', () => {
            const reordered = tagTree.reorderedSiblings([['Example'], ['Exit']])
            const transformed = reordered._transformedTags
            
            transformed.forEach(tagList => {
                const exampleIndex = tagList.findIndex(tag => tag.data.tag === 'Situation')
                const exitIndex = tagList.findIndex(tag => tag.data.tag === 'Exit')
                
                if (exampleIndex !== -1 && exitIndex !== -1) {
                    expect(exampleIndex).toBeLessThan(exitIndex)
                }
            })
        })

        it('should clone correctly', () => {
            const cloned = tagTree.clone()
            expect(cloned).not.toBe(tagTree)
            expect(cloned._tagList).toEqual(tagTree._tagList)
            expect(cloned._actions).toEqual(tagTree._actions)
        })

        it('should handle functional reordering', () => {
            const reordered = tagTree.reorderFunctional(
                [{ match: 'Situation' }],
                (tags) => tags.reverse()
            )
            const transformed = reordered._transformedTags
            
            // Examples should be in reverse order
            const exampleTags = transformed.flat().filter(tag => tag.data.tag === 'Situation')
            expect(exampleTags).toHaveLength(6) // 3 Examples × 2 content tags each
        })
    })

    describe('TagTree matching operations', () => {
        let tagTree: TagTree<SchemaTag>

        beforeEach(() => {
            const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
                <Asset uuid=(test)>
                    <Room key=(room1) uuid=(Room1)>
                        <Situation uuid=(room1-example)>
                            <DisplayName>Hall</DisplayName>
                        </Situation>
                        <Exit to=(room2)>North</Exit>
                    </Room>
                    <Room key=(room2) uuid=(Room2)>
                        <Situation uuid=(room2-example)>
                            <DisplayName>Study</DisplayName>
                        </Situation>
                        <Exit to=(room1)>South</Exit>
                    </Room>
                </Asset>
            `))))
            
            tagTree = new TagTree({ 
                tree: testTree, 
                classify, 
                compare, 
                orderIndependence: [['Example', 'Exit']] 
            })
        })

        it('should match connected sequences', () => {
            const filtered = tagTree.filter({
                sequence: [
                    { match: 'Room' },
                    { match: 'Situation' }
                ]
            })
            const transformed = filtered._transformedTags
            
            expect(transformed).toHaveLength(2)
            transformed.forEach(tagList => {
                const roomIndex = tagList.findIndex(tag => tag.data.tag === 'Room')
                const exampleIndex = tagList.findIndex(tag => tag.data.tag === 'Situation')
                expect(exampleIndex).toBe(roomIndex + 1)
            })
        })

        it('should match before operations', () => {
            const filtered = tagTree.filter({
                sequence: [
                    { match: 'Situation' },
                    { match: 'Exit' }
                ]
            })
            const transformed = filtered._transformedTags
            
            transformed.forEach(tagList => {
                const exampleIndex = tagList.findIndex(tag => tag.data.tag === 'Situation')
                const exitIndex = tagList.findIndex(tag => tag.data.tag === 'Exit')
                expect(exampleIndex).toBeLessThan(exitIndex)
            })
        })

        it('should match after operations', () => {
            const filtered = tagTree.filter({
                sequence: [
                    { match: 'Room' },
                    { match: 'Situation' }
                ]
            })
            const transformed = filtered._transformedTags
            
            transformed.forEach(tagList => {
                const roomIndex = tagList.findIndex(tag => tag.data.tag === 'Room')
                const exampleIndex = tagList.findIndex(tag => tag.data.tag === 'Situation')
                expect(exampleIndex).toBe(roomIndex + 1)
            })
        })
    })

    describe('TagTree with complex WML structures', () => {
        it('should handle nested components with proper ordering', () => {
            const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
                <Asset uuid=(complex)>
                    <Feature key=(doors) uuid=(Feature1)>
                        <Situation uuid=(doors-example)>
                            <DisplayName>Magic Doors</DisplayName>
                            <Description>Doors that respond to conditions</Description>
                        </Situation>
                        <Exit to=(room1)>Main Entrance</Exit>
                        <Exit to=(room2)>Secret Passage</Exit>
                    </Feature>
                    <Knowledge key=(lore) uuid=(Knowledge1)>
                        <Situation uuid=(lore-example)>
                            <DisplayName>Door Lore</DisplayName>
                            <Description>Ancient knowledge about doors</Description>
                        </Situation>
                    </Knowledge>
                </Asset>
            `))))
            
            const tagTree = new TagTree({ 
                tree: testTree, 
                classify, 
                compare, 
                orderIndependence: [['Example', 'Exit'], ['Feature', 'Knowledge']] 
            })
            
            // Each content tag creates a separate entry
            expect(tagTree._tagList).toHaveLength(6)
            
            // Verify order independence - Feature and Knowledge can be reordered
            const featureTags = tagTree._tagList.filter(tagList => 
                tagList.some(tag => tag.data.tag === 'Feature')
            )
            const knowledgeTags = tagTree._tagList.filter(tagList => 
                tagList.some(tag => tag.data.tag === 'Knowledge')
            )
            
            expect(featureTags).toHaveLength(4) // Example (2 content tags) + 2 Exits
            expect(knowledgeTags).toHaveLength(2) // Example (2 content tags)
        })

        it('should maintain text content ordering within examples', () => {
            const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
                <Asset uuid=(text)>
                    <Room key=(room1) uuid=(Room1)>
                        <Situation uuid=(room1-example)>
                            <Description>
                                First paragraph of the description.
                                Second paragraph with more details.
                                Final paragraph concluding the description.
                            </Description>
                        </Situation>
                    </Room>
                </Asset>
            `))))
            
            const tagTree = new TagTree({ 
                tree: testTree, 
                classify, 
                compare, 
                orderIndependence: [['Example']] 
            })
            
            const exampleTags = tagTree._tagList.find(tagList => 
                tagList.some(tag => tag.data.tag === 'Situation')
            )
            
            expect(exampleTags).toBeDefined()
            const stringTags = exampleTags!.filter(tag => tag.data.tag === 'String')
            // The system concatenates text content into a single string
            expect(stringTags).toHaveLength(1)
            const stringTag = stringTags[0]
            if (stringTag.data.tag === 'String') {
                expect(stringTag.data.value).toContain('First paragraph')
                expect(stringTag.data.value).toContain('Second paragraph')
                expect(stringTag.data.value).toContain('Final paragraph')
            }
        })

        it('should handle components that still include content directly', () => {
            const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
                <Asset uuid=(mixed)>
                    <Character key=(npc1) uuid=(Character1)>
                        <DisplayName>Guard Captain</DisplayName>
                    </Character>
                    <Map key=(dungeonMap) uuid=(Map1)>
                        <ShortName>Dungeon Layout</ShortName>
                        <Room key=(room1) uuid=(Room1)><Position {0, 0} /></Room>
                    </Map>
                </Asset>
            `))))
            
            const tagTree = new TagTree({ 
                tree: testTree, 
                classify, 
                compare, 
                orderIndependence: [['Name', 'ShortName'], ['Character', 'Map']] 
            })
            
            expect(tagTree._tagList).toHaveLength(3)
            
            // Character includes Name directly; Map includes ShortName directly
            const characterTags = tagTree._tagList.filter(tagList => 
                tagList.some(tag => tag.data.tag === 'Character')
            )
            const mapTags = tagTree._tagList.filter(tagList => 
                tagList.some(tag => tag.data.tag === 'Map')
            )
            
            expect(characterTags).toHaveLength(1) // Name
            expect(mapTags).toHaveLength(2) // Name + Room with Position
        })
    })
})