import produce from "immer"
import { updateStandard, UpdateStandardPayload } from "./reducers"
import { StandardForm } from "@tonylb/mtw-wml/dist/standardize"
import { treeNodeTypeguard } from "@tonylb/mtw-base/dist/genericTree"
import { Schema, schemaToWML } from "@tonylb/mtw-wml/dist/schema"
import { deIndentWML } from "@tonylb/mtw-wml/dist/schema/utils"
import { publicSelectors } from "./selectors"
import { isSchemaString } from "@tonylb/mtw-base/dist/schema/renderTree"
import { isSchemaExit } from "@tonylb/mtw-base/dist/schema/components"

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
                    byId: {}
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
        it('should replace schema content', () => {
            expect(transformWML(
                `
                    <Asset key=(testAsset)>
                        <Room key=(testRoom)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                        </Room>
                    </Asset>
                `,
                `
                    <Asset key=(testAsset) />
                `,
                {
                    type: 'replaceItem',
                    componentKey: 'testRoom',
                    itemKey: 'name',
                    item: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Test Update' }, children: [] }]}
                }
            )).toEqual({
                base: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testRoom)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                        </Room>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testRoom)>
                            <Name>Test Update</Name>
                            <Description>Test Description</Description>
                        </Room>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testRoom)>
                            <Name>Test Update</Name>
                            <Description>Test Description</Description>
                        </Room>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testRoom)>
                            <Replace><Name>Test Room</Name></Replace>
                            <With><Name>Test Update</Name></With>
                        </Room>
                    </Asset>
                `)
            })
        })

        it('should replace schema content using an immer produce', () => {
            expect(transformWML(
                `
                <Asset key=(testAsset)>
                    <Room key=(testRoom)>
                        <Name>Test Room</Name>
                        <Description>Test Description</Description>
                    </Room>
                </Asset>
                `,
                `
                    <Asset key=(testAsset) />
                `,
                {
                    type: 'replaceItem',
                    componentKey: 'testRoom',
                    itemKey: 'description',
                    produce: (draft) => {
                        draft.children.filter(treeNodeTypeguard(isSchemaString)).forEach((node) => {
                            node.data.value = 'Functional update'
                        })
                    }
                }
            )).toEqual({
                base: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testRoom)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                        </Room>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testRoom)>
                            <Name>Test Room</Name>
                            <Description>Functional update</Description>
                        </Room>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testRoom)>
                            <Name>Test Room</Name>
                            <Description>Functional update</Description>
                        </Room>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testRoom)>
                            <Replace><Description>Test Description</Description></Replace>
                            <With><Description>Functional update</Description></With>
                        </Room>
                    </Asset>
                `)
            })
        })

        it('should add a component', () => {
            expect(transformWML(
                `
                <Asset key=(testAsset)>
                    <Room key=(testRoom)>
                        <Name>Test Room</Name>
                        <Description>Test Description</Description>
                    </Room>
                </Asset>
                `,
                `
                    <Asset key=(testAsset) />
                `,
                {
                    type: 'addComponent',
                    tag: 'Variable'
                }
            )).toEqual({
                base: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testRoom)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                        </Room>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testRoom)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                        </Room>
                        <Variable key=(Variable1) />
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testRoom)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                        </Room>
                        <Variable key=(Variable1) />
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset)><Variable key=(Variable1) /></Asset>
                `)
            })
        })

        it('should splice a component list', () => {
            //
            // Test removing an item from a list
            //
            expect(transformWML(
                `
                <Asset key=(testAsset)>
                    <Room key=(testDestination) />
                    <Room key=(testRoom)>
                        <Name>Test Room</Name>
                        <Description>Test Description</Description>
                        <Exit to=(testDestination)>out</Exit>
                    </Room>
                </Asset>
                `,
                `
                <Asset key=(testAsset) />
                `,
                {
                    type: 'spliceList',
                    componentKey: 'testRoom',
                    itemKey: 'exits',
                    at: 0,
                    replace: 1,
                    items: []
                }
            )).toEqual({
                base: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testDestination) />
                        <Room key=(testRoom)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                            <Exit to=(testDestination)>out</Exit>
                        </Room>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testDestination) />
                        <Room key=(testRoom)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                        </Room>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testDestination) />
                        <Room key=(testRoom)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                        </Room>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testRoom)>
                            <Remove><Exit to=(testDestination)>out</Exit></Remove>
                        </Room>
                    </Asset>
                `)
            })

            //
            // Test replacing an item in a list
            //
            expect(transformWML(
                `
                <Asset key=(testAsset)>
                    <Room key=(testDestination) />
                    <Room key=(testRoom)>
                        <Name>Test Room</Name>
                        <Description>Test Description</Description>
                        <Exit to=(testDestination)>out</Exit>
                    </Room>
                </Asset>
                `,
                `
                    <Asset key=(testAsset) />
                `,
                {
                    type: 'spliceList',
                    componentKey: 'testRoom',
                    itemKey: 'exits',
                    at: 0,
                    replace: 1,
                    items: [{ data: { tag: 'Exit', key: 'testRoom#testDestination', from: 'testRoom', to: 'testDestination' }, children: [{ data: { tag: 'String', value: 'depart' }, children: [] }]}]
                }
            )).toEqual({
                base: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testDestination) />
                        <Room key=(testRoom)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                            <Exit to=(testDestination)>out</Exit>
                        </Room>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testDestination) />
                        <Room key=(testRoom)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                            <Exit to=(testDestination)>depart</Exit>
                        </Room>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testDestination) />
                        <Room key=(testRoom)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                            <Exit to=(testDestination)>depart</Exit>
                        </Room>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testRoom)>
                            <Replace><Exit to=(testDestination)>out</Exit></Replace>
                            <With><Exit to=(testDestination)>depart</Exit></With>
                        </Room>
                    </Asset>
                `)
            })

        })

        it('should splice a component list with immer producer', () => {
            expect(transformWML(
                `
                <Asset key=(testAsset)>
                    <Room key=(testDestination) />
                    <Room key=(testRoom)>
                        <Name>Test Room</Name>
                        <Description>Test Description</Description>
                        <Exit to=(testDestination)>out</Exit>
                    </Room>
                </Asset>
                `,
                `
                    <Asset key=(testAsset) />
                `,
                {
                    type: 'spliceList',
                    componentKey: 'testRoom',
                    itemKey: 'exits',
                    at: 0,
                    items: [],
                    produce: (draft) => {
                        draft.filter(treeNodeTypeguard(isSchemaExit)).forEach((node) => {
                            node.children.filter(treeNodeTypeguard(isSchemaString)).forEach(({ data }) => { data.value = 'Test Update' })
                        })
                    }
                }
            )).toEqual({
                base: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testDestination) />
                        <Room key=(testRoom)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                            <Exit to=(testDestination)>out</Exit>
                        </Room>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testDestination) />
                        <Room key=(testRoom)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                            <Exit to=(testDestination)>Test Update</Exit>
                        </Room>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testDestination) />
                        <Room key=(testRoom)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                            <Exit to=(testDestination)>Test Update</Exit>
                        </Room>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testRoom)>
                            <Replace><Exit to=(testDestination)>out</Exit></Replace>
                            <With><Exit to=(testDestination)>Test Update</Exit></With>
                        </Room>
                    </Asset>
                `)
            })
        })

        it('should delete schema content', () => {
            expect(transformWML(
                `
                <Asset key=(testAsset)>
                    <Room key=(testRoom)>
                        <Name>Test Room</Name>
                        <Description>Test Description</Description>
                    </Room>
                </Asset>
                `,
                `
                <Asset key=(testAsset) />
                `,
                {
                    type: 'replaceItem',
                    componentKey: 'testRoom',
                    itemKey: 'name',
                    item: undefined
                }
            )).toEqual({
                base: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testRoom)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                        </Room>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testRoom)><Description>Test Description</Description></Room>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testRoom)><Description>Test Description</Description></Room>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testRoom)><Remove><Name>Test Room</Name></Remove></Room>
                    </Asset>
                `)
            })
        })

        it('should update a non-tree field in a standardComponent', () => {
            expect(transformWML(
                `
                <Asset key=(testAsset)><Computed key=(testComputed) src={!testVar} /></Asset>
                `,
                `
                    <Asset key=(testAsset) />
                `,
                {
                    type: 'updateField',
                    componentKey: 'testComputed',
                    itemKey: 'src',
                    value: 'testVar'
                }
            )).toEqual({
                base: deIndentWML(`
                    <Asset key=(testAsset)><Computed key=(testComputed) src={!testVar} /></Asset>
                `),
                standard: deIndentWML(`
                    <Asset key=(testAsset)><Computed key=(testComputed) src={testVar} /></Asset>
                `),
                calculated: deIndentWML(`
                    <Asset key=(testAsset)><Computed key=(testComputed) src={testVar} /></Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Replace><Computed key=(testComputed) src={!testVar} /></Replace>
                        <With><Computed key=(testComputed) src={testVar} /></With>
                    </Asset>
                `)
            })
        })

        it('should rename exit targets on rename of room', () => {
            expect(transformWML(
                `
                <Asset key=(testAsset)>
                    <Room key=(Room1)>
                        <Name>Test Room</Name>
                        <Description>Test Description</Description>
                        <Exit to=(Room2)>out</Exit>
                    </Room>
                    <Room key=(Room2)>
                        <Name>Garden</Name>
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
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                            <Exit to=(Room2)>out</Exit>
                        </Room>
                        <Room key=(Room2)>
                            <Name>Garden</Name>
                            <Exit to=(Room1)>text</Exit>
                        </Room>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(garden)>
                            <Name>Garden</Name>
                            <Exit to=(Room1)>text</Exit>
                        </Room>
                        <Room key=(Room1)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                            <Exit to=(garden)>out</Exit>
                        </Room>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(garden)>
                            <Name>Garden</Name>
                            <Exit to=(Room1)>text</Exit>
                        </Room>
                        <Room key=(Room1)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                            <Exit to=(garden)>out</Exit>
                        </Room>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(garden)>
                            <Name>Garden</Name>
                            <Exit to=(Room1)>text</Exit>
                        </Room>
                        <Room key=(Room1)>
                            <Remove><Exit to=(Room2)>out</Exit></Remove>
                            <Exit to=(garden)>out</Exit>
                        </Room>
                        <Remove>
                            <Room key=(Room2)>
                                <Name>Garden</Name>
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
                    <Room key=(Room2)><Name>Garden</Name></Room>
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
                        <Room key=(Room2)><Name>Garden</Name></Room>
                        <Map key=(testMap)><Room key=(Room2)><Position x="0" y="0" /></Room></Map>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(garden)><Name>Garden</Name></Room>
                        <Map key=(testMap)><Room key=(garden)><Position x="0" y="0" /></Room></Map>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(garden)><Name>Garden</Name></Room>
                        <Map key=(testMap)><Room key=(garden)><Position x="0" y="0" /></Room></Map>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(garden)><Name>Garden</Name></Room>
                        <Remove><Room key=(Room2)><Name>Garden</Name></Room></Remove>
                        <Map key=(testMap)>
                            <Remove><Room key=(Room2)><Position x="0" y="0" /></Room></Remove>
                            <Room key=(garden)><Position x="0" y="0" /></Room>
                        </Map>
                    </Asset>
                `)
            })
        })

        it('should rename link targets on rename of feature', () => {
            expect(transformWML(
                `
                <Asset key=(testAsset)>
                    <Feature key=(Feature1)>
                        <Name>Test Feature</Name>
                        <Description><Link to=(Feature1)>Link</Link></Description>
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
                            <Name>Test Feature</Name>
                            <Description><Link to=(Feature1)>Link</Link></Description>
                        </Feature>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Feature key=(clockTower)>
                            <Name>Test Feature</Name>
                            <Description><Link to=(clockTower)>Link</Link></Description>
                        </Feature>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Feature key=(clockTower)>
                            <Name>Test Feature</Name>
                            <Description><Link to=(clockTower)>Link</Link></Description>
                        </Feature>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Feature key=(clockTower)>
                            <Name>Test Feature</Name>
                            <Description><Link to=(clockTower)>Link</Link></Description>
                        </Feature>
                        <Remove>
                            <Feature key=(Feature1)>
                                <Name>Test Feature</Name>
                                <Description><Link to=(Feature1)>Link</Link></Description>
                            </Feature>
                        </Remove>
                    </Asset>
                `)
            })
        })        
    })
})