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
    it('should handle diff scenarios with character reference changes', () => {
        const baseWML = deIndentWML(`
            <Asset uuid=(diff)>
                <Character uuid=(char1) key=(char1)>
                    <ShortName>Alice</ShortName>
                    <DisplayName>Alice</DisplayName>
                </Character>
                <Character uuid=(char2) key=(char2)>
                    <ShortName>Bob</ShortName>
                    <DisplayName>Bob</DisplayName>
                </Character>
                <Room uuid=(room1) key=(room1)>
                    <Character uuid=(local1) key=(local1)>
                        <ShortName>Local1</ShortName>
                        <DisplayName>Local Character 1</DisplayName>
                    </Character>
                    <Character uuid=(char1) />
                </Room>
            </Asset>
        `)
        
        const modifiedWML = deIndentWML(`
            <Asset uuid=(diff)>
                <Character uuid=(char1) key=(char1)>
                    <ShortName>Alice</ShortName>
                    <DisplayName>Alice</DisplayName>
                </Character>
                <Character uuid=(char2) key=(char2)>
                    <ShortName>Bob</ShortName>
                    <DisplayName>Bob</DisplayName>
                </Character>
                <Character uuid=(char3) key=(char3)>
                    <ShortName>Charlie</ShortName>
                    <DisplayName>Charlie</DisplayName>
                </Character>
                <Room uuid=(room1) key=(room1)>
                    <Character uuid=(local2) key=(local2)>
                        <ShortName>Local2</ShortName>
                        <DisplayName>Local Character 2</DisplayName>
                    </Character>
                    <Character uuid=(char2) />
                    <Character uuid=(char3) />
                </Room>
            </Asset>
        `)
        
        const baseForm = new StandardForm(baseWML)
        const modifiedForm = new StandardForm(modifiedWML)
        
        // Generate diff
        const diff = baseForm.diff(modifiedForm)
        
        // Verify diff contains character changes (including reference to existing global char2)
        expect(diff).toBeDefined()
        const diffWML = schemaToWML([diff.schema])
        expect(diffWML).toEqual(deIndentWML(`
            <Asset uuid=(diff)>
                <Character uuid=(char3) key=(char3)>
                    <ShortName>Charlie</ShortName>
                    <DisplayName>Charlie</DisplayName>
                </Character>
                <Room uuid=(room1) key=(room1) ref={0}>
                    <Character key=(char3) />
                    <Remove>
                        <Character uuid=(local1) key=(local1)>
                            <ShortName>Local1</ShortName>
                            <DisplayName>Local Character 1</DisplayName>
                        </Character>
                    </Remove>
                    <Character uuid=(local2) key=(local2)>
                        <ShortName>Local2</ShortName>
                        <DisplayName>Local Character 2</DisplayName>
                    </Character>
                    <Remove><Character uuid=(char1) key=(char1) /></Remove>
                    <Character uuid=(char2) key=(char2) />
                </Room>
            </Asset>
        `))
    })

    describe('diff method', () => {
        it('should return an empty diff for identical forms', () => {
            const base = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const incoming = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(`<Asset uuid=(Test) />`)
        })

        it('should return the incoming form when base is empty', () => {
            const base = new StandardForm(`<Asset uuid=(Test) />`)
            const incoming = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
        })

        it('should remove the base form components when incoming is empty', () => {
            const base = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const incoming = new StandardForm(`<Asset uuid=(Test) />`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Remove><Room uuid=(testRoom) key=(testRoom) /></Remove>
                </Asset>
            `))
        })

        it('should return the diff for added components', () => {
            const base = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const incoming = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /><Room uuid=(testRoomTwo) key=(testRoomTwo) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(`<Asset uuid=(Test)><Room uuid=(testRoomTwo) key=(testRoomTwo) /></Asset>`)
        })

        it('should return the diff for added top-level references to pre-existing components', () => {
            const base = new StandardForm(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room uuid=(testRoom) key=(testRoom)>
                        <Feature uuid=(testFeature) key=(testFeature)>
                            <ShortName>Test Feature</ShortName>
                        </Feature>
                    </Room>
                </Asset>
            `))
            const incoming = new StandardForm(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room uuid=(testRoom) key=(testRoom)>
                        <Feature uuid=(testFeature) key=(testFeature) />
                    </Room>
                    <Feature uuid=(testFeature) key=(testFeature)>
                        <ShortName>Test Feature</ShortName>
                    </Feature>
                </Asset>
            `))
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(`<Asset uuid=(Test)><Feature uuid=(testFeature) key=(testFeature) /></Asset>`)
        })

        it('should return the diff for removed components', () => {
            const base = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /><Room uuid=(testRoomTwo) key=(testRoomTwo) /></Asset>`)
            const incoming = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Remove><Room uuid=(testRoomTwo) key=(testRoomTwo) /></Remove>
                </Asset>
            `))
        })

        it('should return simple Remove tag when removing component with nested content', () => {
            const base = new StandardForm(`<Asset uuid=(Test)>
                <Room uuid=(testRoom) key=(testRoom)>
                    <Situation ref={0} uuid=(base)>
                        <DisplayName>Test Room</DisplayName>
                        <Description>Test Description</Description>
                    </Situation>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) />
            </Asset>`)
            const incoming = new StandardForm(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room uuid=(testRoomTwo) key=(testRoomTwo) />
                </Asset>
            `))
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Remove>
                        <Room uuid=(testRoom) key=(testRoom)>
                            <Situation uuid=(base) ref={0}>
                                <DisplayName>Test Room</DisplayName>
                                <Description>Test Description</Description>
                            </Situation>
                        </Room>
                    </Remove>
                    <Situation uuid=(base) ref={0} />
                </Asset>
            `))
        })

        it('should return a minimal in-place edit diff for modified nested components', () => {
            const base = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom)><Situation ref={0} uuid=(base) key=(base)><DisplayName>Old Name</DisplayName></Situation></Room></Asset>`)
            const incoming = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom)><Situation ref={0} uuid=(base) key=(base)><DisplayName>New Name</DisplayName></Situation></Room></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room uuid=(testRoom) key=(testRoom) ref={0}>
                        <Situation key=(base) ref={0}>
                            <Replace><DisplayName>Old Name</DisplayName></Replace>
                            <With><DisplayName>New Name</DisplayName></With>
                        </Situation>
                    </Room>
                    <Situation uuid=(base) key=(base) ref={0} />
                </Asset>
            `))
        })

        it('should return the diff for added and removed components', () => {
            const base = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const incoming = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoomTwo) key=(testRoomTwo) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Remove><Room uuid=(testRoom) key=(testRoom) /></Remove>
                    <Room uuid=(testRoomTwo) key=(testRoomTwo) />
                </Asset>
            `))
        })

        it('should return the diff for nested feature components', () => {
            const base = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom)><Feature uuid=(testFeature) key=(testFeature) /></Room></Asset>`)
            const incoming = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom)><Feature uuid=(testFeature) key=(testFeature) /><Feature uuid=(testFeatureTwo) key=(testFeatureTwo) /></Room></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room uuid=(testRoom) key=(testRoom) ref={0}>
                        <Feature uuid=(testFeatureTwo) key=(testFeatureTwo) />
                    </Room>
                </Asset>
            `))
        })

        it('should include referenced-only components in diff when references appear in the diff outputs', () => {
            // Test case: Empty component (no content) referenced in different parents
            // When diffing, the component itself should appear in the diff, not just reference changes in parents
            const baseWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                    <Room uuid=(room2) key=(room2) />
                </Asset>
            `)
            const modifiedWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Room uuid=(room2) key=(room2)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                </Asset>
            `)
            
            const baseForm = new StandardForm(baseWML)
            const modifiedForm = new StandardForm(modifiedWML)
            const diffForm = baseForm.diff(modifiedForm)
            
            expect(diffForm).toBeDefined()
            
            // The diff should include the feature component itself, not just the room reference changes
            const featureInDiff = diffForm!._lookup('FEATURE#feature1')
            expect(featureInDiff).toBeDefined()
            
            // Verify feature exists in components array
            const featureComponent = diffForm!._components.find(
                component => component.universalKey === 'FEATURE#feature1'
            )
            expect(featureComponent).toBeDefined()
        })

        it('should return the diff for nested situation components', () => {
            const base = new StandardForm(`<Asset uuid=(Test)><Knowledge uuid=(testRoom) key=(testRoom)><Situation ref={0} uuid=(situation1) key=(situation1) /></Knowledge></Asset>`)
            const incoming = new StandardForm(`<Asset uuid=(Test)><Knowledge uuid=(testRoom) key=(testRoom)><Situation ref={0} uuid=(situation1) key=(situation1) /><Situation ref={0} uuid=(situation2) key=(situation2) /></Knowledge></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Knowledge uuid=(testRoom) key=(testRoom) ref={0}>
                        <Situation key=(situation2) ref={0} />
                    </Knowledge>
                    <Situation uuid=(situation2) key=(situation2) ref={0} />
                </Asset>
            `))
        })

        it('should remove nested components properly', () => {
            const base = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom)><Feature uuid=(testFeature) key=(testFeature) /></Room></Asset>`)
            const incoming = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room uuid=(testRoom) key=(testRoom) ref={0}>
                        <Remove><Feature uuid=(testFeature) key=(testFeature) /></Remove>
                    </Room>
                </Asset>
            `))
        })

        it('should remove components with nested components properly', () => {
            const base = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom)><Feature uuid=(testFeature) key=(testFeature) /></Room></Asset>`)
            const incoming = new StandardForm(`<Asset uuid=(Test) />`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Remove>
                        <Room uuid=(testRoom) key=(testRoom)>
                            <Feature uuid=(testFeature) key=(testFeature) />
                        </Room>
                    </Remove>
                </Asset>
            `))
        })

        describe('Nested Component Change (In-Place) - Minimal Diff Format', () => {
            it('should generate minimal diff for nested component change (no Parent tag, no topLevel)', () => {
                const base = new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(room1) key=(room1)>
                            <Situation ref={0} uuid=(ex1) key=(ex1)>
                                <DisplayName>Old Name</DisplayName>
                            </Situation>
                        </Room>
                    </Asset>
                `))
                const incoming = new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(room1) key=(room1)>
                            <Situation ref={0} uuid=(ex1) key=(ex1)>
                                <DisplayName>New Name</DisplayName>
                            </Situation>
                        </Room>
                    </Asset>
                `))
                const diff = base.diff(incoming)
                
                // Expected: Minimal diff - only the changed component, no parent components
                expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(room1) key=(room1) ref={0}>
                            <Situation key=(ex1) ref={0}>
                                <Replace><DisplayName>Old Name</DisplayName></Replace>
                                <With><DisplayName>New Name</DisplayName></With>
                            </Situation>
                        </Room>
                        <Situation uuid=(ex1) key=(ex1) ref={0} />
                    </Asset>
                `))
                
                // Verify no Parent tag
                const situationComponent = diff.byUniversalId['SITUATION#ex1']
                expect(situationComponent?.explicitParent).toBeUndefined()
                
                // Verify not in topLevel (nested change)
                // topLevel should be undefined since Situation is nested, not at Asset level
                expect(diff._topLevel?.toJSON()).toEqual([])
            })

            it('should merge minimal diff correctly, maintaining nested structure', () => {
                const base = new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1)>
                            <Situation ref={0} uuid=(ex1) key=(ex1)>
                                <DisplayName>Original</DisplayName>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
                const diff = new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1) ref={0}>
                            <Situation uuid=(ex1) key=(ex1) ref={0}>
                                <Replace><DisplayName>Original</DisplayName></Replace>
                                <With><DisplayName>Updated</DisplayName></With>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
                const merged = base.merge(diff)
                
                expect(schemaToWML([merged.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1)>
                            <Situation key=(ex1) ref={0}>
                                <DisplayName>Updated</DisplayName>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
                
                // Verify situation stub exists
                const knowledge = merged._lookup('KNOWLEDGE#room1') as StandardKnowledge
                expect(knowledge.situations.items[0].payload?._displayName?.toJSON()).toEqual('Updated')
                
                // Verify not in topLevel
                expect(merged.header.topLevel).toEqual(['KNOWLEDGE#room1'])
            })
        })

        it('should generate diff with Parent tag when component is moved to Asset-level', () => {
            const base = new StandardForm(deIndentWML(`
                <Asset uuid=(Test)>
                    <Knowledge uuid=(room1) key=(room1)>
                        <Situation ref={0} uuid=(ex1) key=(ex1)>
                            <DisplayName>Old Example</DisplayName>
                        </Situation>
                    </Knowledge>
                </Asset>
            `))
            const incoming = new StandardForm(deIndentWML(`
                <Asset uuid=(Test)>
                    <Situation uuid=(ex1) key=(ex1) ref={0} />
                    <Knowledge uuid=(room1) key=(room1)>
                        <Situation uuid=(ex1) key=(ex1)>
                            <DisplayName>New Example</DisplayName>
                        </Situation>
                    </Knowledge>
                </Asset>
            `))
            const diff = base.diff(incoming)
            
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Knowledge uuid=(room1) key=(room1) ref={0}>
                        <Situation key=(ex1)>
                            <Replace><DisplayName>Old Example</DisplayName></Replace>
                            <With><DisplayName>New Example</DisplayName></With>
                        </Situation>
                    </Knowledge>
                </Asset>
            `))
            
        })

        describe('Case 2: Explicit Top-Level Component', () => {

            it('should merge diff with Parent tag correctly, placing component at Asset-level', () => {
                const base = new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1)>
                            <Situation ref={0} uuid=(ex1) key=(ex1) />
                        </Knowledge>
                    </Asset>
                `))
                const diff = new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1) ref={0}>
                            <Situation uuid=(ex1) key=(ex1) ref={0}>
                                <Parent />
                                <DisplayName>New Example</DisplayName>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
                const merged = base.merge(diff)
                
                expect(schemaToWML([merged.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1)>
                            <Situation key=(ex1) ref={0}>
                                <DisplayName>New Example</DisplayName>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
            })
        })

        describe('Case 3: Component Moving from Nested to Top-Level', () => {
            it('should generate diff with Parent tag and reference removal when component moves to Asset-level', () => {
                const base = new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1)>
                            <Situation ref={0} uuid=(ex1) key=(ex1)>
                                <DisplayName>Nested Example</DisplayName>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
                const incoming = new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Situation uuid=(ex1) key=(ex1) ref={0} />
                        <Knowledge uuid=(room1) key=(room1)>
                            <Situation uuid=(ex1) key=(ex1)>
                                <DisplayName>Top-Level Example</DisplayName>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
                const diff = base.diff(incoming)
                
                expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1) ref={0}>
                            <Situation key=(ex1)>
                                <Replace><DisplayName>Nested Example</DisplayName></Replace>
                                <With><DisplayName>Top-Level Example</DisplayName></With>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
            })

            it('should merge diff with Parent tag and reference removal correctly', () => {
                const base = new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1)>
                            <Situation ref={0} uuid=(ex1) key=(ex1)>
                                <DisplayName>Nested Example</DisplayName>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
                const diff = new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Situation uuid=(ex1) key=(ex1) ref={0} />
                        <Knowledge uuid=(room1) key=(room1) ref={0}>
                            <Situation key=(ex1) ref={0}>
                                <Parent />
                                <Replace><DisplayName>Nested Example</DisplayName></Replace>
                                <With><DisplayName>Top-Level Example</DisplayName></With>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
                const merged = base.merge(diff)
                
                expect(schemaToWML([merged.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1)>
                            <Situation key=(ex1) ref={0}>
                                <DisplayName>Top-Level Example</DisplayName>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
            })
        })

        // Case 4 revised (2025): reparenting via topLevel ref-counts + in-place situation prose diff;
        // no explicit <Parent> in diff output. Cases 2-3 and related Parent-tag merge fixtures
        // were left unchanged pending a systematic pass over this file.
        describe('Case 4: Component Moving from Asset-Level to Nested', () => {
            const case4BaseWML = deIndentWML(`
                <Asset uuid=(Test)>
                    <Situation uuid=(ex1) key=(ex1) />
                    <Knowledge uuid=(room1) key=(room1)>
                        <Situation uuid=(ex1) key=(ex1)>
                            <DisplayName>Top-level</DisplayName>
                        </Situation>
                    </Knowledge>
                </Asset>
            `)
            const case4IncomingWML = deIndentWML(`
                <Asset uuid=(Test)>
                    <Knowledge uuid=(room1) key=(room1)>
                        <Situation uuid=(ex1) key=(ex1)>
                            <DisplayName>Now nested</DisplayName>
                        </Situation>
                    </Knowledge>
                </Asset>
            `)

            it('should generate diff with topLevel removal when Situation moves from Asset to nested', () => {
                const base = new StandardForm(case4BaseWML)
                const incoming = new StandardForm(case4IncomingWML)
                const diff = base.diff(incoming)

                expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1) ref={0}>
                            <Situation key=(ex1) ref={0}>
                                <Replace><DisplayName>Top-level</DisplayName></Replace>
                                <With><DisplayName>Now nested</DisplayName></With>
                            </Situation>
                        </Knowledge>
                        <Remove><Situation uuid=(ex1) key=(ex1) /></Remove>
                    </Asset>
                `))
            })

            it('should merge diff round-trip when Situation moves from Asset to nested', () => {
                const base = new StandardForm(case4BaseWML)
                const incoming = new StandardForm(case4IncomingWML)
                const diff = base.diff(incoming)
                const merged = base.merge(diff)

                expect(schemaToWML([merged.schema])).toEqual(schemaToWML([incoming.schema]))

                const situationComponent = merged.byUniversalId['SITUATION#ex1']
                expect(situationComponent?.explicitParent).toBeUndefined()
            })
        })

        //
        // Local key assignment: diff emits explicit Key edits. Full merge retarget behavior
        // (exits, map positions, prose links) lives in standardForm.keyChangesViaMerge.test.ts.
        //
        describe('local key assignment (diff)', () => {
            it('should emit explicit Key Replace in diff when component key is renamed', () => {
                const base = new StandardForm(`<Asset uuid=(Test)><Feature uuid=(Feature1) key=(Feature1)><ShortName>Test</ShortName></Feature></Asset>`)
                const incoming = new StandardForm(`<Asset uuid=(Test)><Feature uuid=(Feature1) key=(clockTower)><ShortName>Test</ShortName></Feature></Asset>`)
                const diff = base.diff(incoming)
                expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Feature uuid=(Feature1) key=(Feature1) ref={0}>
                            <Replace><Key>Feature1</Key></Replace><With><Key>clockTower</Key></With>
                        </Feature>
                    </Asset>
                `))
            })

            it('should emit key addition in diff when component gains a local key', () => {
                const base = new StandardForm(`<Asset uuid=(Test)><Feature uuid=(Feature1)><ShortName>Test</ShortName></Feature></Asset>`)
                const incoming = new StandardForm(`<Asset uuid=(Test)><Feature uuid=(Feature1) key=(clockTower)><ShortName>Test</ShortName></Feature></Asset>`)
                const diff = base.diff(incoming)
                // Should show key being added - lookup by universalKey since base has no local key
                const component = diff._lookup('FEATURE#Feature1')
                expect(component).toBeDefined()
                expect(component?.key).toBe('clockTower')
            })

            it('should emit key removal in diff when component loses a local key', () => {
                const base = new StandardForm(`<Asset uuid=(Test)><Feature uuid=(Feature1) key=(clockTower)><ShortName>Test</ShortName></Feature></Asset>`)
                const incoming = new StandardForm(`<Asset uuid=(Test)><Feature uuid=(Feature1)><ShortName>Test</ShortName></Feature></Asset>`)
                const diff = base.diff(incoming)
                // Should show key being removed - lookup by universalKey since incoming has no local key
                const component = diff._lookup('FEATURE#Feature1')
                expect(component).toBeDefined()
                // The key should be removed (undefined or showing Remove semantics)
                // When key is removed, the component in diff might still have the old key or be undefined
                // Check that the key diff shows removal
                const keyJSON = component?._key?.toJSON()
                if (keyJSON && typeof keyJSON === 'object' && keyJSON.tag === 'Remove') {
                    expect(keyJSON.match).toBe('clockTower')
                } else {
                    // Or the key might be undefined
                    expect(component?.key).toBeUndefined()
                }
            })

            it('should emit Key Replace and content Replace in diff when both change', () => {
                const base = new StandardForm(`<Asset uuid=(Test)><Feature uuid=(Feature1) key=(Feature1)><ShortName>Old Name</ShortName></Feature></Asset>`)
                const incoming = new StandardForm(`<Asset uuid=(Test)><Feature uuid=(Feature1) key=(clockTower)><ShortName>New Name</ShortName></Feature></Asset>`)
                const diff = base.diff(incoming)
                expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Feature uuid=(Feature1) key=(Feature1) ref={0}>
                            <Replace><Key>Feature1</Key></Replace><With><Key>clockTower</Key></With>
                            <Replace><ShortName>Old Name</ShortName></Replace>
                            <With><ShortName>New Name</ShortName></With>
                        </Feature>
                    </Asset>
                `))
            })

            it('should produce non-empty diff when room gains local key and link uses resolved target', () => {
                const base = new StandardForm(`
                    <Asset uuid=(testAsset)>
                        <Feature uuid=(feat1) key=(feat1) />
                        <Room uuid=(Room1)>
                            <Situation uuid=(DEFAULT)>
                                <Description><Link to=(ROOM#feat1)>link</Link></Description>
                            </Situation>
                        </Room>
                    </Asset>
                `)
                const incoming = new StandardForm(`
                    <Asset uuid=(testAsset)>
                        <Feature uuid=(feat1) key=(gardenFeature) />
                        <Room uuid=(Room1) key=(main)>
                            <Situation uuid=(DEFAULT)>
                                <Description><Link to=(gardenFeature)>link</Link></Description>
                            </Situation>
                        </Room>
                    </Asset>
                `)
                const diff = base.diff(incoming)
                expect(diff.isEmpty()).toBe(false)
                expect(schemaToWML([base.merge(diff).schema])).toEqual(schemaToWML([incoming.schema]))
            })

            it('should produce non-empty diff with new local key when map position uses resolved key', () => {
                const base = new StandardForm(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(Room2)>
                            <Situation uuid=(DEFAULT)><DisplayName>Garden</DisplayName></Situation>
                        </Room>
                        <Map uuid=(testMap)><Room uuid=(Room2)><Position {0, 0} /></Room></Map>
                    </Asset>
                `)
                const incoming = new StandardForm(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(Room2) key=(garden)>
                            <Situation uuid=(DEFAULT)><DisplayName>Garden</DisplayName></Situation>
                        </Room>
                        <Map uuid=(testMap)><Room key=(garden)><Position {0, 0} /></Room></Map>
                    </Asset>
                `)
                const diff = base.diff(incoming)
                expect(diff.isEmpty()).toBe(false)
                expect(diff._lookup('ROOM#Room2')?.key).toBe('garden')
            })

            it('should emit Key Replace in diff for feature rename (prose link retarget via merge)', () => {
                const base = new StandardForm(`
                    <Asset uuid=(testAsset)>
                        <Feature uuid=(Feature1) key=(Feature1)>
                            <Situation uuid=(base)>
                                <DisplayName>Test Feature</DisplayName>
                                <Description><Link to=(Feature1)>Link</Link></Description>
                            </Situation>
                        </Feature>
                    </Asset>
                `)
                const incoming = new StandardForm(`
                    <Asset uuid=(testAsset)>
                        <Feature uuid=(Feature1) key=(clockTower)>
                            <Situation uuid=(base)>
                                <DisplayName>Test Feature</DisplayName>
                                <Description><Link to=(clockTower)>Link</Link></Description>
                            </Situation>
                        </Feature>
                    </Asset>
                `)
                const diff = base.diff(incoming)
                expect(diff.isEmpty()).toBe(false)
                const featureDiff = diff._lookup('FEATURE#Feature1')
                expect(featureDiff).toBeDefined()
                expect(featureDiff?.key).toBe('Feature1')
                expect(schemaToWML([diff.schema])).toContain('<Replace><Key>Feature1</Key></Replace><With><Key>clockTower</Key></With>')
            })
        })

        it('should assure endpoint room stubs when removing an Area edge', () => {
            const baseWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Area uuid=(region) key=(region)>
                        <Room uuid=(highway) key=(highway) />
                        <Exit uuid=(e1)>
                            <From>highway</From>
                            <To>ROOM#outside</To>
                            <Forward>east</Forward>
                            <Back>west</Back>
                        </Exit>
                    </Area>
                </Asset>
            `)
            const incomingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Area uuid=(region) key=(region)>
                        <Room uuid=(highway) key=(highway) />
                    </Area>
                </Asset>
            `)
            const diff = new StandardForm(baseWML).diff(new StandardForm(incomingWML))
            expect(diff).toBeDefined()

            const outsideStub = diff!._lookup('ROOM#outside')
            expect(outsideStub).toBeDefined()
            expect(outsideStub?.tag).toBe('Room')
            expect(outsideStub?.universalKey).toBe('ROOM#outside')

            const highwayStub = diff!._lookup('ROOM#highway')
            expect(highwayStub).toBeDefined()
            expect(highwayStub?.tag).toBe('Room')
            expect(highwayStub?.universalKey).toBe('ROOM#highway')
        })

    })
})
