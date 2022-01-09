import { castDraft, Draft } from 'immer'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import {
    ssmMeta,
    InferredDataTypeAggregateFromNodes,
    InferredPublicDataTypeAggregateFromNodes,
    TemplateFromNodes,
    PartialDataTypeAggregateFromNodes
} from './baseClasses'
import { iterateOneSSM } from './index'

type multipleSSMItem<Nodes extends Record<string, any>> = InferredDataTypeAggregateFromNodes<Nodes> & {
    meta: ssmMeta<keyof Nodes>
}

type multipleSSMSlice<Nodes extends Record<string, any>> = {
    byId: Record<string, multipleSSMItem<Nodes>>
}

type multipleSSMPublicReducer<Nodes extends Record<string, any>, D> = {
    (state: Draft<InferredPublicDataTypeAggregateFromNodes<Nodes>>, action: PayloadAction<D>): void;
}

type corePublicReducer<Nodes extends Record<string, any>, D> = {
    (state: Draft<multipleSSMSlice<Nodes>>, action: PayloadAction<D & { key: string }>): void;
}

type corePublicAction<Nodes extends Record<string, any>, D> = {
    (payload: D & { key: string }): void;
}

type wrappedPublicReducer<Nodes extends Record<string, any>, D> = {
    (key: string): (payload: D) => (dispatch: any, getState: any) => void
}

type multipleSSMPublicSelector<Nodes extends Record<string, any>, D> = {
    (state: InferredPublicDataTypeAggregateFromNodes<Nodes>): D;
}

type wrappedPublicSelector<Nodes extends Record<string, any>, D> = {
    (key: string): (state: multipleSSMSlice<Nodes>) => D | undefined;
}

type multipleSSMArguments<Nodes extends Record<string, any>> = {
    name: string;
    initialSSMState: keyof Nodes;
    initialSSMDesired: keyof Nodes;
    initialData: InferredDataTypeAggregateFromNodes<Nodes>;
    sliceSelector: (state: any) => multipleSSMSlice<Nodes>;
    publicReducers?: Record<string, multipleSSMPublicReducer<Nodes, any>>;
    publicSelectors?: Record<string, multipleSSMPublicSelector<Nodes, any>>;
    template: TemplateFromNodes<Nodes>;
}

const corePublicReducer =
    <Nodes extends Record<string, any>, D>
        (func: multipleSSMPublicReducer<Nodes, Omit<D, "key">>): corePublicReducer<Nodes, D> => {
        const wrapper = (state: Draft<multipleSSMSlice<Nodes>>, action: PayloadAction<D & { key: string }>) => {
            const { key, ...rest } = action.payload
            let focus = state.byId[action.payload.key]
            if (focus) {
                func(focus.publicData, { ...action, payload: rest })
            }
        }
        return wrapper
    }

const publicAction =
    <Nodes extends Record<string, any>, D>
        (func: corePublicAction<Nodes, D>): wrappedPublicReducer<Nodes, D> =>
    {
        const wrapper = (key: string) => (payload: D) => (dispatch: any, getState: any) => {
            dispatch(func({ ...payload, key }))
        }
        return wrapper
    }

const wrapPublicSelector =
    <Nodes extends Record<string, any>, D>
        (sliceSelector: (state: any) => multipleSSMSlice<Nodes>) =>
        (select: multipleSSMPublicSelector<Nodes, D>): wrappedPublicSelector<Nodes, D> =>
    {
        const wrapper = (key: string) => (state: any): D | undefined => {
            const focus = sliceSelector(state).byId[key]
            if (focus) {
                return select(focus.publicData)
            }
            return undefined
        }
        return wrapper
    }

export const multipleSSM = <Nodes extends Record<string, any>>({
    name,
    initialSSMState,
    initialSSMDesired,
    initialData,
    sliceSelector,
    publicReducers = {},
    publicSelectors = {},
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
                            inProgress: null
                        }
                    } as unknown as multipleSSMItem<Nodes>)
                }
            },
            internalStateChange(
                state,
                action: PayloadAction<{
                    key: string;
                    newState: keyof Nodes,
                    data: PartialDataTypeAggregateFromNodes<Nodes>
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
            },
            ...(Object.entries(publicReducers)
                .reduce(
                    (previous, [name, reducer]) => ({
                        ...previous,
                        [`core${name}`]: corePublicReducer(reducer)
                    }), {})
            )
        }
    })

    const publicActions = Object.keys(publicReducers).reduce((previous, name) => ({
        ...previous,
        [name]: publicAction((slice.actions as any)[`core${name}`])
    }), {}) as Record<string, wrappedPublicReducer<Nodes, any>>

    const { internalStateChange } = slice.actions
    const iterateAllSSMs = (dispatch: any, getState: any) => {
        const sliceData = sliceSelector(getState())
        const { byId = {} } = sliceData
        const machinesCast = Object.entries(byId) as [string, multipleSSMItem<Nodes>][]
        console.log(`Iterating over: ${JSON.stringify(machinesCast, null, 4)}`)
        machinesCast
            .filter(([key, value]) => (value))
            .filter(([key, { meta: { currentState, desiredState } }]) => (desiredState !== currentState))
            .forEach(([key]) => {
                const getSSMData = (state: any) => {
                    const currentData = sliceSelector(state).byId[key]
                    const { currentState, desiredState, inProgress } = currentData.meta
                    const { internalData, publicData } = currentData
                    return { currentState, desiredState, internalData, publicData, inProgress, template }
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

    const getStatus = (key: string) => (state: any): keyof Nodes | undefined  => {
        const focus = sliceSelector(state).byId[key]
        if (focus) {
            return focus.meta.currentState
        }
        return undefined
    }

    const getIntent = (key: string) => (state: any): keyof Nodes | undefined  => {
        const focus = sliceSelector(state).byId[key]
        if (focus) {
            return focus.meta.desiredState
        }
        return undefined
    }

    const selectors: Record<string, wrappedPublicSelector<Nodes, any>> = {
        ...Object.entries(publicSelectors)
        .reduce((previous, [name, selector]) => ({
            ...previous,
            [name]: wrapPublicSelector(sliceSelector)(selector)
        }), {}),
        getStatus,
        getIntent
    }

    return {
        slice,
        selectors,
        publicActions,
        iterateAllSSMs
    }
}

