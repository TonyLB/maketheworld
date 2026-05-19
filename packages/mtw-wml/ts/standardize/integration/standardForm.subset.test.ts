import { Schema, schemaToWML, treeFromWML } from '../../schema'
import { StandardForm, hasShortName } from '..'
import { deIndentWML } from '../../schema/utils'
import { GenericTreeNode } from '@tonylb/mtw-base/ts/genericTree'
import { SchemaTag } from '@tonylb/mtw-base/ts/schema'
import StandardRoom from '../components/room'
import StandardKnowledge from '../components/knowledge'
import StandardCharacter from '../components/character'
import { ReferenceList } from '../keys/referenceList'
import StandardReference from '../keys/reference'
import { StandardKey } from '../keys/key'
import StandardFeature from '../components/feature'
import StandardSituation from '../components/situation'
import { StandardLiteral } from '../literal'
import StandardMap from '../components/map'
import StandardMark, { StandardLens } from '../components/worldState'
import { StandardMarkFacet } from '../keys/facets/mark'
import { StandardExplicitKey } from '../explicit/key'
import { isStandardForm, isStandardFormInput, StandardFormData } from '../components/dataTypes'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})


describe('StandardForm', () => {
    describe('subset method', () => {
        it('should properly subset an asset with full content without cascade', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Knowledge key=(testKnowledge)>
                        <Situation ref={0} uuid=(001)>
                            <Description><Link to=(FEATURE#testFeature)>link</Link></Description>
                        </Situation>
                    </Knowledge>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                    <Room key=(testRoomTwo) />
                    <Feature uuid=(testFeature) key=(testFeature) />
                </Asset>
            `)
            const subset = test.subset([{ requestType: 'Full', keys: [new StandardKey({ key: 'testRoom', tag: 'Room' })] }])
            //
            // Note that the Example link cannot be resolved by `requestType: 'Full'`, because it is implicitly a reference
            // to an Example component, which is not included in the subset due to the lack of cascades.
            //
            expect(schemaToWML([subset.schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                </Asset>
            `))
        })

        it('should properly subset an asset with full content with a direct cascade', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Knowledge key=(testKnowledge)>
                        <Situation ref={0} uuid=(001)>
                            <Description><Link to=(FEATURE#testFeature)>link</Link></Description>
                        </Situation>
                    </Knowledge>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                    <Room key=(testRoomTwo) />
                    <Feature uuid=(testFeature) key=(testFeature) />
                </Asset>
            `)
            const subset = test.subset([{
                requestType: 'Full',
                keys: [new StandardKey({ key: 'testKnowledge', tag: 'Knowledge' })],
                cascadeConditions: [{
                    graph: [
                        {
                            name: 'knowledge',
                            requestType: 'Full',
                            transitions: [
                                { connectionType: 'Direct', targetNode: 'nested' }
                            ]
                        },
                        {
                            name: 'nested',
                            requestType: 'Full',
                            transitions: []
                        }
                    ],
                    startNodes: ['knowledge']
                }]
            }])
            expect(schemaToWML([subset.schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Situation uuid=(001) ref={0} />
                    <Knowledge key=(testKnowledge)>
                        <Situation uuid=(001) ref={0}>
                            <Description>
                                <Link to=(FEATURE#testFeature)>link</Link>
                            </Description>
                        </Situation>
                    </Knowledge>
                </Asset>
            `))
        })    

        it('should properly subset an asset with exit content without cascade', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Situation uuid=(DEFAULT) ref={0} key=(base)>
                            <Description><Link to=(FEATURE#testFeature)>link</Link></Description>
                        </Situation>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                    <Room key=(testRoomTwo) />
                    <Feature uuid=(testFeature) key=(testFeature) />
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'ExitsAndShortName', keys: [new StandardKey({ key: 'testRoom', tag: 'Room' })] }]).schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                </Asset>
            `))
        })

        it('should properly subset a cascade with exits', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Map uuid=(testMap)>
                        <Room uuid=(room1)>
                            <Position {0, 0} />
                            <Exit to=(ROOM#room2)>room2</Exit>
                        </Room>
                        <Room uuid=(room2)>
                            <Position {100, 100} />
                            <Exit to=(ROOM#room1)>room1</Exit>
                        </Room>
                    </Map>
                </Asset>
            `)
            const results = test.subset([{
                requestType: 'Full',
                keys: [new StandardKey(`MAP#testMap`)],
                cascadeConditions: [{ 
                    graph: [
                        {
                            name: 'map',
                            requestType: 'Full',
                            transitions: [
                                { connectionType: 'Position', targetNode: 'room' }
                            ]
                        },
                        {
                            name: 'room',
                            requestType: 'ExitsAndShortName',
                            transitions: []
                        }
                    ],
                    startNodes: ['map']
                }]
            }])
            expect(results.byUniversalId['ROOM#room1']).toBeInstanceOf(StandardRoom)
            expect(schemaToWML([results.schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Map uuid=(testMap)>
                        <Room uuid=(room1)>
                            <Position {0, 0} />
                            <Exit to=(ROOM#room2)>room2</Exit>
                        </Room>
                        <Room uuid=(room2)>
                            <Position {100, 100} />
                            <Exit to=(ROOM#room1)>room1</Exit>
                        </Room>
                    </Map>
                </Asset>
            `))

        })

        it('should properly subset an asset with shortName content without cascade', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Situation uuid=(DEFAULT) ref={0} key=(base)>
                            <Description><Link to=(testFeature)>link</Link></Description>
                        </Situation>
                    </Room>
                    <Feature key=(testFeature) />
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'ShortName', keys: [new StandardKey({ key: 'testRoom', tag: 'Room' })] }]).schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Room key=(testRoom)><ShortName>Test Room</ShortName></Room>
                </Asset>
            `))
        })    

        it('should properly subset an asset with stub content without cascade', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Situation uuid=(DEFAULT) ref={0} key=(base)>
                            <Description><Link to=(testFeature)>link</Link></Description>
                        </Situation>
                    </Room>
                    <Feature key=(testFeature) />
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'Stub', keys: [new StandardKey({ key: 'testRoom', tag: 'Room' })] }]).schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)><Room key=(testRoom) /></Asset>
            `))
        })    

        it('should properly subset an asset with link cascade', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Knowledge key=(testKnowledge)>
                        <Situation ref={0} uuid=(testRoomBase)>
                            <Description><Link to=(FEATURE#testFeature)>link</Link></Description>
                        </Situation>
                    </Knowledge>
                    <Room key=(testRoom) />
                    <Feature uuid=(testFeature) key=(testFeature)>
                        <Situation uuid=(testFeatureBase)>
                            <Description><Link to=(FEATURE#testFeatureTwo)>link</Link></Description>
                        </Situation>
                    </Feature>
                    <Feature uuid=(testFeatureTwo) key=(testFeatureTwo) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{
                requestType: 'Full',
                keys: [new StandardKey({ key: 'testKnowledge', tag: 'Knowledge' })],
                cascadeConditions: [
                    {
                        graph: [
                            {
                                name: 'knowledge',
                                requestType: 'Full',
                                transitions: [
                                    { connectionType: 'Direct', targetNode: 'example' }
                                ]
                            },
                            {
                                name: 'example',
                                requestType: 'Full',
                                transitions: [
                                    { connectionType: 'Link', targetNode: 'feature' }
                                ]
                            },
                            {
                                name: 'feature',
                                requestType: 'Stub',
                                transitions: []
                            }
                        ],
                        startNodes: ['knowledge']
                    }
                ]
            }]).schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Situation uuid=(testRoomBase) ref={0} />
                    <Knowledge key=(testKnowledge)>
                        <Situation uuid=(testRoomBase) ref={0}>
                            <Description>
                                <Link to=(FEATURE#testFeature)>link</Link>
                            </Description>
                        </Situation>
                    </Knowledge>
                </Asset>
            `))
        })

        it('should properly subset a chained cascade', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Knowledge key=(testKnowledge)>
                        <Situation ref={0} uuid=(roomExample)>
                            <Description>
                                <Link to=(FEATURE#testFeature)>link</Link>
                            </Description>
                        </Situation>
                    </Knowledge>
                    <Room key=(testRoom) />
                    <Feature uuid=(testFeature) key=(testFeature)>
                        <Situation uuid=(featureExample)>
                            <Description>
                                <Link to=(FEATURE#testFeatureTwo)>link</Link>
                            </Description>
                        </Situation>
                    </Feature>
                    <Feature uuid=(testFeatureTwo) key=(testFeatureTwo) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ 
                requestType: 'Full', 
                keys: [new StandardKey({ key: 'testKnowledge', tag: 'Knowledge' })], 
                cascadeConditions: [
                    {
                        graph: [
                            {
                                name: 'knowledge',
                                requestType: 'Full',
                                transitions: [
                                    { connectionType: 'Direct', targetNode: 'example' }
                                ]
                            },
                            {
                                name: 'example',
                                requestType: 'Full', 
                                transitions: [
                                    { connectionType: 'Link', targetNode: 'feature' }
                                ]
                            },
                            {
                                name: 'feature',
                                requestType: 'Full',
                                transitions: [
                                    { connectionType: 'Direct', targetNode: 'example' }
                                ]
                            }
                        ],
                        startNodes: ['knowledge']
                    }
                ]
            }]).schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Situation uuid=(roomExample) ref={0} />
                    <Knowledge key=(testKnowledge)>
                        <Situation uuid=(roomExample) ref={0}>
                            <Description>
                                <Link to=(FEATURE#testFeature)>link</Link>
                            </Description>
                        </Situation>
                    </Knowledge>
                </Asset>
            `))
        })    

        it('should subset a looping chained cascade without error', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Feature uuid=(testFeature) key=(testFeature)>
                        <Situation uuid=(exampleOne)>
                            <Description><Link to=(FEATURE#testFeatureTwo)>link</Link></Description>
                        </Situation>
                    </Feature>
                    <Feature uuid=(testFeatureTwo) key=(testFeatureTwo)>
                        <Situation uuid=(exampleTwo)>
                            <Description><Link to=(FEATURE#testFeature)>link</Link></Description>
                        </Situation>
                    </Feature>
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'Full', keys: [new StandardKey({ key: 'testFeature', tag: 'Feature' })], cascadeConditions: [{ 
                graph: [
                    {
                        name: 'feature',
                        requestType: 'Full',
                        transitions: [
                            { connectionType: 'Direct', targetNode: 'example' }
                        ]
                    },
                    {
                        name: 'example',
                        requestType: 'Full',
                        transitions: [
                            { connectionType: 'Link', targetNode: 'feature' }
                        ]
                    }
                ],
                startNodes: ['feature']
            }] }]).schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Feature uuid=(testFeature) key=(testFeature)>
                        <Situation uuid=(exampleOne)>
                            <Description>
                                <Link to=(FEATURE#testFeatureTwo)>link</Link>
                            </Description>
                        </Situation>
                    </Feature>
                </Asset>
            `))
        })    

        it('should properly subset an asset with position cascade', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Map key=(testMap)>
                        <Room key=(testRoom)><Position {0, 0} /></Room>
                    </Map>
                    <Room key=(testRoom)>
                        <Situation uuid=(DEFAULT) ref={0} key=(base)>
                            <Description><Link to=(testFeature)>link</Link></Description>
                        </Situation>
                    </Room>
                    <Feature key=(testFeature) />
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'Full', keys: [new StandardKey({ key: 'testMap', tag: 'Map' })], cascadeConditions: [{ 
                graph: [
                    {
                        name: 'map',
                        requestType: 'Full',
                        transitions: [
                            { connectionType: 'Position', targetNode: 'room' }
                        ]
                    },
                    {
                        name: 'room',
                        requestType: 'Stub',
                        transitions: []
                    }
                ],
                startNodes: ['map']
            }] }]).schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Map key=(testMap)><Room key=(testRoom)><Position {0, 0} /></Room></Map>
                    <Room key=(testRoom) />
                </Asset>
            `))
        })

        it('should properly subset an asset with exit cascade', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Situation uuid=(DEFAULT) ref={0} key=(base)>
                            <Description><Link to=(testFeature)>link</Link></Description>
                        </Situation>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                    <Room key=(testRoomTwo)>
                        <Exit to=(testRoomOne)>enter</Exit>
                    </Room>
                    <Feature key=(testFeature) />
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'ExitsAndShortName', keys: [new StandardKey({ key: 'testRoom', tag: 'Room' })], cascadeConditions: [{ 
                graph: [
                    {
                        name: 'room',
                        requestType: 'ExitsAndShortName',
                        transitions: [
                            { connectionType: 'Exit', targetNode: 'exitTarget' }
                        ]
                    },
                    {
                        name: 'exitTarget',
                        requestType: 'ExitsAndShortName',
                        transitions: []
                    }
                ],
                startNodes: ['room']
            }] }]).schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                    <Room key=(testRoomTwo)><Exit to=(testRoomOne)>enter</Exit></Room>
                </Asset>
            `))
        })    

        it('should demonstrate recursive cascade structure for map editing', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Map uuid=(testMap)>
                        <Room key=(room1)><Position {0, 0} /></Room>
                        <Room key=(room2)><Position {100, 100} /></Room>
                    </Map>
                    <Room key=(room1)>
                        <ShortName>Room One</ShortName>
                        <Exit to=(room2)>to room two</Exit>
                    </Room>
                    <Room key=(room2)>
                        <ShortName>Room Two</ShortName>
                        <Exit to=(room1)>to room one</Exit>
                    </Room>
                </Asset>
            `)
            
            // This demonstrates the new recursive cascade structure:
            // 1. Get map with Full detail
            // 2. Follow Position connections to get positioned rooms
            // 3. For each positioned room, get Exit connections
            // 4. For each exit target, get ShortName detail
            const results = test.subset([{
                requestType: 'Full',
                keys: [new StandardKey(`MAP#testMap`)],
                cascadeConditions: [
                    {
                        graph: [
                            {
                                name: 'map',
                                requestType: 'Full',
                                transitions: [
                                    { connectionType: 'Position', targetNode: 'room' }
                                ]
                            },
                            {
                                name: 'room',
                                requestType: 'ExitsAndShortName',
                                transitions: [
                                    { connectionType: 'Exit', targetNode: 'exitTarget' }
                                ]
                            },
                            {
                                name: 'exitTarget',
                                requestType: 'ShortName',
                                transitions: []
                            }
                        ],
                        startNodes: ['map']
                    }
                ]
            }])
            
            // Should include the map, positioned rooms, and exit targets with short names
            expect(results.byUniversalId['MAP#testMap']).toBeInstanceOf(StandardMap)
            expect(results.byId['room1']).toBeInstanceOf(StandardRoom)
            expect(results.byId['room2']).toBeInstanceOf(StandardRoom)
        })

    })
})
