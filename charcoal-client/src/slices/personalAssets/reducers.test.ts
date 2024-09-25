import produce from "immer"
import { updateStandard, UpdateStandardPayload } from "./reducers"
import { Standardizer } from "@tonylb/mtw-wml/dist/standardize"
import { GenericTree, treeNodeTypeguard } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { isSchemaExit, isSchemaString, SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { StandardForm } from "@tonylb/mtw-wml/dist/standardize/baseClasses"
import { Schema, schemaToWML } from "@tonylb/mtw-wml/dist/schema"
import { deIndentWML } from "@tonylb/mtw-wml/dist/schema/utils"

describe('personalAsset slice reducers', () => {

    const transformWML = (wml: string, editWML: string, payload: UpdateStandardPayload): { standard: string, edit: string } => {
        const schema = new Schema()
        schema.loadWML(wml)
        const standardizer = new Standardizer(schema.schema)
        const editSchema = new Schema()
        editSchema.loadWML(editWML)
        const editStandardizer = new Standardizer(editSchema.schema)
        const newState = produce(
            {
                standard: standardizer.standardForm,
                edit: editStandardizer.standardForm,
                inherited: { key: 'testAsset', tag: 'Asset', byId: {}, metaData: [] }
            },
            (state) => { updateStandard(state as any, { type: 'updateStandard', payload }) }
        )
        standardizer.loadStandardForm(newState.standard)
        editStandardizer.loadStandardForm(newState.edit)
        return {
            standard: schemaToWML(standardizer.schema),
            edit: schemaToWML(editStandardizer.schema)
        }
    }

    const schemaFromStandard = (standardForm: StandardForm): GenericTree<SchemaTag> => {
        const standardizer = new Standardizer()
        standardizer.loadStandardForm(standardForm)
        return standardizer.schema
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
                standard: deIndentWML(`
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
                standard: deIndentWML(`
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
                standard: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(testRoom)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                        </Room>
                        <Variable key=(Variable1) default={false} />
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset)><Variable key=(Variable1) default={false} /></Asset>
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
                standard: deIndentWML(`
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
                standard: deIndentWML(`
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
                standard: deIndentWML(`
                    <Asset key=(testAsset)><Computed key=(testComputed) src={testVar} /></Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset) />
                `)
            })
        })

        it('should replace metaData', () => {
            expect(transformWML(
                `
                <Character key=(testCharacter)><Import from=(testImport) /></Character>
                `,
                `
                    <Character key=(testCharacter) />
                `,
                {
                    type: 'replaceMetaData',
                    metaData: [{
                        data: { tag: 'Import', from: 'differentImport', mapping: {} },
                        children: []
                    }]
                }
            )).toEqual({
                standard: deIndentWML(`
                    <Character key=(testCharacter)><Import from=(differentImport) /></Character>
                `),
                edit: deIndentWML(`
                    <Character key=(testCharacter)>
                        <Remove><Import from=(testImport) /></Remove>
                        <Import from=(differentImport) />
                    </Character>
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
                standard: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(Room1)>
                            <Name>Test Room</Name>
                            <Description>Test Description</Description>
                            <Exit to=(garden)>out</Exit>
                        </Room>
                        <Room key=(garden)>
                            <Name>Garden</Name>
                            <Exit to=(Room1)>text</Exit>
                        </Room>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(Room1)>
                            <Remove><Exit to=(Room2)>out</Exit></Remove>
                            <Exit to=(garden)>out</Exit>
                        </Room>
                        <Room key=(garden)>
                            <Name>Garden</Name>
                            <Exit to=(Room1)>text</Exit>
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
                standard: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Room key=(garden)><Name>Garden</Name></Room>
                        <Map key=(testMap)><Room key=(garden)><Position x="0" y="0" /></Room></Map>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset key=(testAsset)>
                        <Remove><Room key=(Room2)><Name>Garden</Name></Room></Remove>
                        <Room key=(garden)><Name>Garden</Name></Room>
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
                standard: deIndentWML(`
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