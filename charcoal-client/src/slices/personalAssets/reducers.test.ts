import produce from "immer"
import type { PersonalAssetsPublic } from "./baseClasses"
import { updateStandard, UpdateStandardPayload, clearPendingEditsByRequestIds, clearLastUpdateDiff } from "./reducers"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { Schema, schemaToWML } from "@tonylb/mtw-wml/ts/schema"
import { deIndentWML } from "@tonylb/mtw-wml/ts/schema/utils"
import { publicSelectors } from "./selectors"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import { StandardLiteral } from "@tonylb/mtw-wml/ts/standardize/literal"
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render"
import {
    SituationRoomFacetList,
    StandardSituationRoomFacet,
} from "@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom"
import { StandardExplicitKey } from "@tonylb/mtw-wml/ts/standardize/explicit"
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
        const payloadWithBase = payload.type === 'update' || payload.type === 'updateLocal' || payload.type === 'removeComponent'
            ? { ...payload, base: standardizedJSON }
            : payload
        const newState = produce(
            {
                inherited: {
                    universalKey: standardizedJSON.universalKey,
                    components: [],
                    metaData: standardizedJSON.metaData || []
                },
                standard: standardizedJSON,
                edit: editStandardized.toJSON(),
                pendingEdits: []
            },
            (state) => { updateStandard(state as any, { type: 'updateStandard', payload: payloadWithBase }) }
        )
        const base = new StandardForm(standardizedJSON)
        const newEdit = new StandardForm(newState.edit)
        const combinedStandardizer = base.merge(newEdit)
        const newStandardized = new StandardForm(publicSelectors.getStandardForm({ ...newState, base: standardizedJSON, key: '' } as any))
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
                            <Situation uuid=(DEFAULT)>
                                <DisplayName>Test Room</DisplayName>
                                <Description>Test Description</Description>
                            </Situation>
                        </Room>
                    </Asset>
                `,
                `
                    <Asset uuid=(testAsset) />
                `,
                {
                    type: 'update',
                    update: (draft) => {
                        const room = draft.byUniversalId['ROOM#testRoom']
                        if (room instanceof StandardRoom) {
                            const facet = room.situations.items[0]
                            const newPayload = facet.payload.clone()
                            newPayload._displayName = new StandardLiteral('Test Update', { tag: 'DisplayName' })
                            const newFacet = new StandardSituationRoomFacet({
                                reference: facet.reference.toJSON(),
                                payload: newPayload.toJSON(),
                            })
                            room._payload._situations = new SituationRoomFacetList([newFacet])
                        }
                        return draft
                    }
                }
            )).toEqual({
                base: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Situation uuid=(DEFAULT) ref={0} />
                            <Situation uuid=(DEFAULT)>
                                <DisplayName>Test Room</DisplayName>
                                <Description>Test Description</Description>
                            </Situation>
                        </Room>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Situation uuid=(DEFAULT) ref={0} />
                            <Situation uuid=(DEFAULT)>
                                <DisplayName>Test Update</DisplayName>
                                <Description>Test Description</Description>
                            </Situation>
                        </Room>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Situation uuid=(DEFAULT) ref={0} />
                            <Situation uuid=(DEFAULT)>
                                <DisplayName>Test Update</DisplayName>
                                <Description>Test Description</Description>
                            </Situation>
                        </Room>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Situation uuid=(DEFAULT) ref={0} />
                        <Room uuid=(testRoom) ref={0}>
                            <Situation uuid=(DEFAULT) ref={0}>
                                <Replace><DisplayName>Room</DisplayName></Replace>
                                <With><DisplayName>Update</DisplayName></With>
                            </Situation>
                        </Room>
                    </Asset>
                `)
            })
        })

        it('should remove a component', () => {
            expect(transformWML(
                `
                <Asset uuid=(testAsset)>
                    <Room uuid=(testRoom)>
                        <Situation uuid=(DEFAULT)>
                            <DisplayName>Test Room</DisplayName>
                            <Description>Test Description</Description>
                        </Situation>
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
                            <Situation uuid=(DEFAULT) ref={0} />
                            <Situation uuid=(DEFAULT)>
                                <DisplayName>Test Room</DisplayName>
                                <Description>Test Description</Description>
                            </Situation>
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
                                <Situation uuid=(DEFAULT) ref={0} />
                                <Situation uuid=(DEFAULT)>
                                    <DisplayName>Test Room</DisplayName>
                                    <Description>Test Description</Description>
                                </Situation>
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
                        <Situation uuid=(DEFAULT)>
                            <DisplayName>Test Room</DisplayName>
                            <Description>Test Description</Description>
                        </Situation>
                    </Room>
                </Asset>
                `,
                `
                <Asset uuid=(testAsset) />
                `,
                {
                    type: 'update',
                    update: (draft) => {
                        const room = draft.byUniversalId['ROOM#testRoom']
                        if (room instanceof StandardRoom) {
                            const facet = room.situations.items[0]
                            const newPayload = facet.payload.clone()
                            newPayload._displayName = undefined
                            const newFacet = new StandardSituationRoomFacet({
                                reference: facet.reference.toJSON(),
                                payload: newPayload.toJSON(),
                            })
                            room._payload._situations = new SituationRoomFacetList([newFacet])
                        }
                        return draft
                    }
                }
            )).toEqual({
                base: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Situation uuid=(DEFAULT) ref={0} />
                            <Situation uuid=(DEFAULT)>
                                <DisplayName>Test Room</DisplayName>
                                <Description>Test Description</Description>
                            </Situation>
                        </Room>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Situation uuid=(DEFAULT) ref={0} />
                            <Situation uuid=(DEFAULT)>
                                <Description>Test Description</Description>
                            </Situation>
                        </Room>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(testRoom)>
                            <Situation uuid=(DEFAULT) ref={0} />
                            <Situation uuid=(DEFAULT)>
                                <Description>Test Description</Description>
                            </Situation>
                        </Room>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Situation uuid=(DEFAULT) ref={0} />
                        <Room uuid=(testRoom) ref={0}>
                            <Situation uuid=(DEFAULT) ref={0}>
                                <Remove><DisplayName>Test Room</DisplayName></Remove>
                            </Situation>
                        </Room>
                    </Asset>
                `)
            })
        })

        it('should rename exit targets on rename of room', () => {
            expect(transformWML(
                `
                <Asset uuid=(testAsset)>
                    <Room uuid=(Room1)>
                        <Situation uuid=(DEFAULT)>
                            <DisplayName>Test Room</DisplayName>
                            <Description>Test Description</Description>
                        </Situation>
                        <Exit to=(ROOM#Room2)>out</Exit>
                    </Room>
                    <Room uuid=(Room2)>
                        <Situation uuid=(DEFAULT)><DisplayName>Garden</DisplayName></Situation>
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
                        <Situation uuid=(DEFAULT) ref={0} />
                        <Room uuid=(Room1)>
                            <Situation uuid=(DEFAULT)>
                                <DisplayName>Test Room</DisplayName>
                                <Description>Test Description</Description>
                            </Situation>
                            <Exit to=(ROOM#Room2)>out</Exit>
                        </Room>
                        <Room uuid=(Room2)>
                            <Situation uuid=(DEFAULT)><DisplayName>Garden</DisplayName></Situation>
                            <Exit to=(ROOM#Room1)>text</Exit>
                        </Room>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Situation uuid=(DEFAULT) ref={0} />
                        <Room uuid=(Room1)>
                            <Situation uuid=(DEFAULT)>
                                <DisplayName>Test Room</DisplayName>
                                <Description>Test Description</Description>
                            </Situation>
                            <Exit to=(garden)>out</Exit>
                        </Room>
                        <Room uuid=(Room2) key=(garden)>
                            <Situation uuid=(DEFAULT)><DisplayName>Garden</DisplayName></Situation>
                            <Exit to=(ROOM#Room1)>text</Exit>
                        </Room>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Situation uuid=(DEFAULT) ref={0} />
                        <Room uuid=(Room1)>
                            <Situation uuid=(DEFAULT)>
                                <DisplayName>Test Room</DisplayName>
                                <Description>Test Description</Description>
                            </Situation>
                            <Exit to=(garden)>out</Exit>
                        </Room>
                        <Room uuid=(Room2) key=(garden)>
                            <Situation uuid=(DEFAULT)><DisplayName>Garden</DisplayName></Situation>
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
                    <Room uuid=(Room2)>
                        <Situation uuid=(DEFAULT)><DisplayName>Garden</DisplayName></Situation>
                    </Room>
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
                            <Situation uuid=(DEFAULT) ref={0} />
                            <Situation uuid=(DEFAULT)><DisplayName>Garden</DisplayName></Situation>
                        </Room>
                        <Map uuid=(testMap)><Room uuid=(Room2)><Position {0, 0} /></Room></Map>
                    </Asset>
                `),
                standard: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(Room2) key=(garden)>
                            <Situation uuid=(DEFAULT) ref={0} />
                            <Situation uuid=(DEFAULT)><DisplayName>Garden</DisplayName></Situation>
                        </Room>
                        <Map uuid=(testMap)><Room key=(garden)><Position {0, 0} /></Room></Map>
                    </Asset>
                `),
                calculated: deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(Room2) key=(garden)>
                            <Situation uuid=(DEFAULT) ref={0} />
                            <Situation uuid=(DEFAULT)><DisplayName>Garden</DisplayName></Situation>
                        </Room>
                        <Map uuid=(testMap)><Room key=(garden)><Position {0, 0} /></Room></Map>
                    </Asset>
                `),
                edit: deIndentWML(`
                    <Asset uuid=(testAsset)><Room uuid=(Room2) key=(garden) ref={0} /></Asset>
                `)
            })
        })

        // Feature/Knowledge link retarget on key rename (situation facet prose) deferred to mtw-wml:
        // "Assess reference-remap functionality and tests on Feature/Knowledge situation prose payloads"

        it('should set lastUpdateDiff when a non-empty diff is merged (type update)', () => {
            const baseWML = `<Asset uuid=(test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`
            const schema = new Schema()
            schema.loadWML(baseWML)
            const standardizedJSON = new StandardForm(schema.schema[0]).toJSON()
            const initialState = {
                inherited: { universalKey: standardizedJSON.universalKey, components: [], metaData: [] },
                edit: { universalKey: standardizedJSON.universalKey, components: [], metaData: [] },
                pendingEdits: []
            } as any
            const newState = produce(initialState, (state) => {
                updateStandard(state, {
                    type: 'updateStandard',
                    payload: {
                        type: 'update',
                        base: standardizedJSON,
                        update: (draft) => {
                            const room = draft.byUniversalId['ROOM#testRoom']
                            if (room && '_payload' in room) {
                                (room as { _payload: { _shortName?: unknown } })._payload._shortName = new StandardLiteral('Updated', { tag: 'ShortName' })
                            }
                            return draft
                        }
                    }
                })
            }) as unknown as PersonalAssetsPublic
            expect(newState.lastUpdateDiff).toBeDefined()
            expect(newState.lastUpdateDiff).toHaveProperty('universalKey')
            expect(newState.lastUpdateDiff).toHaveProperty('components')
            expect(Array.isArray(newState.lastUpdateDiff?.components)).toBe(true)
        })

        it('should not set lastUpdateDiff when payload is setInherited', () => {
            const baseWML = `<Asset uuid=(test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`
            const schema = new Schema()
            schema.loadWML(baseWML)
            const standardizedJSON = new StandardForm(schema.schema[0]).toJSON()
            const initialState = {
                inherited: { universalKey: standardizedJSON.universalKey, components: [], metaData: [] },
                edit: { universalKey: standardizedJSON.universalKey, components: [], metaData: [] },
                pendingEdits: [],
                lastUpdateDiff: undefined
            } as any
            const newState = produce(initialState, (state) => {
                updateStandard(state, {
                    type: 'updateStandard',
                    payload: {
                        type: 'setInherited',
                        inherited: { universalKey: standardizedJSON.universalKey, components: [], metaData: [] }
                    }
                })
            }) as unknown as PersonalAssetsPublic
            expect(newState.lastUpdateDiff).toBeUndefined()
        })

        it('should not emit edit diff for vacuous asset summary update', () => {
            const baseWML = `<Asset uuid=(test)><ShortName>Test Asset</ShortName></Asset>`
            const schema = new Schema()
            schema.loadWML(baseWML)
            const standardizedJSON = new StandardForm(schema.schema[0]).toJSON()
            const initialState = {
                inherited: { universalKey: standardizedJSON.universalKey, components: [], metaData: [] },
                edit: { universalKey: standardizedJSON.universalKey, components: [], metaData: [] },
                pendingEdits: [],
                lastUpdateDiff: undefined
            } as any
            const newState = produce(initialState, (state) => {
                updateStandard(state, {
                    type: 'updateStandard',
                    payload: {
                        type: 'update',
                        base: standardizedJSON,
                        update: (draft) => {
                            const incomingSummary = new StandardRender([])
                            draft._summary = incomingSummary.isEmpty() ? undefined : incomingSummary
                            return draft
                        }
                    }
                })
            }) as unknown as PersonalAssetsPublic
            expect(newState.lastUpdateDiff).toBeUndefined()
            expect(newState.edit.summary).toBeUndefined()
        })

        it('should emit edit diff for non-empty asset summary update', () => {
            const baseWML = `<Asset uuid=(test)><ShortName>Test Asset</ShortName></Asset>`
            const schema = new Schema()
            schema.loadWML(baseWML)
            const standardizedJSON = new StandardForm(schema.schema[0]).toJSON()
            const initialState = {
                inherited: { universalKey: standardizedJSON.universalKey, components: [], metaData: [] },
                edit: { universalKey: standardizedJSON.universalKey, components: [], metaData: [] },
                pendingEdits: [],
                lastUpdateDiff: undefined
            } as any
            const newState = produce(initialState, (state) => {
                updateStandard(state, {
                    type: 'updateStandard',
                    payload: {
                        type: 'update',
                        base: standardizedJSON,
                        update: (draft) => {
                            const incomingSummary = new StandardRender(['Updated summary'])
                            draft._summary = incomingSummary.isEmpty() ? undefined : incomingSummary
                            return draft
                        }
                    }
                })
            }) as unknown as PersonalAssetsPublic
            expect(newState.lastUpdateDiff).toBeDefined()
            expect(newState.edit.summary).toBeDefined()
        })
    })

    describe('clearLastUpdateDiff', () => {
        it('should set lastUpdateDiff to undefined', () => {
            const stateWithDiff = {
                edit: { universalKey: 'ASSET#test', components: [], metaData: [] },
                pendingEdits: [],
                lastUpdateDiff: {
                    universalKey: 'ASSET#test',
                    components: [{ tag: 'Room', universalKey: 'ROOM#x' }],
                    metaData: []
                }
            } as any
            const state = produce(stateWithDiff, (draft) => {
                clearLastUpdateDiff(draft, { type: 'clearLastUpdateDiff', payload: undefined })
            }) as unknown as PersonalAssetsPublic
            expect(state.lastUpdateDiff).toBeUndefined()
        })
    })

    describe('clearPendingEditsByRequestIds', () => {
        const baseState = {
            edit: { universalKey: 'ASSET#test', components: [], metaData: [] },
            pendingEdits: [
                { meta: { key: 'req-1', time: 1 }, edit: { universalKey: 'ASSET#test', components: [], metaData: [] } },
                { meta: { key: 'req-2', time: 2 }, edit: { universalKey: 'ASSET#test', components: [], metaData: [] } }
            ]
        } as any

        it('should clear pending edit when RequestIds contains meta.key', () => {
            const state = produce(baseState, (draft) => {
                clearPendingEditsByRequestIds(draft, {
                    type: 'clearPendingEditsByRequestIds',
                    payload: { assetKey: 'ASSET#test', RequestIds: ['req-1'] }
                })
            }) as unknown as PersonalAssetsPublic
            expect(state.pendingEdits).toHaveLength(1)
            expect(state.pendingEdits[0].meta.key).toBe('req-2')
        })

        it('should clear pending edit when RequestIds contains meta.key for Merge Conflict scenario', () => {
            const state = produce(baseState, (draft) => {
                clearPendingEditsByRequestIds(draft, {
                    type: 'clearPendingEditsByRequestIds',
                    payload: { assetKey: 'ASSET#test', RequestIds: ['req-2'] }
                })
            }) as unknown as PersonalAssetsPublic
            expect(state.pendingEdits).toHaveLength(1)
            expect(state.pendingEdits[0].meta.key).toBe('req-1')
        })

        it('should clear no pending edits when RequestIds is absent', () => {
            const state = produce(baseState, (draft) => {
                clearPendingEditsByRequestIds(draft, {
                    type: 'clearPendingEditsByRequestIds',
                    payload: { assetKey: 'ASSET#test', RequestIds: undefined as unknown as string[] }
                })
            }) as unknown as PersonalAssetsPublic
            expect(state.pendingEdits).toHaveLength(2)
        })

        it('should clear no pending edits when RequestIds is empty', () => {
            const state = produce(baseState, (draft) => {
                clearPendingEditsByRequestIds(draft, {
                    type: 'clearPendingEditsByRequestIds',
                    payload: { assetKey: 'ASSET#test', RequestIds: [] }
                })
            }) as unknown as PersonalAssetsPublic
            expect(state.pendingEdits).toHaveLength(2)
        })
    })
})