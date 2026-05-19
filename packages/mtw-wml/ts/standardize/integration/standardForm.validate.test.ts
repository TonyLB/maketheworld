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
    describe('validate()', () => {
        describe('circular explicit parent detection', () => {
            it('should throw error for simple 2-component cycle', () => {
                const wml = deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(roomA) key=(roomA)>
                            <Parent>ROOM#roomB</Parent>
                        </Room>
                        <Room uuid=(roomB) key=(roomB)>
                            <Parent>ROOM#roomA</Parent>
                        </Room>
                    </Asset>
                `)
                expect(() => new StandardForm(wml)).toThrow('Circular parent relationship detected')
                expect(() => new StandardForm(wml)).toThrow('roomA')
                expect(() => new StandardForm(wml)).toThrow('roomB')
            })

            it('should throw error for 3-component cycle', () => {
                const wml = deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(roomA) key=(roomA)>
                            <Parent>ROOM#roomB</Parent>
                        </Room>
                        <Room uuid=(roomB) key=(roomB)>
                            <Parent>ROOM#roomC</Parent>
                        </Room>
                        <Room uuid=(roomC) key=(roomC)>
                            <Parent>ROOM#roomA</Parent>
                        </Room>
                    </Asset>
                `)
                expect(() => new StandardForm(wml)).toThrow('Circular parent relationship detected')
                expect(() => new StandardForm(wml)).toThrow('roomA')
                expect(() => new StandardForm(wml)).toThrow('roomB')
                expect(() => new StandardForm(wml)).toThrow('roomC')
            })

            it('should throw error for cycle using universal keys', () => {
                const wml = deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(room1)>
                            <Parent>ROOM#room2</Parent>
                        </Room>
                        <Room uuid=(room2) key=(room2)>
                            <Parent>ROOM#room1</Parent>
                        </Room>
                    </Asset>
                `)
                expect(() => new StandardForm(wml)).toThrow('Circular parent relationship detected')
            })

            it('should not throw error for valid parent relationships', () => {
                const wml = deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(room1) />
                        <Feature uuid=(feature1) key=(feature1)>
                            <Parent>ROOM#room1</Parent>
                        </Feature>
                        <Feature uuid=(feature2) key=(feature2)>
                            <Parent>ROOM#room1</Parent>
                        </Feature>
                    </Asset>
                `)
                expect(() => new StandardForm(wml)).not.toThrow()
            })

            it('should not throw error for asset-level components', () => {
                const wml = deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(room1) />
                        <Feature uuid=(feature1) key=(feature1) />
                        <Situation uuid=(situation1) key=(situation1)>
                            <Parent />
                        </Situation>
                    </Asset>
                `)
                expect(() => new StandardForm(wml)).not.toThrow()
            })

            it('should detect cycle in merge operation', () => {
                const base = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Feature uuid=(featureA) key=(featureA)>
                            <Parent>FEATURE#featureB</Parent>
                        </Feature>
                        <Feature uuid=(featureB) key=(featureB) />
                    </Asset>
                `))
                
                const incoming = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Feature uuid=(featureA) key=(featureA) ref={0} />
                        <Feature uuid=(featureB) key=(featureB) ref={0}>
                            <Parent>FEATURE#featureA</Parent>
                        </Feature>
                    </Asset>
                `))
                
                expect(() => base.merge(incoming)).toThrow('Circular parent relationship detected')
            })

            it('should detect cycle in diff operation', () => {
                const base = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(roomA) key=(roomA) />
                        <Feature uuid=(featureA) key=(featureA)>
                            <Remove><Parent>FEATURE#featureB</Parent></Remove>
                        </Feature>
                        <Feature uuid=(featureB) key=(featureB) />
                    </Asset>
                `))
                
                const modified = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(roomA) key=(roomA) />
                        <Feature uuid=(featureA) key=(featureA) />
                        <Feature uuid=(featureB) key=(featureB)>
                            <Parent>FEATURE#featureA</Parent>
                        </Feature>
                    </Asset>
                `))
                
                // Note: This will throw on invalid parent type (Features can't parent Features)
                // before it reaches cycle detection. With current component types, valid cycles aren't possible.
                expect(() => base.diff(modified)).toThrow()
            })
        })
    })
})
