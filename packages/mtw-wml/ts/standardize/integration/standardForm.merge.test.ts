import { Schema, schemaToWML, treeFromWML } from '../../schema'
import { StandardForm } from '..'
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
    describe('merge', () => {
            it('should preserve missing-payload default through diff/merge roundtrip', () => {
                const base = new StandardForm({
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
                const updated = new StandardForm({
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
                                    payload: 'Updated narrative'
                                }
                            ]
                        }
                    ]
                })
        
                const diff = base.diff(updated)
                expect(diff).toBeDefined()
                const merged = base.merge(diff!)
                expect(merged.toJSON().components).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            tag: 'Situation',
                            key: 'situation1',
                            marks: [
                                {
                                    reference: 'MARK#mark1',
                                    payload: 'Updated narrative'
                                }
                            ]
                        })
                    ])
                )
            })

            it('should combine descriptions in rooms and features', () => {
                const test = new StandardForm(`<Asset uuid=(Test)>
                    <Room uuid=(test) key=(test)>
                        <Situation uuid=(DEFAULT)>
                            <Summary>
                                One
                                <br />
                            </Summary>
                            <Description>Three</Description>
                        </Situation>
                    </Room>
                    <Room key=(test) ref={0}>
                        <Situation uuid=(DEFAULT)><Summary>Two</Summary></Situation>
                    </Room>
                    <Feature uuid=(testFeature) key=(testFeature)>
                        <Situation uuid=(testFeatureBase) key=(base)><Description>Four</Description></Situation>
                    </Feature>
                    <Room key=(test) ref={0}>
                        <Situation uuid=(DEFAULT)><DisplayName>Test Room</DisplayName></Situation>
                    </Room>
                </Asset>`)
                expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Feature uuid=(testFeature) key=(testFeature)>
                            <Situation key=(base)><Description>Four</Description></Situation>
                        </Feature>
                        <Room uuid=(test) key=(test)>
                            <Situation uuid=(DEFAULT) ref={0} />
                            <Situation uuid=(DEFAULT) ref={3}>
                                <DisplayName>Test Room</DisplayName>
                                <Summary>One<br />Two</Summary>
                                <Description>Three</Description>
                            </Situation>
                        </Room>
                    </Asset>
                `))
            })

            it('should handle merge scenarios with conflicting character references', () => {
                const form1WML = deIndentWML(`
                    <Asset uuid=(merge)>
                        <Character uuid=(char1) key=(char1)>
                            <ShortName>Alice</ShortName>
                            <DisplayName>Alice</DisplayName>
                        </Character>
                        <Room uuid=(room1) key=(room1)>
                            <Character key=(local1)>
                                <ShortName>Local1</ShortName>
                                <DisplayName>Local Character 1</DisplayName>
                            </Character>
                            <Character uuid=(char1) />
                        </Room>
                    </Asset>
                `)
                
                const form2WML = deIndentWML(`
                    <Asset uuid=(merge)>
                        <Character uuid=(char2) key=(char2)>
                            <ShortName>Bob</ShortName>
                            <DisplayName>Bob</DisplayName>
                        </Character>
                        <Room uuid=(room1) key=(room1)>
                            <Character key=(local2)>
                                <ShortName>Local2</ShortName>
                                <DisplayName>Local Character 2</DisplayName>
                            </Character>
                            <Character uuid=(char2) />
                        </Room>
                    </Asset>
                `)
                
                const form1 = new StandardForm(form1WML)
                const form2 = new StandardForm(form2WML)
                
                // Merge the forms
                const mergedForm = form1.merge(form2)
                
                // Verify merged form contains characters from both sources
                const mergedRoom = mergedForm._lookup('ROOM#room1') as StandardRoom
                expect(mergedRoom.characters!.payload.length).toBe(4)
                
                const mergedCharKeys = mergedRoom.characters!.payload.map(ref => ref.key || ref.universalKey)
                expect(mergedCharKeys).toContain('local1')
                expect(mergedCharKeys).toContain('local2')
                expect(mergedCharKeys).toContain('CHARACTER#char1')
                expect(mergedCharKeys).toContain('CHARACTER#char2')
            })

            it('should render Remove tags correctly', () => {
                const testSource = deIndentWML(`
                    <Asset uuid=(Test)>
                        <Situation uuid=(testRoomTwoBase) key=(base) ref={0} />
                        <Room uuid=(testRoomOne) key=(testRoomOne) />
                        <Room uuid=(testRoomTwo) key=(testRoomTwo) ref={0}>
                            <Situation key=(base) ref={0}>
                                <Remove><DisplayName>Test To Delete</DisplayName></Remove>
                            </Situation>
                        </Room>
                    </Asset>
                `)
                const test = new StandardForm(testSource)
                expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoomOne) key=(testRoomOne) />
                        <Room uuid=(testRoomTwo) key=(testRoomTwo) ref={0}>
                            <Situation key=(base) ref={0}>
                                <Remove><DisplayName>Test To Delete</DisplayName></Remove>
                            </Situation>
                        </Room>
                        <Situation uuid=(testRoomTwoBase) key=(base) ref={0} />
                    </Asset>
                `))
            })

            it('should merge edit value tags correctly', () => {
                const inherited = new StandardForm(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoomOne)>
                            <Situation ref={0} uuid=(testRoomOneBase)>
                                <DisplayName>Lobby</DisplayName>
                                <Description>A plain lobby.</Description>
                            </Situation>
                        </Room>
                    </Asset>
                `)
                const test = new StandardForm(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoomOne) ref={0}>
                            <Situation uuid=(testRoomOneBase) ref={0}>
                                <Replace><DisplayName>Lobby</DisplayName></Replace>
                                <With><DisplayName>Darkened lobby</DisplayName></With>
                            </Situation>
                        </Room>
                    </Asset>
                `)
                expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoomOne)>
                            <Situation uuid=(testRoomOneBase) ref={0}>
                                <DisplayName>Darkened lobby</DisplayName>
                                <Description>A plain lobby.</Description>
                            </Situation>
                        </Room>
                    </Asset>
                `))
            })

            it('should merge edit component remove correctly', () => {
                const inherited = new StandardForm(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoomOne) key=(testRoomOne)>
                            <Situation ref={0} uuid=(testRoomOneBase) key=(base)>
                                <DisplayName>Lobby</DisplayName>
                                <Description>A plain lobby.</Description>
                            </Situation>
                        </Room>
                        <Room uuid=(testRoomTwo) key=(testRoomTwo) />
                    </Asset>
                `)
                const test = new StandardForm(`
                    <Asset uuid=(Test)>
                        <Remove>
                            <Room uuid=(testRoomOne) key=(testRoomOne)>
                                <Situation ref={0} uuid=(testRoomOneBase) key=(base)>
                                    <DisplayName>Lobby</DisplayName>
                                    <Description>A plain lobby.</Description>
                                </Situation>
                            </Room>
                        </Remove>
                    </Asset>
                `)
                expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)><Room uuid=(testRoomTwo) key=(testRoomTwo) /></Asset>
                `))
            })

            it('should merge edit component remove of empty base component correctly', () => {
                const inherited = new StandardForm(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoomTwo) key=(testRoomTwo) />
                    </Asset>
                `)
                const test = new StandardForm(`
                    <Asset uuid=(Test)>
                        <Remove>
                            <Room uuid=(testRoomOne) key=(testRoomOne)><Situation ref={0} uuid=(testRoomOneBase) key=(base)><DisplayName>Lobby</DisplayName></Situation></Room>
                        </Remove>
                    </Asset>
                `)
                const merged = inherited.merge(test)
                expect(schemaToWML([merged.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Remove>
                            <Room uuid=(testRoomOne) key=(testRoomOne)>
                                <Situation key=(base) ref={0}>
                                    <DisplayName>Lobby</DisplayName>
                                </Situation>
                            </Room>
                        </Remove>
                        <Room uuid=(testRoomTwo) key=(testRoomTwo) />
                        <Situation uuid=(testRoomOneBase) key=(base) ref={0} />
                    </Asset>
                `))
            })

            it('should apply edits on merge', () => {
                const inherited = new StandardForm(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoomOne) key=(testRoomOne) />
                        <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                            <Exit to=(testRoomOne)>out</Exit>
                        </Room>
                    </Asset>
                `)
                const test = new StandardForm(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoomTwo) key=(testRoomTwo) ref={0}>
                            <Remove><Exit to=(testRoomOne)>out</Exit></Remove>
                            <Exit to=(testRoomOne)>depart</Exit>
                        </Room>
                    </Asset>
                `)
                expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoomOne) key=(testRoomOne) />
                        <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                            <Exit to=(testRoomOne)>depart</Exit>
                        </Room>
                    </Asset>
                `))
            })

            it('should merge multiple standardComponents correctly', () => {
                const inherited = new StandardForm(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoomOne) key=(testRoomOne)>
                            <Situation ref={0} uuid=(testRoomOneBase)>
                                <DisplayName>Lobby</DisplayName>
                                <Description>A plain lobby.</Description>
                            </Situation>
                        </Room>
                        <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                            <Situation ref={0} uuid=(testRoomTwoBase)><DisplayName>Test Two</DisplayName></Situation>
                        </Room>
                    </Asset>
                `)
                const test = new StandardForm(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoomOne) ref={0}>
                            <Situation uuid=(testRoomOneBase) ref={0}>
                                <DisplayName><Space />(at night)</DisplayName>
                                <Description><Space />Shadows cling to the corners of the room.</Description>
                            </Situation>
                        </Room>
                        <Room uuid=(testRoomThree) key=(testRoomThree)>
                            <Situation ref={0} uuid=(testRoomThreeBase)><DisplayName>Test Three</DisplayName></Situation>
                        </Room>
                    </Asset>
                `)
                expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoomOne) key=(testRoomOne)>
                            <Situation uuid=(testRoomOneBase) ref={0}>
                                <DisplayName>Lobby (at night)</DisplayName>
                                <Description>
                                    A plain lobby. Shadows cling to the corners of the room.
                                </Description>
                            </Situation>
                        </Room>
                        <Room uuid=(testRoomThree) key=(testRoomThree)>
                            <Situation uuid=(testRoomThreeBase) ref={0}>
                                <DisplayName>Test Three</DisplayName>
                            </Situation>
                        </Room>
                        <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                            <Situation uuid=(testRoomTwoBase) ref={0}>
                                <DisplayName>Test Two</DisplayName>
                            </Situation>
                        </Room>
                        <Situation uuid=(testRoomThreeBase) ref={0} />
                    </Asset>
                `))
            })

            it('should merge metadata correctly', () => {
                const inherited = new StandardForm(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoomOne) key=(testRoomOne) from=(ASSET#primitives)>
                            <Situation ref={0} uuid=(testRoomOneBase)>
                                <DisplayName>Lobby</DisplayName>
                                <Description>A plain lobby.</Description>
                            </Situation>
                        </Room>
                        <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                            <Situation ref={0} uuid=(testRoomTwoBase)>
                                <DisplayName>Test Two</DisplayName>
                            </Situation>
                        </Room>
                    </Asset>
                `)
                const test = new StandardForm(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoomOne) ref={0}>
                            <Situation uuid=(testRoomOneBase) ref={0}>
                                <DisplayName><Space />(at night)</DisplayName>
                                <Description><Space />Shadows cling to the corners of the room.</Description>
                            </Situation>
                        </Room>
                        <Room uuid=(testRoomThree) key=(testRoomThree) from=(ASSET#primitives)>
                            <Situation ref={0} uuid=(testRoomThreeBase)>
                                <DisplayName>Test Three</DisplayName>
                            </Situation>
                        </Room>
                    </Asset>
                `)
                expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoomOne) key=(testRoomOne) from=(ASSET#primitives)>
                            <Situation uuid=(testRoomOneBase) ref={0}>
                                <DisplayName>Lobby (at night)</DisplayName>
                                <Description>
                                    A plain lobby. Shadows cling to the corners of the room.
                                </Description>
                            </Situation>
                        </Room>
                        <Room uuid=(testRoomThree) key=(testRoomThree) from=(ASSET#primitives)>
                            <Situation uuid=(testRoomThreeBase) ref={0}>
                                <DisplayName>Test Three</DisplayName>
                            </Situation>
                        </Room>
                        <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                            <Situation uuid=(testRoomTwoBase) ref={0}>
                                <DisplayName>Test Two</DisplayName>
                            </Situation>
                        </Room>
                        <Situation uuid=(testRoomThreeBase) ref={0} />
                    </Asset>
                `))
            })

            it('should merge multiple serializable standardComponents correctly', () => {
                const inherited = new StandardForm(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoomOne) key=(testRoomOne)>
                            <Situation ref={0} uuid=(testRoomOneBase)>
                                <DisplayName>Lobby</DisplayName>
                                <Description>A plain lobby.</Description>
                            </Situation>
                        </Room>
                        <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                            <Situation ref={0} uuid=(testRoomTwoBase)>
                                <DisplayName>Test Two</DisplayName>
                            </Situation>
                        </Room>
                    </Asset>
                `)
                const testStandard = new StandardForm({
                    universalKey: 'ASSET#Test',
                    components: [
                        {
                            tag: 'Situation',
                            universalKey: 'SITUATION#testRoomOneBase',
                        },
                        {
                            tag: 'Room',
                            key: 'testRoomOne',
                            universalKey: 'ROOM#testRoomOne',
                            situations: [{
                                reference: 'SITUATION#testRoomOneBase',
                                payload: {
                                    displayName: ': Night',
                                }
                            }]
                        },
                    ],
                    metaData: []
                })
                const standardizer = inherited.merge(testStandard)
                expect(schemaToWML([standardizer.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoomOne) key=(testRoomOne)>
                            <Situation uuid=(testRoomOneBase) ref={0} />
                            <Situation uuid=(testRoomOneBase)>
                                <DisplayName>Lobby: Night</DisplayName>
                                <Description>A plain lobby.</Description>
                            </Situation>
                        </Room>
                        <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                            <Situation uuid=(testRoomTwoBase) ref={0}>
                                <DisplayName>Test Two</DisplayName>
                            </Situation>
                        </Room>
                    </Asset>
                `))
            })

            it('should merge with an empty value', () => {
                const inherited = new StandardForm(`<Asset uuid=(Test) />`)
                const testStandard = new StandardForm({
                    universalKey: 'ASSET#Test',
                    components: [
                        {
                            tag: 'Room',
                            key: 'testRoomOne',
                            universalKey: 'ROOM#testRoomOne',
                            shortName: {
                                tag: 'Replace',
                                match: 'Test',
                                payload: 'Replace'
                            }
                        }
                    ],
                    metaData: [],
                    topLevel: ['ROOM#testRoomOne']
                })
                const standardizer = inherited.merge(testStandard)
                expect(schemaToWML([standardizer.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoomOne) key=(testRoomOne)>
                            <Replace><ShortName>Test</ShortName></Replace>
                            <With><ShortName>Replace</ShortName></With>
                        </Room>
                    </Asset>
                `))
            })

            it('should merge top-level Area from JSON', () => {
                const inherited = new StandardForm(`<Asset uuid=(Test) />`)
                const testStandard = new StandardForm({
                    universalKey: 'ASSET#Test',
                    components: [
                        {
                            tag: 'Area',
                            key: 'downtown',
                            universalKey: 'AREA#downtown',
                            shortName: 'Downtown',
                        },
                    ],
                    metaData: [],
                    topLevel: ['AREA#downtown'],
                })
                const standardizer = inherited.merge(testStandard)
                expect(schemaToWML([standardizer.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Area uuid=(downtown) key=(downtown)><ShortName>Downtown</ShortName></Area>
                    </Asset>
                `))
            })

            it('should merge base component with universalKey', () => {
                const base = new StandardKnowledge(deIndentWML(`<Knowledge uuid=(001) key=(test)><Situation key=(one) /></Knowledge>`))
                const incoming = new StandardKnowledge(deIndentWML(`<Knowledge key=(test)><Situation key=(two) /></Knowledge>`))
                const merge = base.merge(incoming)
                if (!merge) {
                    expect(true).toBe(false)
                }
                else {
                    expect(merge.universalKey).toEqual('KNOWLEDGE#001')
                    expect(schemaToWML([merge.schema])).toEqual(deIndentWML(`
                        <Knowledge uuid=(001) key=(test)>
                            <Situation key=(one) />
                            <Situation key=(two) />
                        </Knowledge>
                    `))
                }
            })

            it('should merge incoming component with universalKey', () => {
                const base = new StandardKnowledge(deIndentWML(`<Knowledge key=(test)><Situation key=(one) /></Knowledge>`))
                const incoming = new StandardKnowledge(deIndentWML(`<Knowledge uuid=(001) key=(test)><Situation key=(two) /></Knowledge>`))
                const merge = base.merge(incoming)
                if (!merge) {
                    expect(true).toBe(false)
                }
                else {
                    expect(merge.universalKey).toEqual('KNOWLEDGE#001')
                    expect(schemaToWML([merge.schema])).toEqual(deIndentWML(`
                        <Knowledge uuid=(001) key=(test)>
                            <Situation key=(one) />
                            <Situation key=(two) />
                        </Knowledge>
                    `))
                }
            })

            it('should merge identical universalKeys', () => {
                const base = new StandardKnowledge(deIndentWML(`<Knowledge uuid=(001) key=(test)><Situation key=(one) /></Knowledge>`))
                const incoming = new StandardKnowledge(deIndentWML(`<Knowledge uuid=(001) key=(test)><Situation key=(two) /></Knowledge>`))
                const merge = base.merge(incoming)
                if (!merge) {
                    expect(true).toBe(false)
                }
                else {
                    expect(merge.universalKey).toEqual('KNOWLEDGE#001')
                    expect(schemaToWML([merge.schema])).toEqual(deIndentWML(`
                        <Knowledge uuid=(001) key=(test)>
                            <Situation key=(one) />
                            <Situation key=(two) />
                        </Knowledge>
                    `))
                }
            })

            it('should throw error on conflicting universalKeys', () => {
                const base = new StandardRoom(deIndentWML(`<Room key=(test) />`)).withUniversalKey('ROOM#001')
                const incoming = new StandardRoom(deIndentWML(`<Room key=(test) />`)).withUniversalKey('ROOM#002')
                expect(() => { base.merge(incoming) }).toThrow()
            })

            it('should merge origin properties correctly in StandardForm merge', () => {
                const baseForm = new StandardForm(`<Asset uuid=(Test)>
                    <Room uuid=(testRoom) key=(testRoom) origin=(ASSET#base,ASSET#inherited) />
                </Asset>`)
                
                const incomingForm = new StandardForm(`<Asset uuid=(Test)>
                    <Room uuid=(testRoom) key=(testRoom) origin=(ASSET#incoming,ASSET#new) />
                </Asset>`)
                
                const mergedForm = baseForm.merge(incomingForm)
                const mergedRoom = mergedForm._lookup('ROOM#testRoom') as StandardRoom
                
                // Verify that origins are merged and deduplicated
                expect(mergedRoom.origin).toEqual([
                    'ASSET#base',
                    'ASSET#inherited',
                    'ASSET#incoming', 
                    'ASSET#new'
                ])
            })
    })
})
