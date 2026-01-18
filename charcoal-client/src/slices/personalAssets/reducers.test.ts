import produce from "immer"
import { updateStandard, UpdateStandardPayload } from "./reducers"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { Schema, schemaToWML } from "@tonylb/mtw-wml/ts/schema"
import { deIndentWML } from "@tonylb/mtw-wml/ts/schema/utils"
import { publicSelectors } from "./selectors"
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render"
import StandardExample from "@tonylb/mtw-wml/ts/standardize/components/example"
import { StandardExplicitKey } from "@tonylb/mtw-wml/ts/standardize/explicit"
import { StandardComponent } from "@tonylb/mtw-wml/ts/standardize/components/baseClasses"
import ReferenceList from "@tonylb/mtw-wml/ts/standardize/keys/referenceList"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/keys/reference"

describe('personalAsset slice reducers', () => {

    const transformWML = (wml: string, editWML: string, payload: UpdateStandardPayload): { base: string, standard: string, calculated: string, edit: string } => {
        const schema = new Schema()
        schema.loadWML(wml)
        const standardized = new StandardForm(schema.schema[0])
        const editSchema = new Schema()
        editSchema.loadWML(editWML)
        const editStandardized = new StandardForm(editSchema.schema[0])
        const standardizedJSON = standardized.toJSON()
        const newState = produce(
            {
                inherited: {
                    universalKey: standardizedJSON.universalKey,
                    components: [],
                    metaData: standardizedJSON.metaData || []
                },
                base: standardizedJSON,
                standard: standardizedJSON,
                edit: editStandardized.toJSON(),
                pendingEdits: []
            },
            (state) => { updateStandard(state as any, { type: 'updateStandard', payload }) }
        )
        const base = new StandardForm(newState.base)
        const newEdit = new StandardForm(newState.edit)
        const combinedStandardizer = base.merge(newEdit)
        const newStandardized = new StandardForm(publicSelectors.getStandardForm(newState as any))
        return {
            base: schemaToWML([base.schema]),
            standard: schemaToWML([newStandardized.schema]),
            calculated: schemaToWML([combinedStandardizer.schema]),
            edit: schemaToWML([newEdit.schema])
        }
    }

    describe('updateStandard', () => {
        it('should update schema content', () => {
            expect(transformWML(
                `
                    <Asset uuid=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Example uuid=(base)>
                                <Name>Test Room</Name>
                                <Description>Test Description</Description>
                            </Example>
                        </Room>
                    </Asset>
                `,
                `
                    <Asset uuid=(testAsset) />
                `,
                {
                    type: 'update',
                    update: (draft) => {
                        const exampleComponent = draft.byUniversalId['EXAMPLE#base']
                        if (exampleComponent instanceof StandardExample) {
                            const newExample = exampleComponent.clone()
                            newExample._payload._name = new StandardRender(['Test Update'])
                            draft.byUniversalId['EXAMPLE#base'] = newExample
                        }
                        return draft
                    }
                }
            )).toEqual({
                base: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Example uuid=(base)>
                                <Name>Test Room</Name>
                                <Description>Test Description</Description>
                            </Example>
                        </Room>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Example uuid=(base)>
                                <Name>Test Update</Name>
                                <Description>Test Description</Description>
                            </Example>
                        </Room>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Example uuid=(base)>
                                <Name>Test Update</Name>
                                <Description>Test Description</Description>
                            </Example>
                        </Room>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Example uuid=(base) ref={0}>
                            <Replace><Name>Room</Name></Replace><With><Name>Update</Name></With>
                        </Example>
                    </Asset>
                `)
            })
        })

        it('should remove a component', () => {
            expect(transformWML(
                `
                <Asset uuid=(testAsset)>
                    <Room uuid=(testRoom)>
                        <Example uuid=(base)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                        </Example>
                    </Room>
                    <Room uuid=(testRoomTwo) />
                </Asset>
                `,
                `
                    <Asset uuid=(testAsset) />
                `,
                {
                    type: 'update',
                    update: (draft) => {
                        draft._components = draft._components.filter((component) => (component.universalKey === 'ROOM#testRoomTwo'))
                        draft._topLevel = (draft._topLevel ?? new ReferenceList([])).filter((component: StandardReference) => (component.universalKey === 'ROOM#testRoomTwo'))
                        return draft
                    }
                }
            )).toEqual({
                base: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Example uuid=(base)>
                                <Name>Test Room</Name>
                                <Description>Test Description</Description>
                            </Example>
                        </Room>
                        <Room uuid=(testRoomTwo) />
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset uuid=(testAsset)><Room uuid=(testRoomTwo) /></Asset>
                `),
                calculated: deIndentWML(`
                    <Asset uuid=(testAsset)><Room uuid=(testRoomTwo) /></Asset>
                `),
                edit: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Remove>
                            <Room uuid=(testRoom)>
                                <Example uuid=(base)>
                                    <Name>Test Room</Name>
                                    <Description>Test Description</Description>
                                </Example>
                            </Room>
                        </Remove>
                    </Asset>
                `)
            })
        })

        it('should delete schema content', () => {
            expect(transformWML(
                `
                <Asset uuid=(testAsset)>
                    <Room uuid=(testRoom)>
                        <Example uuid=(base)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                        </Example>
                    </Room>
                </Asset>
                `,
                `
                <Asset uuid=(testAsset) />
                `,
                {
                    type: 'update',
                    update: (draft) => {
                        const exampleComponent = draft.byUniversalId['EXAMPLE#base']
                        if (exampleComponent instanceof StandardExample) {
                            const newExample = exampleComponent.clone()
                            newExample._payload._name = undefined
                            draft.byUniversalId['EXAMPLE#base'] = newExample
                        }
                        return draft
                    }
                }
            )).toEqual({
                base: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Example uuid=(base)>
                                <Name>Test Room</Name>
                                <Description>Test Description</Description>
                            </Example>
                        </Room>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Example uuid=(base)>
                                <Description>Test Description</Description>
                            </Example>
                        </Room>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Example uuid=(base)>
                                <Description>Test Description</Description>
                            </Example>
                        </Room>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Example uuid=(base) ref={0}>
                            <Remove><Name>Test Room</Name></Remove>
                        </Example>
                    </Asset>
                `)
            })
        })

        it('should rename exit targets on rename of room', () => {
            expect(transformWML(
                `
                <Asset uuid=(testAsset)>
                    <Room uuid=(Room1)>
                        <Example uuid=(base)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                        </Example>
                        <Exit to=(ROOM#Room2)>out</Exit>
                    </Room>
                    <Room uuid=(Room2)>
                        <Example uuid=(base2)><Name>Garden</Name></Example>
                        <Exit to=(ROOM#Room1)>text</Exit>
                    </Room>
                </Asset>
                `,
                `
                <Asset uuid=(testAsset) />
                `,
                {
                    type: 'update',
                    update: (draft: StandardForm) => {
                        const componentToUpdate = draft.byUniversalId['ROOM#Room2']
                        if (componentToUpdate) {
                            componentToUpdate._key = new StandardExplicitKey('garden')
                        }
                        return draft
                    }
                }
            )).toEqual({
                base: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(Room1)>
                            <Example uuid=(base)>
                                <Name>Test Room</Name>
                                <Description>Test Description</Description>
                            </Example>
                            <Exit to=(ROOM#Room2)>out</Exit>
                        </Room>
                        <Room uuid=(Room2)>
                            <Example uuid=(base2)><Name>Garden</Name></Example>
                            <Exit to=(ROOM#Room1)>text</Exit>
                        </Room>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(Room1)>
                            <Example uuid=(base)>
                                <Name>Test Room</Name>
                                <Description>Test Description</Description>
                            </Example>
                            <Exit to=(garden)>out</Exit>
                        </Room>
                        <Room uuid=(Room2) key=(garden)>
                            <Example uuid=(base2)><Name>Garden</Name></Example>
                            <Exit to=(ROOM#Room1)>text</Exit>
                        </Room>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(Room1)>
                            <Example uuid=(base)>
                                <Name>Test Room</Name>
                                <Description>Test Description</Description>
                            </Example>
                            <Exit to=(garden)>out</Exit>
                        </Room>
                        <Room uuid=(Room2) key=(garden)>
                            <Example uuid=(base2)><Name>Garden</Name></Example>
                            <Exit to=(ROOM#Room1)>text</Exit>
                        </Room>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset uuid=(testAsset)><Room uuid=(Room2) key=(garden) ref={0} /></Asset>
                `)
            })
        })

        it('should rename map references on rename of room', () => {
            expect(transformWML(
                `
                <Asset uuid=(testAsset)>
                    <Room uuid=(Room2)><Example uuid=(base)><Name>Garden</Name></Example></Room>
                    <Map uuid=(testMap)><Room uuid=(Room2)><Position {0, 0} /></Room></Map>
                </Asset>
                `,
                `
                    <Asset uuid=(testAsset) />
                `,
                {
                    type: 'update',
                    update: (draft: StandardForm) => {
                        const componentToUpdate = draft.byUniversalId['ROOM#Room2']
                        if (componentToUpdate) {
                            componentToUpdate._key = new StandardExplicitKey('garden')
                        }
                        return draft
                    }
                }
            )).toEqual({
                base: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(Room2)>
                            <Example uuid=(base)><Name>Garden</Name></Example>
                        </Room>
                        <Map uuid=(testMap)><Room uuid=(Room2)><Position {0, 0} /></Room></Map>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(Room2) key=(garden)>
                            <Example uuid=(base)><Name>Garden</Name></Example>
                        </Room>
                        <Map uuid=(testMap)><Room key=(garden)><Position {0, 0} /></Room></Map>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(Room2) key=(garden)>
                            <Example uuid=(base)><Name>Garden</Name></Example>
                        </Room>
                        <Map uuid=(testMap)><Room key=(garden)><Position {0, 0} /></Room></Map>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset uuid=(testAsset)><Room uuid=(Room2) key=(garden) ref={0} /></Asset>
                `)
            })
        })

        it('should rename link targets on rename of feature', () => {
            expect(transformWML(
                `
                <Asset uuid=(testAsset)>
                    <Feature uuid=(Feature1) key=(Feature1)>
                        <Example uuid=(base)>
                            <Name>Test Feature</Name>
                            <Description><Link to=(Feature1)>Link</Link></Description>
                        </Example>
                    </Feature>
                </Asset>
                `,
                `
                    <Asset uuid=(testAsset) />
                `,
                {
                    type: 'update',
                    update: (draft: StandardForm) => {
                        const componentToUpdate = draft.byUniversalId['FEATURE#Feature1']
                        if (componentToUpdate) {
                            componentToUpdate._key = new StandardExplicitKey('clockTower')
                        }
                        return draft
                    }
                }
            )).toEqual({
                base: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Feature uuid=(Feature1) key=(Feature1)>
                            <Example uuid=(base)>
                                <Name>Test Feature</Name>
                                <Description><Link to=(Feature1)>Link</Link></Description>
                            </Example>
                        </Feature>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Feature uuid=(Feature1) key=(clockTower)>
                            <Example uuid=(base)>
                                <Name>Test Feature</Name>
                                <Description><Link to=(clockTower)>Link</Link></Description>
                            </Example>
                        </Feature>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Feature uuid=(Feature1) key=(clockTower)>
                            <Example uuid=(base)>
                                <Name>Test Feature</Name>
                                <Description><Link to=(clockTower)>Link</Link></Description>
                            </Example>
                        </Feature>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Feature uuid=(Feature1) key=(Feature1) ref={0}>
                            <Replace><Key>Feature1</Key></Replace><With><Key>clockTower</Key></With>
                        </Feature>
                    </Asset>
                `)
            })
        })        
    })
})