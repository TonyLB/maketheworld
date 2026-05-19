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
    describe('key changes via merge', () => {
        describe('validation', () => {
            it('should throw error when Key rename lacks universalKey', () => {
                const base = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature key=(testFeature)>
                            <Situation uuid=(base)><DisplayName>Test</DisplayName></Situation>
                        </Feature>
                    </Asset>
                `)
                // Create edit with Key rename but no universalKey
                const edit = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature key=(testFeature)>
                            <Replace><Key>testFeature</Key></Replace>
                            <With><Key>renamedFeature</Key></With>
                        </Feature>
                    </Asset>
                `)
                
                expect(() => base.merge(edit)).toThrow('Cannot rename key for component without universalKey')
            })

            it('should throw error when Key removal lacks universalKey', () => {
                const base = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature key=(testFeature)>
                            <Situation uuid=(base)><DisplayName>Test</DisplayName></Situation>
                        </Feature>
                    </Asset>
                `)
                // Create edit with Remove Key operation but without universalKey
                const edit = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature key=(testFeature)><Remove><Key>testFeature</Key></Remove></Feature>
                    </Asset>
                `)
                
                expect(() => base.merge(edit)).toThrow('Cannot remove key for component without universalKey')
            })
        })

        describe('reference updates', () => {
            it('should retarget Links to the renamed key via merge', () => {
                const base = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature uuid=(feature1) key=(testFeatureOne)>
                            <Situation uuid=(base1)>
                                <Description>
                                    <Link to=(testFeatureOne)>self link</Link>
                                    <Link to=(testFeatureTwo)>other link</Link>
                                </Description>
                            </Situation>
                        </Feature>
                        <Feature uuid=(feature2) key=(testFeatureTwo)>
                            <Situation uuid=(base2)>
                                <Description><Link to=(testFeatureOne)>back link</Link></Description>
                            </Situation>
                        </Feature>
                    </Asset>
                `)
                
                // Create edit with Key rename
                const edit = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature uuid=(feature1) key=(testFeatureOne) ref={0}>
                            <Replace><Key>testFeatureOne</Key></Replace>
                            <With><Key>renamedFeature</Key></With>
                        </Feature>
                    </Asset>
                `)
                
                const merged = base.merge(edit)
                expect(schemaToWML([merged.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(test)>
                        <Feature uuid=(feature1) key=(renamedFeature)>
                            <Situation uuid=(base1)>
                                <Description>
                                    <Link to=(testFeatureOne)>self link</Link>
                                    <Link to=(testFeatureTwo)>other link</Link>
                                </Description>
                            </Situation>
                        </Feature>
                        <Feature uuid=(feature2) key=(testFeatureTwo)>
                            <Situation uuid=(base2)>
                                <Description>
                                    <Link to=(testFeatureOne)>back link</Link>
                                </Description>
                            </Situation>
                        </Feature>
                    </Asset>
                `))
            })

            it('should retarget Exits to the renamed key via merge', () => {
                const base = new StandardForm(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(testRoomOne)>
                            <Exit to=(testRoomTwo)>exit</Exit>
                        </Room>
                        <Room uuid=(room2) key=(testRoomTwo)>
                            <Exit to=(testRoomOne)>enter</Exit>
                        </Room>
                    </Asset>
                `)
                
                // Create edit with Key rename
                const edit = new StandardForm(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(testRoomOne) ref={0}>
                            <Replace><Key>testRoomOne</Key></Replace>
                            <With><Key>renamedRoom</Key></With>
                        </Room>
                    </Asset>
                `)
                
                const merged = base.merge(edit)
                expect(schemaToWML([merged.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(renamedRoom)>
                            <Exit to=(testRoomTwo)>exit</Exit>
                        </Room>
                        <Room uuid=(room2) key=(testRoomTwo)>
                            <Exit to=(renamedRoom)>enter</Exit>
                        </Room>
                    </Asset>
                `))
            })

            it('should retarget Map Positions to the renamed key via merge', () => {
                const base = new StandardForm(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(testRoomOne) />
                        <Map uuid=(map1) key=(testMapOne)>
                            <Room uuid=(room1) key=(testRoomOne)><Position {100, 100} /></Room>
                        </Map>
                    </Asset>
                `)
                
                // Create edit with Key rename
                const edit = new StandardForm(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(testRoomOne) ref={0}>
                            <Replace><Key>testRoomOne</Key></Replace>
                            <With><Key>renamedRoom</Key></With>
                        </Room>
                    </Asset>
                `)
                
                const merged = base.merge(edit)
                expect(schemaToWML([merged.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(renamedRoom) />
                        <Map uuid=(map1) key=(testMapOne)>
                            <Room key=(renamedRoom)><Position {100, 100} /></Room>
                        </Map>
                    </Asset>
                `))
            })

            it('should handle bidirectional references correctly via merge', () => {
                const base = new StandardForm(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(testRoomOne)>
                            <Situation ref={0} uuid=(base1)>
                                <Description>Test One <Link to=(testRoomTwo)>link</Link></Description>
                            </Situation>
                        </Room>
                        <Room uuid=(room2) key=(testRoomTwo)>
                            <Situation ref={0} uuid=(base2)>
                                <Description>Test Two <Link to=(testRoomOne)>link</Link></Description>
                            </Situation>
                        </Room>
                    </Asset>
                `)
                
                // Create edit swapping both keys
                const edit = new StandardForm(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(testRoomOne) ref={0}>
                            <Replace><Key>testRoomOne</Key></Replace>
                            <With><Key>testRoomTwo</Key></With>
                        </Room>
                        <Room uuid=(room2) key=(testRoomTwo) ref={0}>
                            <Replace><Key>testRoomTwo</Key></Replace>
                            <With><Key>testRoomOne</Key></With>
                        </Room>
                    </Asset>
                `)
                
                const merged = base.merge(edit)
                expect(schemaToWML([merged.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(testRoomTwo)>
                            <Situation uuid=(base1) ref={0}>
                                <Description>
                                    Test One <Link to=(testRoomTwo)>link</Link>
                                </Description>
                            </Situation>
                        </Room>
                        <Room uuid=(room2) key=(testRoomOne)>
                            <Situation uuid=(base2) ref={0}>
                                <Description>
                                    Test Two <Link to=(testRoomOne)>link</Link>
                                </Description>
                            </Situation>
                        </Room>
                    </Asset>
                `))
            })
        })

        describe('merge behavior', () => {
            it('should preserve component via universalKey when key is removed', () => {
                const base = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature uuid=(feature1) key=(testFeature)>
                            <Situation uuid=(base)><DisplayName>Test</DisplayName></Situation>
                        </Feature>
                    </Asset>
                `)
                
                // Create edit removing the key
                const edit = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature uuid=(feature1) key=(testFeature) ref={0}>
                            <Remove><Key>testFeature</Key></Remove>
                        </Feature>
                    </Asset>
                `)
                
                const merged = base.merge(edit)
                // Component should still exist via universalKey
                expect(merged.byUniversalId['FEATURE#feature1']).toBeDefined()
                expect(merged.byUniversalId['FEATURE#feature1']?.key).toBeUndefined()
            })

            it('should handle multiple Key changes in single merge', () => {
                const base = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature uuid=(feature1) key=(feature1)>
                            <Situation uuid=(base)><DisplayName>One</DisplayName></Situation>
                        </Feature>
                        <Feature uuid=(feature2) key=(feature2)>
                            <Situation uuid=(base)><DisplayName>Two</DisplayName></Situation>
                        </Feature>
                    </Asset>
                `)
                
                // Create edit renaming both features
                const edit = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature uuid=(feature1) key=(feature1)>
                            <Replace><Key>feature1</Key></Replace>
                            <With><Key>renamed1</Key></With>
                        </Feature>
                        <Feature uuid=(feature2) key=(feature2) ref={0}>
                            <Replace><Key>feature2</Key></Replace>
                            <With><Key>renamed2</Key></With>
                        </Feature>
                    </Asset>
                `)
                
                const merged = base.merge(edit)
                expect(merged.byId.renamed1).toBeDefined()
                expect(merged.byId.renamed2).toBeDefined()
            })
        })

        describe('integration', () => {
            it('should work with full edit/merge/diff cycle', () => {
                const base = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature uuid=(feature1) key=(clockTower)>
                            <ShortName>Clock Tower</ShortName>
                        </Feature>
                    </Asset>
                `)
                
                // Create modified version with new key
                const modified = base._clone()
                const component = modified.byUniversalId['FEATURE#feature1']
                const newComponent = component.withKey('tower')
                modified.byUniversalId['FEATURE#feature1'] = newComponent
                modified._components = modified._components.map(c => 
                    c.standardKey.equals(newComponent.standardKey) ? newComponent : c
                )
                
                // Generate diff
                const diff = base.diff(modified.finalize())
                expect(diff).toBeDefined()
                
                // Merge diff back
                const merged = base.merge(diff!)
                expect(merged.byId.tower).toBeDefined()
                expect(merged.byId.clockTower).toBeUndefined()
            })
        })
    })
})
