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
    describe('removeComponent', () => {
        it('should remove a component from the StandardForm', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Room uuid=(room2) key=(room2) />
                </Asset>
            `))
            
            const room1Ref = new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })
            const result = form.removeComponent(room1Ref)
            
            expect(result._components.length).toBe(1)
            expect(result._components[0].key).toBe('room2')
            expect(result._components[0].universalKey).toBe('ROOM#room2')
        })

        it('should remove component from topLevel if present', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Room uuid=(room2) key=(room2) />
                </Asset>
            `))
            
            const room1Ref = new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })
            const result = form.removeComponent(room1Ref)
            
            expect(result._topLevel?.payload.length).toBe(1)
            expect(result._topLevel?.payload[0].key).toBe('room2')
            expect(result._topLevel?.payload[0].universalKey).toBe('ROOM#room2')
        })

        it('should return unchanged form when component is not found', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                </Asset>
            `))
            
            const nonExistentRef = new StandardReference({ tag: 'Room', key: 'nonexistent', universalKey: 'ROOM#nonexistent' })
            const result = form.removeComponent(nonExistentRef)
            
            expect(result._components.length).toBe(1)
            expect(result._components[0].key).toBe('room1')
        })

        it('should remove references from multiple components', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Feature uuid=(feature1) key=(feature1) />
                    <Room uuid=(room1) key=(room1)>
                        <Feature key=(feature1) />
                    </Room>
                    <Room uuid=(room2) key=(room2)>
                        <Feature key=(feature1) />
                    </Room>
                </Asset>
            `))
            
            const feature1Ref = new StandardReference({ tag: 'Feature', key: 'feature1', universalKey: 'FEATURE#feature1' })
            const result = form.removeComponent(feature1Ref)
            
            // Feature should be removed
            expect(result._components.find(c => c.key === 'feature1')).toBeUndefined()
            
            // Both rooms should exist but without feature references
            const room1 = result._components.find(c => c.key === 'room1') as StandardRoom
            const room2 = result._components.find(c => c.key === 'room2') as StandardRoom
            expect(room1.features?.payload.length).toBe(0)
            expect(room2.features?.payload.length).toBe(0)
        })

        it('should follow functional pattern and not mutate original', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Room uuid=(room2) key=(room2) />
                </Asset>
            `))
            
            const originalComponentCount = form._components.length
            const room1Ref = new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })
            const result = form.removeComponent(room1Ref)
            
            // Original should be unchanged
            expect(form._components.length).toBe(originalComponentCount)
            expect(form._components.find(c => c.key === 'room1')).toBeDefined()
            
            // Result should be different
            expect(result._components.length).toBe(1)
            expect(result._components.find(c => c.key === 'room1')).toBeUndefined()
        })

        it('should handle removing component referenced by universalKey only', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Feature uuid=(feature1) />
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) />
                    </Room>
                </Asset>
            `))
            
            const feature1Ref = new StandardReference({ tag: 'Feature', universalKey: 'FEATURE#feature1' })
            const result = form.removeComponent(feature1Ref)
            
            // Feature should be removed
            expect(result._components.find(c => c.universalKey === 'FEATURE#feature1')).toBeUndefined()
            
            // Room should still exist but without the feature reference
            const room = result._components.find(c => c.key === 'room1') as StandardRoom
            expect(room.features?.payload.length).toBe(0)
        })

        describe('cascade option', () => {
            it('should remove component and all descendants when cascade=true', () => {
                const form = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(room1)>
                            <Feature uuid=(f1) key=(f1)>
                                <Situation uuid=(example1) key=(example1) />
                                <Situation uuid=(example2) key=(example2) />
                            </Feature>
                        </Room>
                    </Asset>
                `))
                
                const room1Ref = new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })
                const result = form.removeComponent(room1Ref, { cascade: true })
                
                // Room and both Situations should be removed
                expect(result._components.length).toBe(0)
                expect(result._components.find(c => c.key === 'room1')).toBeUndefined()
                expect(result._components.find(c => c.key === 'example1')).toBeUndefined()
                expect(result._components.find(c => c.key === 'example2')).toBeUndefined()
            })

            it('should remove nested hierarchy when cascade=true', () => {
                const form = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(room1)>
                            <Feature uuid=(feature1) key=(feature1)>
                                <Situation uuid=(example1) key=(example1) />
                            </Feature>
                        </Room>
                    </Asset>
                `))
                
                const room1Ref = new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })
                const result = form.removeComponent(room1Ref, { cascade: true })
                
                // Room, Feature, and Situation should all be removed
                expect(result._components.length).toBe(0)
                expect(result._components.find(c => c.key === 'room1')).toBeUndefined()
                expect(result._components.find(c => c.key === 'feature1')).toBeUndefined()
                expect(result._components.find(c => c.key === 'example1')).toBeUndefined()
            })

            it('should only remove component when cascade=false', () => {
                const form = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(room1)>
                            <Situation ref={0} uuid=(example1) key=(example1) />
                        </Room>
                    </Asset>
                `))
                
                const room1Ref = new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })
                const result = form.removeComponent(room1Ref, { cascade: false })
                
                // Only Room should be removed, hoisted Situation stub should remain
                expect(result._components.length).toBe(1)
                expect(result._components.find(c => c.key === 'room1')).toBeUndefined()
                expect(result._components.find(c => c.key === 'example1' && c.tag === 'Situation')).toBeDefined()
            })

            it('should behave same as cascade=false when component has no descendants', () => {
                const form = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(room1) />
                        <Room uuid=(room2) key=(room2) />
                    </Asset>
                `))
                
                const room1Ref = new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })
                const result = form.removeComponent(room1Ref, { cascade: true })
                
                // Only room1 should be removed
                expect(result._components.length).toBe(1)
                expect(result._components.find(c => c.key === 'room1')).toBeUndefined()
                expect(result._components.find(c => c.key === 'room2')).toBeDefined()
            })

            it('should remove component and descendants from topLevel when cascade=true', () => {
                const form = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(room1)>
                            <Situation ref={0} uuid=(example1) key=(example1) />
                        </Room>
                    </Asset>
                `))
                
                const room1Ref = new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })
                const result = form.removeComponent(room1Ref, { cascade: true })
                
                // topLevel should be empty or undefined
                expect(result._topLevel).toBeUndefined()
            })

            it('should remove references to all removed components when cascade=true', () => {
                const form = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(room1)>
                            <Feature uuid=(feature1) key=(feature1)>
                                <Situation uuid=(example1) key=(example1) />
                            </Feature>
                        </Room>
                        <Room uuid=(room2) key=(room2) />
                    </Asset>
                `))
                
                const room1Ref = new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })
                const result = form.removeComponent(room1Ref, { cascade: true })
                
                // room1, feature1, and example1 should all be removed (all are descendants of room1)
                expect(result._components.find(c => c.key === 'room1')).toBeUndefined()
                expect(result._components.find(c => c.key === 'feature1')).toBeUndefined()
                expect(result._components.find(c => c.key === 'example1')).toBeUndefined()
                
                // room2 should still exist
                expect(result._components.find(c => c.key === 'room2')).toBeDefined()
            })
        })
    })
})
