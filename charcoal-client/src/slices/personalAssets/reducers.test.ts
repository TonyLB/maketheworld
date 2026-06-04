import produce from "immer"
import type { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import type { PersonalAssetsPublic } from "./baseClasses"
import { updateStandard, UpdateStandardPayload, clearPendingEditsByRequestIds, clearLastUpdateDiff } from "./reducers"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import type { StandardFormData } from "@tonylb/mtw-wml/ts/standardize/components/dataTypes"
import { Schema, schemaToWML } from "@tonylb/mtw-wml/ts/schema"
import { deIndentWML } from "@tonylb/mtw-wml/ts/schema/utils"
import { publicSelectors } from "./selectors"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import { applyWorkbenchFlush } from "../../components/Workbench/foundations/consistency/applyWorkbenchFlush"
import { isReferencedInAssetLayer } from "../../components/Workbench/foundations/consistency/isReferencedInAssetLayer"
import { findOrphanComponents } from "../../components/Workbench/foundations/consistency/normalizeWorkbenchDraft"
import { setWorkingShortNameFromString } from "../../components/Workbench/foundations/workbenchMutations"
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
                        <Room uuid=(testRoom) ref={0}>
                            <Situation uuid=(DEFAULT) ref={0}>
                                <Replace><DisplayName>Room</DisplayName></Replace>
                                <With><DisplayName>Update</DisplayName></With>
                            </Situation>
                        </Room>
                        <Situation uuid=(DEFAULT) ref={0} />
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
                        <Room uuid=(testRoom) ref={0}>
                            <Situation uuid=(DEFAULT) ref={0}>
                                <Remove><DisplayName>Test Room</DisplayName></Remove>
                            </Situation>
                        </Room>
                        <Situation uuid=(DEFAULT) ref={0} />
                    </Asset>
                `)
            })
        })

        //
        // Local key assignment via updateStandard: edit stores minimal Key delta; standard/calculated
        // WML resolves universal refs to local keys via StandardForm.schema mappings (not stored retarget).
        // Merge-time retarget is covered in mtw-wml standardForm.keyChangesViaMerge.test.ts.
        //
        describe('local key assignment', () => {
        it('should record only Key change in edit when room gains local key (exit display resolves via schema)', () => {
            const result = transformWML(
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
            )
            expect(result.edit).toEqual(deIndentWML(`
                <Asset uuid=(testAsset)><Room uuid=(Room2) key=(garden) ref={0} /></Asset>
            `))
            expect(result.standard).toEqual(deIndentWML(`
                <Asset uuid=(testAsset)>
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
                    <Situation uuid=(DEFAULT) ref={0} />
                </Asset>
            `))
            expect(result.calculated).toEqual(result.standard)
        })

        it('should record only Key change in edit when room gains local key (map display resolves via schema)', () => {
            const result = transformWML(
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
            )
            expect(result.edit).toEqual(deIndentWML(`
                <Asset uuid=(testAsset)><Room uuid=(Room2) key=(garden) ref={0} /></Asset>
            `))
            expect(result.standard).toEqual(deIndentWML(`
                <Asset uuid=(testAsset)>
                    <Room uuid=(Room2) key=(garden)>
                        <Situation uuid=(DEFAULT) ref={0} />
                        <Situation uuid=(DEFAULT)><DisplayName>Garden</DisplayName></Situation>
                    </Room>
                    <Map uuid=(testMap)><Room key=(garden)><Position {0, 0} /></Room></Map>
                </Asset>
            `))
            expect(result.calculated).toEqual(result.standard)
        })
        })

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

        describe('removeComponent cascade', () => {
            const roomWithNestedFeatureWml = `
                <Asset uuid=(testAsset)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1)>
                            <Situation uuid=(example1) key=(example1) />
                        </Feature>
                    </Room>
                </Asset>
            `

            it('rehomes implicit descendants when cascade is false', () => {
                const result = transformWML(
                    roomWithNestedFeatureWml,
                    `<Asset uuid=(testAsset) />`,
                    {
                        type: 'removeComponent',
                        componentKey: 'ROOM#room1',
                        cascade: false
                    }
                )
                expect(result.calculated).toEqual(deIndentWML(`
                    <Asset uuid=(testAsset)>
                        <Feature uuid=(feature1) key=(feature1) ref={0}>
                            <Situation key=(example1) />
                        </Feature>
                    </Asset>
                `))
            })

            it('removes implicit descendants when cascade is true (default)', () => {
                const result = transformWML(
                    roomWithNestedFeatureWml,
                    `<Asset uuid=(testAsset) />`,
                    {
                        type: 'removeComponent',
                        componentKey: 'ROOM#room1',
                        cascade: true
                    }
                )
                expect(result.calculated).toEqual(deIndentWML(`
                    <Asset uuid=(testAsset) />
                `))
            })
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

    const wmlToJSON = (wml: string): StandardFormData => {
        const schema = new Schema()
        schema.loadWML(deIndentWML(wml))
        return new StandardForm(schema.schema[0]).toJSON()
    }

    const minimalPersonalAssetsState = (
        partial: Pick<PersonalAssetsPublic, 'inherited' | 'edit'> & {
            pendingEdits?: PersonalAssetsPublic['pendingEdits']
        }
    ): PersonalAssetsPublic => ({
        importData: {},
        properties: {},
        loadedImages: {},
        pendingEdits: partial.pendingEdits ?? [],
        inherited: partial.inherited,
        edit: partial.edit
    })

    const runUpdateLocalWithLayers = (
        baseWml: string,
        inheritedWml: string,
        editWml: string,
        payload: UpdateStandardPayload
    ): PersonalAssetsPublic => {
        const baseJSON = wmlToJSON(baseWml)
        const inheritedJSON = wmlToJSON(inheritedWml)
        const editJSON = wmlToJSON(editWml)
        const payloadWithBase =
            payload.type === 'update' ||
            payload.type === 'updateLocal' ||
            payload.type === 'removeComponent'
                ? { ...payload, base: baseJSON }
                : payload
        return produce(
            minimalPersonalAssetsState({
                inherited: inheritedJSON,
                edit: editJSON
            }),
            (state) => {
                updateStandard(state, {
                    type: 'updateStandard',
                    payload: payloadWithBase
                })
            }
        )
    }

    const mergedRoomShortName = (
        state: PersonalAssetsPublic,
        base: StandardFormData,
        roomId: ComponentUUID
    ): string | undefined => {
        const merged = new StandardForm(
            publicSelectors.getStandardForm({ ...state, base, key: '' } as PersonalAssetsPublic & { base: StandardFormData; key: string })
        )
        const room = merged.byUniversalId[roomId]
        if (!(room instanceof StandardRoom)) {
            return undefined
        }
        const shortNameJson = room.shortName?.toJSON()
        return typeof shortNameJson === 'string' ? shortNameJson : undefined
    }

    const augmentedState = (
        state: PersonalAssetsPublic,
        base: StandardFormData
    ): PersonalAssetsPublic & { base: StandardFormData; key: string } => ({
        ...state,
        base,
        key: ''
    })

    /** Console diagnostics for Phase 0 flush characterization (visible when test runs). */
    const logPhase0FlushDiagnostics = (
        label: string,
        state: PersonalAssetsPublic,
        base: StandardFormData,
        roomId: ComponentUUID
    ): void => {
        const tag = `[Phase 0 flush] ${label}`
        const formFromData = (data: StandardFormData) => new StandardForm(data)
        const roomShortNameLine = (form: StandardForm): string => {
            const room = form.byUniversalId[roomId]
            if (!(room instanceof StandardRoom)) {
                return `${tag} room ${roomId}: (missing or not StandardRoom)`
            }
            return `${tag} room ${roomId} shortName JSON: ${JSON.stringify(room.shortName?.toJSON())}`
        }
        console.log(`\n${tag}`)
        console.log(`${tag} --- edit slice ---`)
        console.log(schemaToWML([formFromData(state.edit).schema]))
        console.log(roomShortNameLine(formFromData(state.edit)))
        console.log(`${tag} --- getLocalStandardForm (base + edit) ---`)
        const local = formFromData(publicSelectors.getLocalStandardForm(augmentedState(state, base)))
        console.log(schemaToWML([local.schema]))
        console.log(roomShortNameLine(local))
        console.log(`${tag} --- getStandardForm (inherited + local) ---`)
        const merged = formFromData(publicSelectors.getStandardForm(augmentedState(state, base)))
        console.log(schemaToWML([merged.schema]))
        console.log(roomShortNameLine(merged))
        if (state.lastUpdateDiff) {
            console.log(`${tag} --- lastUpdateDiff ---`)
            console.log(schemaToWML([formFromData(state.lastUpdateDiff).schema]))
            console.log(roomShortNameLine(formFromData(state.lastUpdateDiff)))
        }
    }

    const logPhase0LocalDraft = (label: string, draft: StandardForm, roomId: ComponentUUID): void => {
        const tag = `[Phase 0 flush] ${label}`
        console.log(`\n${tag}`)
        try {
            console.log(schemaToWML([draft.schema]))
        } catch (error) {
            console.log(`${tag} schemaToWML failed:`, (error as Error).message)
        }
        const room = draft.byUniversalId[roomId]
        if (room instanceof StandardRoom) {
            console.log(`${tag} room shortName JSON:`, JSON.stringify(room.shortName?.toJSON()))
        } else {
            console.log(`${tag} room ${roomId}: (missing or not StandardRoom)`)
        }
        const roomRef = room?.reference
        if (roomRef) {
            console.log(`${tag} isReferencedInAssetLayer:`, isReferencedInAssetLayer(draft, roomRef))
        } else {
            console.log(`${tag} isReferencedInAssetLayer: (no room reference)`)
        }
        console.log(
            `${tag} _topLevel:`,
            JSON.stringify(draft._topLevel?.payload.map((r) => r.toJSON()) ?? [])
        )
        console.log(
            `${tag} findOrphanComponents:`,
            findOrphanComponents(draft).map((c) => c.universalKey)
        )
    }

    describe('inherited shortName and updateLocal flush (Phase 0)', () => {
        const ROOM_ID = 'ROOM#lobby' as ComponentUUID
        const inheritedWml = `
            <Asset uuid=(assetC)>
                <Room uuid=(lobby) key=(lobby)><ShortName>Lobby</ShortName></Room>
            </Asset>
        `
        const baseWml = `
            <Asset uuid=(assetC)>
                <Room uuid=(lobby) from=(ASSET#assetA) ref={0} />
            </Asset>
        `
        const editWml = `
            <Asset uuid=(assetC)>
                <Room uuid=(lobby) ref={0}>
                    <ShortName><Space />in the dark</ShortName>
                </Room>
            </Asset>
        `

        const buildPhase0Working = (baseJSON: StandardFormData, preFlushState: PersonalAssetsPublic) => {
            const mergedForm = new StandardForm(
                publicSelectors.getStandardForm(augmentedState(preFlushState, baseJSON))
            )
            const roomInMerged = mergedForm.byUniversalId[ROOM_ID]
            expect(roomInMerged).toBeInstanceOf(StandardRoom)
            const working = (roomInMerged as StandardRoom).clone()
            setWorkingShortNameFromString(working, 'Lobby in the pitch-black')
            return working
        }

        const localRoomShortName = (
            state: PersonalAssetsPublic,
            base: StandardFormData,
            roomId: ComponentUUID
        ): string | undefined => {
            const local = new StandardForm(
                publicSelectors.getLocalStandardForm({ ...state, base, key: '' } as PersonalAssetsPublic & { base: StandardFormData; key: string })
            )
            const room = local.byUniversalId[roomId]
            if (!(room instanceof StandardRoom)) {
                return undefined
            }
            const shortNameJson = room.shortName?.toJSON()
            return typeof shortNameJson === 'string' ? shortNameJson : undefined
        }

        it('retains local room body after applyWorkbenchFlush (Phase 2b)', () => {
            const baseJSON = wmlToJSON(baseWml)
            const preFlushState = minimalPersonalAssetsState({
                inherited: wmlToJSON(inheritedWml),
                edit: wmlToJSON(editWml)
            })
            expect(mergedRoomShortName(preFlushState, baseJSON, ROOM_ID)).toBe('Lobby in the dark')

            const working = buildPhase0Working(baseJSON, preFlushState)

            const postFlushState = runUpdateLocalWithLayers(baseWml, inheritedWml, editWml, {
                type: 'updateLocal',
                update: (draft) => {
                    logPhase0LocalDraft('local draft BEFORE flush', draft, ROOM_ID)
                    applyWorkbenchFlush(draft, { componentId: ROOM_ID, working })
                    logPhase0LocalDraft('local draft AFTER applyWorkbenchFlush', draft, ROOM_ID)
                    return draft
                }
            })

            expect(localRoomShortName(postFlushState, baseJSON, ROOM_ID)).toBe('Lobby in the pitch-black')
        })

        it.skip('merged shortName after updateLocal flush does not double inherited Lobby prefix (Phase 3 gate)', () => {
            const baseJSON = wmlToJSON(baseWml)
            const preFlushState = minimalPersonalAssetsState({
                inherited: wmlToJSON(inheritedWml),
                edit: wmlToJSON(editWml)
            })
            expect(mergedRoomShortName(preFlushState, baseJSON, ROOM_ID)).toBe('Lobby in the dark')
            logPhase0FlushDiagnostics('preFlushState', preFlushState, baseJSON, ROOM_ID)

            const working = buildPhase0Working(baseJSON, preFlushState)
            console.log(
                '[Phase 0 flush] session working shortName JSON:',
                JSON.stringify(working.shortName?.toJSON())
            )

            const postFlushState = runUpdateLocalWithLayers(baseWml, inheritedWml, editWml, {
                type: 'updateLocal',
                update: (draft) => {
                    applyWorkbenchFlush(draft, { componentId: ROOM_ID, working })
                    return draft
                }
            })

            logPhase0FlushDiagnostics('postFlushState', postFlushState, baseJSON, ROOM_ID)

            expect(mergedRoomShortName(postFlushState, baseJSON, ROOM_ID)).toBe('Lobby in the pitch-black')
        })
    })
})