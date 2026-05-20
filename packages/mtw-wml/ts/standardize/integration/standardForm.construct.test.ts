import { Schema, schemaToWML, treeFromWML } from '../../schema'
import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'
import { isSchemaString } from '@tonylb/mtw-base/ts/schema/renderTree'
import { treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree'
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
    describe('input vs normative typeguards', () => {
        it('accepts missing facet payload in input guard but rejects in normative guard', () => {
            const candidate = {
                universalKey: 'ASSET#test',
                metaData: [],
                components: [
                    {
                        tag: 'Situation',
                        key: 'situation1',
                        universalKey: 'SITUATION#situation1',
                        marks: [
                            {
                                reference: {
                                    tag: 'Mark',
                                    key: 'mark1',
                                    universalKey: 'MARK#mark1'
                                }
                            }
                        ]
                    }
                ]
            }

            expect(isStandardFormInput(candidate)).toBe(true)
            expect(isStandardForm(candidate)).toBe(false)
        })
    })

    describe('facet payload defaults', () => {
            it('should accept edit tags in JSON form', () => {
                const test = new StandardForm({
                    universalKey: 'ASSET#test',
                    metaData: [],
                    components: [
                        {
                            tag: 'Room',
                            key: 'testRoomTwo',
                            universalKey: 'ROOM#testRoomTwo',
                        }
                    ],
                    topLevel: [{
                        tag: 'Room',
                        universalKey: 'ROOM#testRoomTwo',
                        ref: -1
                    }]
                })
                expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(test)>
                        <Remove><Room uuid=(testRoomTwo) key=(testRoomTwo) /></Remove>
                    </Asset>
                `))
            })

            it('should accept JSON facet entries with missing payload and inject defaults', () => {
                const test = new StandardForm({
                    universalKey: 'ASSET#test',
                    metaData: [],
                    components: [
                        {
                            tag: 'Situation',
                            key: 'situation1',
                            universalKey: 'SITUATION#situation1',
                            marks: [
                                {
                                    reference: {
                                        tag: 'Mark',
                                        key: 'mark1',
                                        universalKey: 'MARK#mark1'
                                    }
                                }
                            ]
                        }
                    ]
                })
                const json = test.toJSON()
                expect(json.universalKey).toBe('ASSET#test')
                expect(json.components).toEqual([
                    expect.objectContaining({
                        tag: 'Situation',
                        key: 'situation1',
                        universalKey: 'SITUATION#situation1',
                        marks: [
                            {
                                reference: 'MARK#mark1',
                                payload: ''
                            }
                        ]
                    })
                ])
            })

            it('should reject malformed present payload in JSON facet entries', () => {
                expect(() => new StandardForm({
                    universalKey: 'ASSET#test',
                    metaData: [],
                    components: [
                        {
                            tag: 'Situation',
                            key: 'situation1',
                            universalKey: 'SITUATION#situation1',
                            marks: [
                                {
                                    reference: {
                                        tag: 'Mark',
                                        key: 'mark1',
                                        universalKey: 'MARK#mark1'
                                    },
                                    payload: null
                                }
                            ]
                        }
                    ]
                } as unknown as StandardFormData)).toThrow()
            })

            it('should accept NDJSON facet entries with missing payload and inject defaults', () => {
                const test = new StandardForm([
                    {
                        tag: 'Asset',
                        universalKey: 'ASSET#test'
                    },
                    {
                        tag: 'Situation',
                        key: 'situation1',
                        universalKey: 'SITUATION#situation1',
                        marks: [
                            {
                                reference: {
                                    tag: 'Mark',
                                    key: 'mark1',
                                    universalKey: 'MARK#mark1'
                                }
                            }
                        ]
                    }
                ])
                const json = test.toJSON()
                expect(json.universalKey).toBe('ASSET#test')
                expect(json.components).toEqual([
                    expect.objectContaining({
                        tag: 'Situation',
                        key: 'situation1',
                        universalKey: 'SITUATION#situation1',
                        marks: [
                            {
                                reference: 'MARK#mark1',
                                payload: ''
                            }
                        ]
                    })
                ])
            })
    })

    describe('construction', () => {
            it('should accept edit tags', () => {
                const test: GenericTreeNode<SchemaTag> = {
                    data: { tag: 'Asset', uuid: 'ASSET#Test', Story: undefined },
                    children: [
                        {
                            data: { tag: 'Room', key: 'testRoom', uuid: 'ROOM#testRoom' },
                            children: [{
                                data: { tag: 'Situation', uuid: 'SITUATION#DEFAULT' },
                                children: [{
                                    data: { tag: 'Replace' },
                                    children: [{
                                        data: { tag: 'ReplaceMatch' },
                                        children: [{
                                            data: { tag: 'DisplayName' },
                                            children: [{ data: { tag: 'String', value: 'Lobby' }, children: [] }]
                                        }]
                                    },
                                    {
                                        data: { tag: 'ReplacePayload' },
                                        children: [{
                                            data: { tag: 'DisplayName' },
                                            children: [{ data: { tag: 'String', value: 'Foyer' }, children: [] }]
                                        }]
                                    }]    
                                }]
                            },
                            {
                                data: { tag: 'Remove' },
                                children: [{ data: { tag: 'Exit', to: 'testDestination' }, children: [{ data: { tag: 'String', value: 'out' }, children: [] }] }]
                            }]
                        },
                        { data: { tag: 'Remove' }, children: [{ data: { tag: 'Room', key: 'testRoomRemove', uuid: 'ROOM#testRoomRemove' }, children: [] }] },
                    ]
                }
        
                const standard = new StandardForm(test)
                expect(standard.toJSON()).toEqual({
                    universalKey: 'ASSET#Test',
                    metaData: [],
                    topLevel: [
                        'ROOM#testRoom',
                        { universalKey: 'ROOM#testRoomRemove', tag: 'Room', ref: -1 }
                    ],
                    components: [
                        {
                            tag: 'Room',
                            key: 'testRoom',
                            universalKey: 'ROOM#testRoom',
                            situations: [{
                                reference: 'SITUATION#DEFAULT',
                                payload: {
                                    displayName: {
                                        tag: 'Replace',
                                        match: 'Lobby',
                                        payload: 'Foyer'
                                    }
                                }
                            }],
                            exits: [{
                                reference: { tag: 'Room', key: 'testDestination', ref: -1 },
                                payload: { tag: 'Remove', match: 'out' }
                            }]
                        },
                        {
                            tag: 'Situation',
                            universalKey: 'SITUATION#DEFAULT',
                        },
                        {
                            tag: 'Room',
                            key: 'testRoomRemove',
                            universalKey: 'ROOM#testRoomRemove',
                        }
                    ]
                })
            })

            it('should ignore authorization tags', () => {
                const test = new StandardForm(`
                    <Asset uuid=(Test)>
                        <Room uuid=(test) key=(test)>
                            <Grant player=(testPlayer) actions="test" />
                            <Situation uuid=(DEFAULT)>
                                <Description>
                                    One
                                    <br />
                                </Description>
                            </Situation>
                        </Room>
                    </Asset>
                `)
                expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(test) key=(test)>
                            <Situation uuid=(DEFAULT) ref={0} />
                            <Situation uuid=(DEFAULT)>
                                <Description>One<br /></Description>
                            </Situation>
                        </Room>
                    </Asset>
                `))
            })

            it('should properly nest components in a removed component', () => {
                const testWML = deIndentWML(`
                    <Asset uuid=(Test)>
                        <Remove>
                            <Room uuid=(testRoom) key=(testRoom)>
                                <Feature uuid=(testFeature) key=(testFeature) />
                            </Room>
                        </Remove>
                    </Asset>
                `)
                const test = new StandardForm(testWML)
                expect(schemaToWML([test.schema])).toEqual(testWML)
            })

            it('should correctly construct classes', () => {
                const testWML = deIndentWML(`
                    <Asset uuid=(Test)>
                        <Map uuid=(testMap)>
                            <Room uuid=(testRoom)>
                                <Feature uuid=(testFeature) key=(testFeature) />
                                <Position {0, 0} />
                            </Room>
                        </Map>
                    </Asset>
                `)
                const test = new StandardForm(testWML)
                expect(test.byUniversalId['ROOM#testRoom']).toBeInstanceOf(StandardRoom)
                expect(test.byUniversalId['FEATURE#testFeature']).toBeInstanceOf(StandardFeature)
                expect(test.byUniversalId['MAP#testMap']).toBeInstanceOf(StandardMap)
            })

            it('should correctly relocate nested components to rendering level', () => {
                const testWML = deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoom) key=(testRoom)>
                            <Feature key=(testFeature)>
                                <Situation key=(testFeatureSituation)>
                                    <Description>Test Feature</Description>
                                </Situation>
                            </Feature>
                        </Room>
                        <Feature uuid=(testFeature) key=(testFeature) />
                    </Asset>
                `)
                const test = new StandardForm(testWML)
                expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Feature uuid=(testFeature) key=(testFeature)>
                            <Situation key=(testFeatureSituation)>
                                <Description>Test Feature</Description>
                            </Situation>
                        </Feature>
                        <Room uuid=(testRoom) key=(testRoom)><Feature key=(testFeature) /></Room>
                    </Asset>
                `))
            })

            it('should handle origin properties correctly in WML parsing and serialization', () => {
                const originWML = deIndentWML(`
                    <Asset uuid=(origin)>
                        <Character uuid=(char1) origin=(ASSET#123,ASSET#456)>
                            <DisplayName>Character with Origin</DisplayName>
                        </Character>
                        <Room uuid=(room1) origin=(ASSET#789)>
                            <Feature uuid=(feature1) origin=(ASSET#101,ASSET#102) />
                        </Room>
                    </Asset>
                `)
                
                // WML → StandardForm
                const form = new StandardForm(originWML)
                
                // Verify origin properties are parsed correctly
                const char1 = form._lookup('CHARACTER#char1') as StandardCharacter
                const room1 = form._lookup('ROOM#room1') as StandardRoom
                const feature1 = form._lookup('FEATURE#feature1') as StandardFeature
                
                expect(char1['_origin']).toEqual(['ASSET#123', 'ASSET#456'])
                expect(room1['_origin']).toEqual(['ASSET#789'])
                expect(feature1?.['_origin']).toEqual(['ASSET#101', 'ASSET#102'])
                
                const finalWML = schemaToWML([form.schema])
                expect(finalWML).toEqual(originWML)
            })
    })

    describe('NDJSON', () => {
            it('should deserialize empty NDJSON correctly', () => {
                expect((new StandardForm([{ tag: 'Asset', key: 'Test', universalKey: 'ASSET#Test' }])).toJSON()).toEqual({
                    universalKey: 'ASSET#Test',
                    components: [],
                    metaData: []
                })
            })

            it('should round-trip all component types through NDJSON', () => {
                const testWML = deIndentWML(`
                    <Asset uuid=(test)>
                        <Feature uuid=(003) key=(testFeature)>
                            <Situation uuid=(0035)>
                                <DisplayName>Clocktower</DisplayName>
                                <Description>
                                    A tower built of white sandstone blocks, with an ornate clock
                                    set on the northern face.
                                </Description>
                            </Situation>
                        </Feature>
                        <Knowledge uuid=(004) key=(testKnowledge)>
                            <Situation uuid=(0045)>
                                <DisplayName>Learn</DisplayName>
                                <Description>There is so much to know!</Description>
                            </Situation>
                        </Knowledge>
                        <Room uuid=(002) key=(testRoom)>
                            <ShortName>Vortex</ShortName>
                            <Situation uuid=(025) ref={0}>
                                <DisplayName>Vortex</DisplayName>
                                <Description>Vortex Desc</Description>
                            </Situation>
                        </Room>
                        <Map uuid=(005) key=(testMap)>
                            <Image key=(testBackground) />
                            <Room key=(testRoom)><Position {0, 100} /></Room>
                        </Map>
                        <Message uuid=(006) key=(openDoor)>
                            <Room key=(testRoom) />
                            <Description>The door opens!</Description>
                        </Message>
                        <Moment uuid=(007) key=(openDoorMoment)><Message key=(openDoor) /></Moment>
                        <Situation uuid=(025) ref={0} />
                        <Image key=(testBackground) />
                    </Asset>
                `)
                const testSource = new StandardForm(testWML)
        
                const ndjson = testSource.toNDJSON()
                const test = new StandardForm(ndjson)
                expect(schemaToWML([test.schema])).toEqual(testWML)
                expect(test.byId.testRoom.universalKey).toEqual('ROOM#002')
                expect(test.byId.testFeature.universalKey).toEqual('FEATURE#003')
                expect(test.byId.testKnowledge.universalKey).toEqual('KNOWLEDGE#004')
                expect(test.byId.testMap.universalKey).toEqual('MAP#005')
                expect(test.byId.openDoor.universalKey).toEqual('MESSAGE#006')
                expect(test.byId.openDoorMoment.universalKey).toEqual('MOMENT#007')
            })

            it('should group sub-components correctly in JSON', () => {
                const testWML = deIndentWML(`
                    <Asset uuid=(test)>
                        <Feature uuid=(003) key=(testGlobal)>
                            <Situation uuid=(003b)>
                                <Description>Global</Description>
                            </Situation>
                        </Feature>
                        <Room uuid=(001) key=(testRoom)>
                            <Feature uuid=(004) key=(testLocal)>
                                <Situation uuid=(004b)>
                                    <DisplayName>Clocktower</DisplayName>
                                    <Description>
                                        A tower built of white sandstone blocks, with an ornate clock set on
                                        the northern face.
                                    </Description>
                                </Situation>
                            </Feature>
                            <Feature uuid=(003) key=(testGlobal) />
                            <Situation ref={0} uuid=(001b)>
                                <DisplayName>Vortex</DisplayName>
                            </Situation>
                        </Room>
                        <Room uuid=(002) key=(testRoomTwo) />
                    </Asset>
                `)
                const testSource = new StandardForm(testWML)
        
                const ndjson = testSource.toNDJSON()
                expect(ndjson).toEqual([
                    {
                        tag: 'Asset',
                        universalKey: 'ASSET#test',
                        topLevel: [
                            'FEATURE#003',
                            'ROOM#001',
                            'ROOM#002'
                        ]
                    },
                    {
                        tag: 'Feature',
                        key: 'testGlobal',
                        universalKey: 'FEATURE#003',
                        situations: [{
                            reference: 'SITUATION#003b',
                            payload: { description: ['Global'] }
                        }],
                        shortName: undefined,
                    },
                    {
                        key: undefined,
                        universalKey: 'SITUATION#003b',
                        tag: 'Situation',
                    },
                    {
                        tag: 'Room',
                        key: 'testRoom',
                        universalKey: 'ROOM#001',
                        situations: [{
                            reference: {
                                universalKey: 'SITUATION#001b',
                                tag: 'Situation',
                                ref: 0
                            },
                            payload: { displayName: 'Vortex' }
                        }],
                        features: ['FEATURE#004', 'FEATURE#003'],
                        shortName: undefined,
                    },
                    {
                        tag: 'Feature',
                        key: 'testLocal',
                        universalKey: 'FEATURE#004',
                        situations: [{
                            reference: 'SITUATION#004b',
                            payload: {
                                displayName: 'Clocktower',
                                description: ['A tower built of white sandstone blocks, with an ornate clock set on the northern face.']
                            }
                        }],
                        shortName: undefined,
                    },
                    {
                        key: undefined,
                        universalKey: 'SITUATION#004b',
                        tag: 'Situation',
                    },
                    { tag: 'Room', key: 'testRoomTwo', universalKey: 'ROOM#002', shortName: undefined },
                    {
                        key: undefined,
                        universalKey: 'SITUATION#001b',
                        tag: 'Situation',
                    },
                ])
            })

            it('should round-trip nested subcomponents', () => {
                const testWML = deIndentWML(`
                    <Asset uuid=(test)>
                        <Feature uuid=(003) key=(testGlobal)>
                            <Situation uuid=(003b)><Description>Global</Description></Situation>
                        </Feature>
                        <Room uuid=(001) key=(testRoom)>
                            <Feature key=(testGlobal) />
                            <Feature uuid=(004) key=(testLocal)>
                                <Situation uuid=(004b)>
                                    <DisplayName>Clocktower</DisplayName>
                                    <Description>
                                        A tower built of white sandstone blocks, with an ornate
                                        clock set on the northern face.
                                    </Description>
                                </Situation>
                            </Feature>
                            <Situation uuid=(001b) ref={0}>
                                <DisplayName>Vortex</DisplayName>
                            </Situation>
                        </Room>
                        <Room uuid=(002) key=(testRoomTwo) />
                        <Situation uuid=(001b) ref={0} />
                    </Asset>
                `)
                const test = new StandardForm(testWML)
        
                expect(schemaToWML([test.schema])).toEqual(testWML)
            })
    })

    describe('mapContents', () => {
        it('should apply mapContents callback across all components in the asset', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <ShortName>Room One</ShortName>
                    </Room>
                    <Room uuid=(room2) key=(room2)>
                        <ShortName>Room Two</ShortName>
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)
            const callback = (tree) => {
                return tree.map((node) => {
                    if (treeNodeTypeguard(isSchemaString)(node)) {
                        return { data: { tag: 'String', value: `${node.data.value}!` }, children: [] }
                    }
                    return {
                        ...node,
                        children: callback(node.children),
                    }
                })
            }
            const mapped = form.mapContents(callback)
            const room1 = mapped.byId['room1'] as StandardRoom
            const room2 = mapped.byId['room2'] as StandardRoom
            expect(room1.shortName?.toJSON()).toBe('Room One!')
            expect(room2.shortName?.toJSON()).toBe('Room Two!')
            expect(schemaToWML([room1.schema])).toContain('Room One!')
            expect(schemaToWML([room2.schema])).toContain('Room Two!')
        })
    })
})
