import { castDraft } from 'immer'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ssmMeta, InferredDataTypeAggregateFromNodes, TemplateFromNodes } from './baseClasses'
import { ssmHeartbeat, iterateOneSSM } from './index'

type multipleSSMItem<Nodes extends Record<string, any>> = InferredDataTypeAggregateFromNodes<Nodes> & {
    meta: ssmMeta<keyof Nodes>
}

type multipleSSMSlice<Nodes extends Record<string, any>> = {
    byId: Record<string, multipleSSMItem<Nodes>>
}

type multipleSSMArguments<Nodes extends Record<string, any>> = {
    name: string;
    initialSSMState: keyof Nodes;
    initialSSMDesired: keyof Nodes;
    initialData: InferredDataTypeAggregateFromNodes<Nodes>;
    sliceSelector: (state: any) => multipleSSMSlice<Nodes>;
    template: TemplateFromNodes<Nodes>;
}

export const multipleSSM = <Nodes extends Record<string, any>>({
    name,
    initialSSMState,
    initialSSMDesired,
    initialData,
    sliceSelector,
    template
}: multipleSSMArguments<Nodes>) => {
    const slice = createSlice({
        name,
        initialState: {
            byId: {}
        } as multipleSSMSlice<Nodes>,
        reducers: {
            setIntent(state, action: PayloadAction<{ key: string; intent: keyof Nodes }>) {
                if (state.byId[action.payload.key]) {
                    state.byId[action.payload.key].meta.desiredState = castDraft(action.payload.intent)
                }
            },
            addItem(state, action: PayloadAction<string>) {
                if (!state.byId[action.payload]) {
                    state.byId[action.payload] = castDraft({
                        internalData: {
                            ...initialData.internalData || {},
                            id: action.payload
                        },
                        publicData: initialData.publicData,
                        meta: {
                            currentState: castDraft(initialSSMState),
                            desiredState: castDraft(initialSSMDesired),
                        }
                    } as unknown as multipleSSMItem<Nodes>)
                }
            },
            internalStateChange(
                state,
                action: PayloadAction<{
                    key: string;
                    newState: keyof Nodes,
                    data: InferredDataTypeAggregateFromNodes<Nodes>
                }>
            ) {
                const keyRecord = state.byId[action.payload.key]
                if (keyRecord) {
                    keyRecord.meta.currentState = castDraft(action.payload.newState)
                    if (action.payload.data?.internalData) {
                        keyRecord.internalData = { ...keyRecord.internalData, ...action.payload.data.internalData }
                    }
                    if (action.payload.data?.publicData) {
                        keyRecord.publicData = { ...keyRecord.publicData, ...action.payload.data.publicData }
                    }
                }
            }
        }
    })

    const { internalStateChange } = slice.actions
    const iterateAllSSMs = (dispatch: any, getState: any) => {
        const sliceData = sliceSelector(getState())
        const { byId = {} } = sliceData
        const machinesCast = Object.entries(byId) as [string, multipleSSMItem<Nodes>][]
        machinesCast
            .filter(([key, value]) => (value))
            .filter(([key, { meta: { currentState, desiredState } }]) => (desiredState !== currentState))
            .forEach(([key]) => {
                const getSSMData = (state: any) => {
                    const currentData = sliceSelector(state).byId[key]
                    const { currentState, desiredState } = currentData.meta
                    const { internalData, publicData } = currentData
                    return { currentState, desiredState, internalData, publicData, template }
                }
                dispatch(iterateOneSSM({
                    getSSMData,
                    internalStateChange: ({ newState, data }: {
                            newState: keyof Nodes,
                            data: InferredDataTypeAggregateFromNodes<Nodes>
                        }) => (internalStateChange({ key, newState, data }))
                }))
            })
    }

    return {
        slice,
        iterateAllSSMs
    }
}

