import produce from "immer"
import { updateStandard, UpdateStandardPayload, clearPendingEditsByRequestIds } from "./reducers"
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
                                <DisplayName>Test Room</DisplayName>
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
                            newExample._payload._displayName = new StandardRender(['Test Update'])
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
                                <DisplayName>Test Room</DisplayName>
                                <Description>Test Description</Description>
                            </Example>
                        </Room>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Example uuid=(base)>
                                <DisplayName>Test Update</DisplayName>
                                <Description>Test Description</Description>
                            </Example>
                        </Room>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Example uuid=(base)>
                                <DisplayName>Test Update</DisplayName>
                                <Description>Test Description</Description>
                            </Example>
                        </Room>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Example uuid=(base) ref={0}>
                            <Replace><DisplayName>Room</DisplayName></Replace>
                            <With><DisplayName>Update</DisplayName></With>
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
                            <DisplayName>Test Room</DisplayName>
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
                                <DisplayName>Test Room</DisplayName>
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
                                    <DisplayName>Test Room</DisplayName>
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
                            <DisplayName>Test Room</DisplayName>
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
                            newExample._payload._displayName = undefined
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
                                <DisplayName>Test Room</DisplayName>
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
                            <Remove><DisplayName>Test Room</DisplayName></Remove>
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
                            <DisplayName>Test Room</DisplayName>
                            <Description>Test Description</Description>
                        </Example>
                        <Exit to=(ROOM#Room2)>out</Exit>
                    </Room>
                    <Room uuid=(Room2)>
                        <Example uuid=(base2)><DisplayName>Garden</DisplayName></Example>
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
                                <DisplayName>Test Room</DisplayName>
                                <Description>Test Description</Description>
                            </Example>
                            <Exit to=(ROOM#Room2)>out</Exit>
                        </Room>
                        <Room uuid=(Room2)>
                            <Example uuid=(base2)><DisplayName>Garden</DisplayName></Example>
                            <Exit to=(ROOM#Room1)>text</Exit>
                        </Room>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(Room1)>
                            <Example uuid=(base)>
                                <DisplayName>Test Room</DisplayName>
                                <Description>Test Description</Description>
                            </Example>
                            <Exit to=(garden)>out</Exit>
                        </Room>
                        <Room uuid=(Room2) key=(garden)>
                            <Example uuid=(base2)><DisplayName>Garden</DisplayName></Example>
                            <Exit to=(ROOM#Room1)>text</Exit>
                        </Room>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(Room1)>
                            <Example uuid=(base)>
                                <DisplayName>Test Room</DisplayName>
                                <Description>Test Description</Description>
                            </Example>
                            <Exit to=(garden)>out</Exit>
                        </Room>
                        <Room uuid=(Room2) key=(garden)>
                            <Example uuid=(base2)><DisplayName>Garden</DisplayName></Example>
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
                    <Room uuid=(Room2)><Example uuid=(base)><DisplayName>Garden</DisplayName></Example></Room>
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
                            <Example uuid=(base)><DisplayName>Garden</DisplayName></Example>
                        </Room>
                        <Map uuid=(testMap)><Room uuid=(Room2)><Position {0, 0} /></Room></Map>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(Room2) key=(garden)>
                            <Example uuid=(base)><DisplayName>Garden</DisplayName></Example>
                        </Room>
                        <Map uuid=(testMap)><Room key=(garden)><Position {0, 0} /></Room></Map>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(Room2) key=(garden)>
                            <Example uuid=(base)><DisplayName>Garden</DisplayName></Example>
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
                            <DisplayName>Test Feature</DisplayName>
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
                                <DisplayName>Test Feature</DisplayName>
                                <Description><Link to=(Feature1)>Link</Link></Description>
                            </Example>
                        </Feature>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Feature uuid=(Feature1) key=(clockTower)>
                            <Example uuid=(base)>
                                <DisplayName>Test Feature</DisplayName>
                                <Description><Link to=(clockTower)>Link</Link></Description>
                            </Example>
                        </Feature>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Feature uuid=(Feature1) key=(clockTower)>
                            <Example uuid=(base)>
                                <DisplayName>Test Feature</DisplayName>
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

    describe('clearPendingEditsByRequestIds', () => {
        const baseState = {
            base: { universalKey: 'ASSET#test', components: [], metaData: [] },
            edit: { universalKey: 'ASSET#test', components: [], metaData: [] },
            pendingEdits: [
                { meta: { tag: 'Meta', key: 'req-1', time: 1 }, edit: { universalKey: 'ASSET#test', components: [], metaData: [] } },
                { meta: { tag: 'Meta', key: 'req-2', time: 2 }, edit: { universalKey: 'ASSET#test', components: [], metaData: [] } }
            ]
        } as any

        it('should clear pending edit when RequestIds contains meta.key', () => {
            const state = produce(baseState, (draft) => {
                clearPendingEditsByRequestIds(draft, {
                    type: 'clearPendingEditsByRequestIds',
                    payload: { assetKey: 'ASSET#test', RequestIds: ['req-1'] }
                })
            })
            expect(state.pendingEdits).toHaveLength(1)
            expect(state.pendingEdits[0].meta.key).toBe('req-2')
        })

        it('should clear pending edit when RequestIds contains meta.key for Merge Conflict scenario', () => {
            const state = produce(baseState, (draft) => {
                clearPendingEditsByRequestIds(draft, {
                    type: 'clearPendingEditsByRequestIds',
                    payload: { assetKey: 'ASSET#test', RequestIds: ['req-2'] }
                })
            })
            expect(state.pendingEdits).toHaveLength(1)
            expect(state.pendingEdits[0].meta.key).toBe('req-1')
        })

        it('should clear no pending edits when RequestIds is absent', () => {
            const state = produce(baseState, (draft) => {
                clearPendingEditsByRequestIds(draft, {
                    type: 'clearPendingEditsByRequestIds',
                    payload: { assetKey: 'ASSET#test', RequestIds: undefined as unknown as string[] }
                })
            })
            expect(state.pendingEdits).toHaveLength(2)
        })

        it('should clear no pending edits when RequestIds is empty', () => {
            const state = produce(baseState, (draft) => {
                clearPendingEditsByRequestIds(draft, {
                    type: 'clearPendingEditsByRequestIds',
                    payload: { assetKey: 'ASSET#test', RequestIds: [] }
                })
            })
            expect(state.pendingEdits).toHaveLength(2)
        })
    })
})