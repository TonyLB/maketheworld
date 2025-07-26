import produce from "immer"
import { updateStandard, UpdateStandardPayload } from "./reducers"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { Schema, schemaToWML } from "@tonylb/mtw-wml/ts/schema"
import { deIndentWML } from "@tonylb/mtw-wml/ts/schema/utils"
import { publicSelectors } from "./selectors"
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render"
import StandardComputed from "@tonylb/mtw-wml/ts/standardize/components/computed"
import StandardExample from "@tonylb/mtw-wml/ts/standardize/components/example"

describe('personalAsset slice reducers', () => {

    const transformWML = (wml: string, editWML: string, payload: UpdateStandardPayload): { base: string, standard: string, calculated: string, edit: string } => {
        const schema = new Schema()
        schema.loadWML(wml)
        const standardized = new StandardForm(schema.schema[0])
        const editSchema = new Schema()
        editSchema.loadWML(editWML)
        const editStandardized = new StandardForm(editSchema.schema[0])
        const newState = produce(
            {
                inherited: {
                    ...standardized.toJSON(),
                    components: []
                },
                base: standardized.toJSON(),
                standard: standardized.toJSON(),
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
                    <Asset key=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Example uuid=(base)>
                                <Name>Test Room</Name>
                                <Description>Test Description</Description>
                            </Example>
                        </Room>
                    </Asset>
                `,
                `
                    <Asset key=(testAsset) />
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
                    <Asset key=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Example uuid=(base)>
                                <Name>Test Room</Name>
                                <Description>Test Description</Description>
                            </Example>
                        </Room>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Example uuid=(base)>
                                <Name>Test Update</Name>
                                <Description>Test Description</Description>
                            </Example>
                        </Room>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Example uuid=(base)>
                                <Name>Test Update</Name>
                                <Description>Test Description</Description>
                            </Example>
                        </Room>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Example uuid=(base)>
                                <Replace><Name>Test Room</Name></Replace>
                                <With><Name>Test Update</Name></With>
                            </Example>
                        </Room>
                    </Asset>
                `)
            })
        })

        it('should remove a component', () => {
            expect(transformWML(
                `
                <Asset key=(testAsset)>
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
                    <Asset key=(testAsset) />
                `,
                {
                    type: 'update',
                    update: (draft) => {
                        draft._components = draft._components.filter((component) => (component.universalKey === 'ROOM#testRoomTwo'))
                        console.log(`Schema after removal`, JSON.stringify(draft.toJSON(), null, 2))
                        return draft
                    }
                }
            )).toEqual({
                base: deIndentWML(`
                    <Asset key=(testAsset)>
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
                    <Asset key=(testAsset)><Room uuid=(testRoomTwo) /></Asset>
                `),
                calculated: deIndentWML(`
                    <Asset key=(testAsset)><Room uuid=(testRoomTwo) /></Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset)>
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
                <Asset key=(testAsset)>
                    <Room uuid=(testRoom)>
                        <Example uuid=(base)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                        </Example>
                    </Room>
                </Asset>
                `,
                `
                <Asset key=(testAsset) />
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
                    <Asset key=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Example uuid=(base)>
                                <Name>Test Room</Name>
                                <Description>Test Description</Description>
                            </Example>
                        </Room>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Example uuid=(base)>
                                <Description>Test Description</Description>
                            </Example>
                        </Room>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Example uuid=(base)>
                                <Description>Test Description</Description>
                            </Example>
                        </Room>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Example uuid=(base)><Remove><Name>Test Room</Name></Remove></Example>
                        </Room>
                    </Asset>
                `)
            })
        })

        it('should update a non-tree field in a standardComponent', () => {
            expect(transformWML(
                `
                <Asset key=(testAsset)><Computed uuid=(test) key=(testComputed) src={!testVar} /></Asset>
                `,
                `
                    <Asset key=(testAsset) />
                `,
                {
                    type: 'update',
                    update: (draft) => {
                        const computedComponent = draft.byUniversalId['COMPUTED#test']
                        if (computedComponent instanceof StandardComputed) {
                            const newExample = computedComponent.clone()
                            newExample._payload._src = 'testVar'
                            draft.byUniversalId['COMPUTED#test'] = newExample
                        }
                        return draft
                    }
                }
            )).toEqual({
                base: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Computed uuid=(test) key=(testComputed) src={!testVar} />
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Computed uuid=(test) key=(testComputed) src={testVar} />
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Computed uuid=(test) key=(testComputed) src={testVar} />
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Replace>
                            <Computed uuid=(test) key=(testComputed) src={!testVar} />
                        </Replace>
                        <With>
                            <Computed uuid=(test) key=(testComputed) src={testVar} />
                        </With>
                    </Asset>
                `)
            })
        })

        it('should rename exit targets on rename of room', () => {
            expect(transformWML(
                `
                <Asset key=(testAsset)>
                    <Room key=(Room1)>
                        <Example key=(base)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                        </Example>
                        <Exit to=(Room2)>out</Exit>
                    </Room>
                    <Room key=(Room2)>
                        <Example key=(base)><Name>Garden</Name></Example>
                        <Exit to=(Room1)>text</Exit>
                    </Room>
                </Asset>
                `,
                `
                <Asset key=(testAsset) />
                `,
                {
                    type: 'renameKey',
                    from: 'Room2',
                    to: 'garden'
                }
            )).toEqual({
                base: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(Room1)>
                            <Example key=(base)>
                                <Name>Test Room</Name>
                                <Description>Test Description</Description>
                            </Example>
                            <Exit to=(Room2)>out</Exit>
                        </Room>
                        <Room key=(Room2)>
                            <Example key=(base)><Name>Garden</Name></Example>
                            <Exit to=(Room1)>text</Exit>
                        </Room>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(garden)>
                            <Example key=(base)><Name>Garden</Name></Example>
                            <Exit to=(Room1)>text</Exit>
                        </Room>
                        <Room key=(Room1)>
                            <Example key=(base)>
                                <Name>Test Room</Name>
                                <Description>Test Description</Description>
                            </Example>
                            <Exit to=(garden)>out</Exit>
                        </Room>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(garden)>
                            <Example key=(base)><Name>Garden</Name></Example>
                            <Exit to=(Room1)>text</Exit>
                        </Room>
                        <Room key=(Room1)>
                            <Example key=(base)>
                                <Name>Test Room</Name>
                                <Description>Test Description</Description>
                            </Example>
                            <Exit to=(garden)>out</Exit>
                        </Room>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(garden)>
                            <Example key=(base)><Name>Garden</Name></Example>
                            <Exit to=(Room1)>text</Exit>
                        </Room>
                        <Room key=(Room1)>
                            <Remove><Exit to=(Room2)>out</Exit></Remove>
                            <Exit to=(garden)>out</Exit>
                        </Room>
                        <Remove>
                            <Room key=(Room2)>
                                <Example key=(base)><Name>Garden</Name></Example>
                                <Exit to=(Room1)>text</Exit>
                            </Room>
                        </Remove>
                    </Asset>
                `)
            })
        })

        it('should rename map references on rename of room', () => {
            expect(transformWML(
                `
                <Asset key=(testAsset)>
                    <Room key=(Room2)><Example key=(base)><Name>Garden</Name></Example></Room>
                    <Map key=(testMap)><Room key=(Room2)><Position x="0" y="0" /></Room></Map>
                </Asset>
                `,
                `
                    <Asset key=(testAsset) />
                `,
                {
                    type: 'renameKey',
                    from: 'Room2',
                    to: 'garden'
                }
            )).toEqual({
                base: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(Room2)><Example key=(base)><Name>Garden</Name></Example></Room>
                        <Map key=(testMap)><Room key=(Room2)><Position x="0" y="0" /></Room></Map>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(garden)><Example key=(base)><Name>Garden</Name></Example></Room>
                        <Map key=(testMap)><Room key=(garden)><Position x="0" y="0" /></Room></Map>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(garden)><Example key=(base)><Name>Garden</Name></Example></Room>
                        <Map key=(testMap)><Room key=(garden)><Position x="0" y="0" /></Room></Map>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(garden)><Example key=(base)><Name>Garden</Name></Example></Room>
                        <Remove>
                            <Room key=(Room2)>
                                <Example key=(base)><Name>Garden</Name></Example>
                            </Room>
                        </Remove>
                        <Replace>
                            <Map key=(testMap)>
                                <Room key=(Room2)><Position x="0" y="0" /></Room>
                            </Map>
                        </Replace>
                        <With>
                            <Map key=(testMap)>
                                <Room key=(garden)><Position x="0" y="0" /></Room>
                            </Map>
                        </With>
                    </Asset>
                `)
            })
        })

        it('should rename link targets on rename of feature', () => {
            expect(transformWML(
                `
                <Asset key=(testAsset)>
                    <Feature key=(Feature1)>
                        <Example key=(base)>
                            <Name>Test Feature</Name>
                            <Description><Link to=(Feature1)>Link</Link></Description>
                        </Example>
                    </Feature>
                </Asset>
                `,
                `
                    <Asset key=(testAsset) />
                `,
                {
                    type: 'renameKey',
                    from: 'Feature1',
                    to: 'clockTower'
                }
            )).toEqual({
                base: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Feature key=(Feature1)>
                            <Example key=(base)>
                                <Name>Test Feature</Name>
                                <Description><Link to=(Feature1)>Link</Link></Description>
                            </Example>
                        </Feature>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Feature key=(clockTower)>
                            <Example key=(base)>
                                <Name>Test Feature</Name>
                                <Description><Link to=(clockTower)>Link</Link></Description>
                            </Example>
                        </Feature>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Feature key=(clockTower)>
                            <Example key=(base)>
                                <Name>Test Feature</Name>
                                <Description><Link to=(clockTower)>Link</Link></Description>
                            </Example>
                        </Feature>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Feature key=(clockTower)>
                            <Example key=(base)>
                                <Name>Test Feature</Name>
                                <Description><Link to=(clockTower)>Link</Link></Description>
                            </Example>
                        </Feature>
                        <Remove>
                            <Feature key=(Feature1)>
                                <Example key=(base)>
                                    <Name>Test Feature</Name>
                                    <Description><Link to=(Feature1)>Link</Link></Description>
                                </Example>
                            </Feature>
                        </Remove>
                    </Asset>
                `)
            })
        })        
    })
})