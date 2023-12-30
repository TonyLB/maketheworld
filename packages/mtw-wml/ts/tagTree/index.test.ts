import TagTree, { iterativeMerge } from '.'
import { schemaFromParse, schemaToWML } from '../simpleSchema'
import parse from '../simpleParser'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'
import { deIndentWML } from '../simpleSchema/utils'
import { SchemaTag, isSchemaBookmark, isSchemaWithKey } from '../simpleSchema/baseClasses'
import { deepEqual } from '../lib/objects'

const classify = ({ tag }: SchemaTag) => (tag)
const compare = (A: SchemaTag, B: SchemaTag) => {
    if (isSchemaWithKey(A)) {
        return (isSchemaWithKey(B) && A.key === B.key)
    }
    return deepEqual(A, B)
}

describe('TagTree', () => {
    describe('tagListFromTree', () => {
        it('should create a tag list properly', () => {
            const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
                <Asset key=(test)>
                    <Room key=(room1)>
                        <Description>Test description</Description>
                        <Name>Test room</Name>
                        <Exit to=(room2) />
                        <Description>: Added</Description>
                    </Room>
                    <Room key=(room2) />
                </Asset>
            `))))
            const tagTree = new TagTree({ tree: testTree, classify, compare, orderIndependence: [['Description', 'Name', 'Exit']] })
            expect(tagTree._tagList).toEqual([
                [
                    { tag: 'Asset', key: 'test', contents: [] },
                    { tag: 'Room', key: 'room1', contents: [] },
                    { tag: 'Description', contents: [] },
                    { tag: 'String', value: 'Test description' },
                ],
                [
                    { tag: 'Asset', key: 'test', contents: [] },
                    { tag: 'Room', key: 'room1', contents: [] },
                    { tag: 'Name', contents: [] },
                    { tag: 'String', value: 'Test room' },
                ],
                [
                    { tag: 'Asset', key: 'test', contents: [] },
                    { tag: 'Room', key: 'room1', contents: [] },
                    { tag: 'Exit', key: 'room1#room2', from: 'room1', to: 'room2', name: '', contents: [] }
                ],
                [
                    { tag: 'Asset', key: 'test', contents: [] },
                    { tag: 'Room', key: 'room1', contents: [] },
                    { tag: 'Description', contents: [] },
                    { tag: 'String', value: ': Added' },
                ],
                [
                    { tag: 'Asset', key: 'test', contents: [] },
                    { tag: 'Room', key: 'room2', contents: [] }
                ]
            ])
        })
    })

    describe('iterativeMerge', () => {
        const mergeClassify = (value: string) => (value.startsWith('WRAP-') ? 'WRAP' : value)
        it('should merge data into an empty tree', () => {
            expect(iterativeMerge({ classify: mergeClassify })([], ['test'])).toEqual([{ data: 'test', children: [] }])
            expect(iterativeMerge({ classify: mergeClassify })([], ['testA', 'testB', 'testC'])).toEqual([{ data: 'testA', children: [{ data: 'testB', children: [{ data: 'testC', children: [] }] }] }])
        })

        it('should merge data into an existing tree', () => {
            const testTree = [{
                data: 'testA',
                children: [
                    { data: 'testB', children: [{ data: 'testC', children: [] }] }
                ]
            }]
            expect(iterativeMerge({ classify: mergeClassify })(testTree, ['testA', 'testB', 'testD'])).toEqual([{
                data: 'testA',
                children: [{
                    data: 'testB',
                    children: [
                        { data: 'testC', children: [] },
                        { data: 'testD', children: [] }
                    ]
                }]
            }])
            expect(iterativeMerge({ classify: mergeClassify })(testTree, ['testA', 'testD'])).toEqual([{
                data: 'testA',
                children: [
                    {
                        data: 'testB',
                        children: [{ data: 'testC', children: [] }]
                    },
                    { data: 'testD', children: [] }
                ]
            }])

        })

        it('should reorder order-independent tags where useful', () => {
            const testTree = [{
                data: 'testA',
                children: [
                    { data: 'WRAP-testB', children: [{ data: 'testD', children: [] }] },
                    { data: 'WRAP-testC', children: [{ data: 'testE', children: [] }] }
                ]
            }]
            expect(iterativeMerge({ classify: mergeClassify, orderIndependence: [['WRAP', 'WRAP']] })(testTree, ['testA', 'WRAP-testB', 'WRAP-testF'])).toEqual([{
                data: 'testA',
                children: [
                    {
                        data: 'WRAP-testB',
                        children: [
                            { data: 'testD', children: [] },
                            { data: 'WRAP-testF', children: [] }
                        ]
                    },
                    {
                        data: 'WRAP-testC',
                        children: [{ data: 'testE', children: [] }]
                    }
                ]
            }])

        })

    }) 

    it('should return tree unchanged on empty arguments', () => {
        const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
            <Asset key=(test)>
                <Room key=(room1)>
                    <Name>Test room</Name>
                    <Exit to=(room2) />
                </Room>
                <Room key=(room2) />
            </Asset>
        `))))
        const tagTree = new TagTree({ tree: testTree, classify, compare })
        expect(tagTree.tree).toEqual(testTree)
    })

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
        const tagTree = new TagTree({ tree: testTree, classify, compare, orderIndependence: [['Description', 'Name', 'Exit'], ['Room', 'Feature', 'Knowledge', 'Message', 'Moment']] })
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

    it('should reorder tags correctly', () => {
        const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
            <Asset key=(test)>
                <Room key=(room1)>
                    <Name>Lobby</Name>
                    <Description>An institutional lobby.</Description>
                </Room>
                <If {true}>
                    <Room key=(room1)>
                        <Name><Space />at night</Name>
                        <Description><Space />The lights are out, and shadows stretch along the walls.</Description>
                    </Room>
                </If>
            </Asset>
        `))))
        const tagTree = new TagTree({ tree: testTree, classify, compare, orderIndependence: [['Description', 'Name', 'Exit'], ['Room', 'Feature', 'Knowledge', 'Message', 'Moment']] })
        const reorderedTree = tagTree.reordered(['Room', 'Description', 'Name', 'If'])
        expect(schemaToWML(reorderedTree.tree)).toEqual(deIndentWML(`
            <Asset key=(test)>
                <Room key=(room1)>
                    <Name>Lobby<If {true}><Space />at night</If></Name>
                    <Description>
                        An institutional
                        lobby.<If {true}>
                            <Space />
                            The lights are out, and shadows stretch along the walls.
                        </If>
                    </Description>
                </Room>
            </Asset>
        `))
    })

    describe('filter', () => {
        it('should filter tags correctly', () => {
            const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
                <Asset key=(test)>
                    <Room key=(room1)>
                        <Name>Lobby</Name>
                        <Description>An institutional lobby.</Description>
                    </Room>
                    <Feature key=(clockTower)><Description>A square clock-tower of yellow stone.</Description></Feature>
                    <Room key=(room2)><Description>A boring test room</Description></Room>
                    <If {true}>
                        <Room key=(room1)>
                            <Name><Space />at night</Name>
                            <Description><Space />The lights are out, and shadows stretch along the walls.</Description>
                        </Room>
                    </If>
                </Asset>
            `))))
            const tagTree = new TagTree({ tree: testTree, classify, compare, orderIndependence: [['Description', 'Name', 'Exit'], ['Room', 'Feature', 'Knowledge', 'Message', 'Moment']] })
            const filteredTreeOne = tagTree.filter({ nodes: [{ tag: 'Room', key: 'room1', contents: [] }], classes: ['Description'], prune: ['Asset', 'Room', 'Description'] })
            expect(schemaToWML(filteredTreeOne.tree)).toEqual(deIndentWML(`
                An institutional lobby.
                <If {true}>
                    <Space />
                    The lights are out, and shadows stretch along the walls.
                </If>
            `))
            const filteredTreeTwo = tagTree.filter({ nodes: [{ tag: 'Room', key: 'room1', contents: [] }], classes: ['Name'], prune: ['Asset', 'Room', 'Name'] })
            expect(schemaToWML(filteredTreeTwo.tree)).toEqual(deIndentWML(`
                Lobby
                <If {true}><Space />at night</If>
            `))
            const filteredTreeThree = tagTree.reordered(['Room', 'Description', 'Name', 'If']).filter({ classes: ['Room', 'Description'], prune: ['Asset'] })
            expect(schemaToWML(filteredTreeThree.tree)).toEqual(deIndentWML(`
                <Room key=(room1)>
                    <Description>
                        An institutional
                        lobby.<If {true}>
                            <Space />
                            The lights are out, and shadows stretch along the walls.
                        </If>
                    </Description>
                </Room>
                <Room key=(room2)><Description>A boring test room</Description></Room>
            `))
        })    
    })

    describe('prune', () => {
        it('should prune specific classes on direct match', () => {
            const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
                <Asset key=(test)>
                    <Room key=(room1)>
                        <Name>Lobby</Name>
                        <Description>An institutional lobby.</Description>
                    </Room>
                    <Feature key=(clockTower)><Description>A square clock-tower of yellow stone.</Description></Feature>
                    <Room key=(room2)><Description>A boring test room</Description></Room>
                    <If {true}>
                        <Room key=(room1)>
                            <Name><Space />at night</Name>
                            <Description><Space />The lights are out, and shadows stretch along the walls.</Description>
                        </Room>
                    </If>
                </Asset>
            `))))
            const tagTree = new TagTree({ tree: testTree, classify, compare, orderIndependence: [['Description', 'Name', 'Exit'], ['Room', 'Feature', 'Knowledge', 'Message', 'Moment']] })
            const prunedTreeOne = tagTree.prune([{ match: 'Asset' }, { match: 'Name' }, { match: 'Description' }])
            expect(schemaToWML(prunedTreeOne.tree)).toEqual(deIndentWML(`
                <Room key=(room1)>LobbyAn institutional lobby.</Room>
                <Feature key=(clockTower)>A square clock-tower of yellow stone.</Feature>
                <Room key=(room2)>A boring test room</Room>
                <If {true}>
                    <Room key=(room1)>
                        <Space />
                        at night
                        <Space />
                        The lights are out, and shadows stretch along the walls.
                    </Room>
                </If>
            `))
        })

        it('should prune specific classes on after match', () => {
            const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
                <Asset key=(test)>
                    <Room key=(room1)>
                        <Name>Lobby</Name>
                        <Description>An institutional lobby.</Description>
                    </Room>
                    <Feature key=(clockTower)><Description>A square clock-tower of yellow stone.</Description></Feature>
                    <Room key=(room2)><Description>A boring test room</Description></Room>
                    <If {true}>
                        <Room key=(room1)>
                            <Name><Space />at night</Name>
                            <Description><Space />The lights are out, and shadows stretch along the walls.</Description>
                        </Room>
                    </If>
                </Asset>
            `))))
            const tagTree = new TagTree({ tree: testTree, classify, compare, orderIndependence: [['Description', 'Name', 'Exit'], ['Room', 'Feature', 'Knowledge', 'Message', 'Moment']] })
            const prunedTreeOne = tagTree.prune([{ match: 'Asset' }, { after: 'Feature' }, { after: 'Room' }])
            expect(schemaToWML(prunedTreeOne.tree)).toEqual(deIndentWML(`
                <Room key=(room1) />
                <Feature key=(clockTower) />
                <Room key=(room2) />
                <If {true}><Room key=(room1) /></If>
            `))
        })

        it('should prune specific classes on before match', () => {
            const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
                <Asset key=(test)>
                    <Room key=(room1)>
                        <Name>Lobby</Name>
                        <Description>An institutional lobby.</Description>
                    </Room>
                    <Feature key=(clockTower)><Description>A square clock-tower of yellow stone.</Description></Feature>
                    <Room key=(room2)><Description>A boring test room</Description></Room>
                    <If {true}>
                        <Room key=(room1)>
                            <Name><Space />at night</Name>
                            <Description><Space />The lights are out, and shadows stretch along the walls.</Description>
                        </Room>
                    </If>
                </Asset>
            `))))
            const tagTree = new TagTree({ tree: testTree, classify, compare, orderIndependence: [['Description', 'Name', 'Exit'], ['Room', 'Feature', 'Knowledge', 'Message', 'Moment']] })
            const prunedTreeOne = tagTree.prune([{ before: 'Feature' }, { before: 'Room' }])
            expect(schemaToWML(prunedTreeOne.tree)).toEqual(deIndentWML(`
                <Room key=(room1)>
                    <Name>Lobby<Space />at night</Name>
                    <Description>
                        An institutional lobby.
                        <Space />
                        The lights are out, and shadows stretch along the walls.
                    </Description>
                </Room>
                <Feature key=(clockTower)>
                    <Description>A square clock-tower of yellow stone.</Description>
                </Feature>
                <Room key=(room2)><Description>A boring test room</Description></Room>
            `))
        })

        it('should prune everything except specific classes on not match', () => {
            const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
                <Asset key=(test)>
                    <Room key=(room1)>
                        <Name>Lobby</Name>
                        <Description>An institutional lobby.</Description>
                    </Room>
                    <Feature key=(clockTower)><Description>A square clock-tower of yellow stone.</Description></Feature>
                    <Room key=(room2)><Description>A boring test room</Description></Room>
                    <If {true}>
                        <Room key=(room1)>
                            <Name><Space />at night</Name>
                            <Description><Space />The lights are out, and shadows stretch along the walls.</Description>
                        </Room>
                    </If>
                </Asset>
            `))))
            const tagTree = new TagTree({ tree: testTree, classify, compare, orderIndependence: [['Description', 'Name', 'Exit'], ['Room', 'Feature', 'Knowledge', 'Message', 'Moment']] })
            const prunedTreeOne = tagTree.prune([{ not: ['Feature', 'Room'] }])
            expect(schemaToWML(prunedTreeOne.tree)).toEqual(deIndentWML(`
                <Room key=(room1) />
                <Feature key=(clockTower) />
                <Room key=(room2) />
            `))
        })

        it('should prune specific node values', () => {
            const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
                <Asset key=(test)>
                    <Bookmark key=(bookmark1)>
                        Test <Bookmark key=(bookmark2)>Red herring</Bookmark>
                    </Bookmark>
                    <If {true}><Bookmark key=(bookmark1)>More data</Bookmark></If>
                </Asset>
            `))))
            const tagTree = new TagTree({ tree: testTree, classify, compare, orderIndependence: [['Description', 'Name', 'Exit'], ['Room', 'Feature', 'Knowledge', 'Message', 'Moment']] })
            const prunedTreeOne = tagTree.prune([{ before: { tag: 'Bookmark', key: 'bookmark1', contents: [] } }, { after: (node) => (isSchemaBookmark(node) && node.key !== 'bookmark1') }])
            expect(schemaToWML(prunedTreeOne.tree)).toEqual(deIndentWML(`
                <Bookmark key=(bookmark1)>Test <Bookmark key=(bookmark2) />More data</Bookmark>
            `))
        })

    })

})