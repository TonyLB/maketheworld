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
import { Entries, objectMap } from '../../lib/objects'
import { Selector } from '../../store'
import { PromiseCache } from '../promiseCache'

type multipleSSMItem<Nodes extends Record<string, any>> = InferredDataTypeAggregateFromNodes<Nodes> & {
    meta: ssmMeta<keyof Nodes>
}

export type multipleSSMSlice<Nodes extends Record<string, any>> = {
    byId: Record<string, multipleSSMItem<Nodes>>
}

type multipleSSMPublicReducer<Nodes extends Record<string, any>, D> = {
    (state: Draft<InferredPublicDataTypeAggregateFromNodes<Nodes>>, action: PayloadAction<D>): void;
}

type corePublicReducerType<Nodes extends Record<string, any>, D> = {
    (state: Draft<multipleSSMSlice<Nodes>>, action: PayloadAction<D & { key: string }>): void;
}

type corePublicAction<D> = {
    (payload: D & { key: string }): void;
}

type wrappedPublicReducer<D> = {
    (key: string): (payload: D) => (dispatch: any, getState: any) => void
}

type multipleSSMPublicSelector<Nodes extends Record<string, any>, D> = {
    (state: InferredPublicDataTypeAggregateFromNodes<Nodes> & { key: string }): D;
}

type resultPublicSelector<D> = {
    (key: string): (state: any) => D | undefined
}

type multipleSSMArguments<Nodes extends Record<string, any>, PublicSelectorsType> = {
    name: string;
    initialSSMState: keyof Nodes;
    initialSSMDesired: (keyof Nodes)[];
    initialData: InferredDataTypeAggregateFromNodes<Nodes>;
    sliceSelector: (state: any) => multipleSSMSlice<Nodes>;
    publicReducers?: Record<string, multipleSSMPublicReducer<Nodes, any>>;
    publicSelectors: PublicSelectorsType;
    template: TemplateFromNodes<Nodes>;
    promiseCache: PromiseCache<InferredDataTypeAggregateFromNodes<Nodes>>
}

const corePublicReducer =
    <Nodes extends Record<string, any>, D>
        (func: multipleSSMPublicReducer<Nodes, Omit<D, "key">>): corePublicReducerType<Nodes, D> => {
        const wrapper = (state: Draft<multipleSSMSlice<Nodes>>, action: PayloadAction<D & { key: string }>) => {
            const { key, ...rest } = action.payload
            let focus = state.byId[action.payload.key]
            if (focus) {
                func(focus.publicData, { ...action, payload: rest })
            }
        }
        return wrapper
    }

const publicAction = <D>(func: corePublicAction<D>): wrappedPublicReducer<D> =>
    {
        const wrapper = (key: string) => (payload: D) => (dispatch: any, getState: any) => {
            dispatch(func({ ...payload, key }))
        }
        return wrapper
    }

const wrapPublicSelector =
    <Nodes extends Record<string, any>, D>
        (sliceSelector: (state: any) => multipleSSMSlice<Nodes>) =>
        (select: multipleSSMPublicSelector<Nodes, D>): resultPublicSelector<D> =>
    {
        const wrapper = (key: string) => (state: any): D | undefined => {
            const focus = sliceSelector(state).byId[key]
            if (focus) {
                return select({ key, ...focus.publicData })
            }
            return undefined
        }
        return wrapper
    }

//
// TODO: Type-constrain selectors in the same way as was done in singleSSM
//

//
// TODO: Extend multipleSSM to accept a promiseCache argument, and add per-type global promise caches to
// store promises by reference on each slice
//
export const multipleSSM = <Nodes extends Record<string, any>, PublicSelectorsType extends Record<string, multipleSSMPublicSelector<Nodes, any>>>({
    name,
    initialSSMState,
    initialSSMDesired,
    initialData,
    sliceSelector,
    publicReducers = {},
    publicSelectors,
    template,
    promiseCache
}: multipleSSMArguments<Nodes, PublicSelectorsType>) => {
    const slice = createSlice({
        name,
        initialState: {
            byId: {}
        } as multipleSSMSlice<Nodes>,
        reducers: {
            setIntent(state, action: PayloadAction<{ key: string; intent: (keyof Nodes)[] }>) {
                if (state.byId[action.payload.key]) {
                    state.byId[action.payload.key].meta.desiredStates = castDraft(action.payload.intent)
                }
            },
            addItem(state, action: PayloadAction<{ key: string; options?: { initialState?: keyof Nodes } }>) {
                if (!state.byId[action.payload.key]) {
                    state.byId[action.payload.key] = castDraft({
                        internalData: {
                            ...(initialData.internalData || {}),
                            id: action.payload.key
                        },
                        publicData: initialData.publicData,
                        meta: {
                            currentState: castDraft(action.payload.options?.initialState || initialSSMState),
                            desiredStates: castDraft(initialSSMDesired),
                            inProgress: null,
                            onEnterPromises: {}
                        }
                    } as unknown as multipleSSMItem<Nodes>)
                }
            },
            internalStateChange(
                state,
                action: PayloadAction<{
                    key: string;
                    newState: keyof Nodes,
                    inProgress?: keyof Nodes,
                    data: PartialDataTypeAggregateFromNodes<Nodes>
                }>
            ) {
                const keyRecord = state.byId[action.payload.key]
                if (keyRecord) {
                    keyRecord.meta.currentState = castDraft(action.payload.newState)
                    if (action.payload.inProgress !== undefined) {
                        keyRecord.meta.inProgress = castDraft(action.payload.inProgress)
                    }
                    if (action.payload.data?.internalData) {
                        keyRecord.internalData = { ...keyRecord.internalData, ...action.payload.data.internalData }
                    }
                    if (action.payload.data?.publicData) {
                        keyRecord.publicData = { ...keyRecord.publicData, ...action.payload.data.publicData }
                    }
                }
            },
            clearOnEnter(
                state,
                action: PayloadAction<{
                    key: string;
                    nodeKey: keyof Nodes
                }>
            ) {
                const keyRecord = state.byId[action.payload.key]
                if (keyRecord) {
                    keyRecord.meta.onEnterPromises[action.payload.nodeKey as any] = castDraft([])
                }
            },
            addOnEnter(
                state,
                action: PayloadAction<{
                    key: string;
                    nodeKey: keyof Nodes;
                    value: string;
                }>
            ) {
                const keyRecord = state.byId[action.payload.key]
                if (keyRecord) {
                    if (!(action.payload.nodeKey in keyRecord.meta.onEnterPromises)) {
                        keyRecord.meta.onEnterPromises[action.payload.nodeKey as any] = []
                    }
                    keyRecord.meta.onEnterPromises[action.payload.nodeKey as any] = [
                        ...keyRecord.meta.onEnterPromises[action.payload.nodeKey as any],
                        action.payload.value
                    ]
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

    //
    // TODO: See if it's possible to create a type iteration to infer the keys/types from
    // publicReducers and convey them into publicActions
    //
    const publicActions = Object.keys(publicReducers).reduce((previous, name) => ({
        ...previous,
        [name]: publicAction((slice.actions as any)[`core${name}`])
    }), {
        onEnter: (key: string) => (nodeKeys: (keyof Nodes)[]) => (dispatch, getState): Promise<InferredDataTypeAggregateFromNodes<Nodes>> => {
            const { byId } = sliceSelector(getState())
            if (!(key in byId)) {
                throw new Error(`onEnter applies to invalid key (${key})`)
            }
            const { internalData, publicData, meta: { currentState } } = byId[key]
            if (nodeKeys.includes(currentState)) {
                return Promise.resolve({ internalData, publicData })
            }
            else {
                const { promise, key: value } = promiseCache.add()
                nodeKeys.forEach((nodeKey) => {
                    dispatch(slice.actions.addOnEnter({ key, nodeKey, value }))
                })
                return promise
            }
        }
    }) as Record<string, wrappedPublicReducer<any>>

    const { internalStateChange, setIntent, clearOnEnter } = slice.actions
    const iterateAllSSMs = (dispatch: any, getState: any) => {
        const sliceData = sliceSelector(getState())
        const { byId = {} } = sliceData
        const machinesCast = Object.entries(byId) as [string, multipleSSMItem<Nodes>][]
        machinesCast
            .filter(([key, value]) => (value))
            .forEach(([key]) => {
                const getSSMData = (state: any) => {
                    const currentData = sliceSelector(state).byId[key]
                    const { currentState, desiredStates, inProgress, onEnterPromises } = currentData.meta
                    const { internalData, publicData } = currentData
                    return { currentState, desiredStates, internalData, publicData, inProgress, template, onEnterPromises }
                }
                dispatch(iterateOneSSM({
                    getSSMData,
                    internalStateChange: ({ newState, inProgress, data }: {
                            newState: keyof Nodes,
                            inProgress: keyof Nodes,
                            data: InferredDataTypeAggregateFromNodes<Nodes>
                        }) => (internalStateChange({ key, newState, inProgress, data })),
                    internalIntentChange: ({ newIntent }: {
                            newIntent: (keyof Nodes)[]
                        }) => (setIntent({ key, intent: newIntent })),
                    clearOnEnter: (nodeKey) => (clearOnEnter({ key, nodeKey })),
                    actions: {
                        ...slice.actions,
                        ...(Object.entries(publicActions)
                            .reduce((previous, [functionName, value]) => ({
                                ...previous,
                                [functionName]: value(key)
                            }), {})
                        )
                    },
                    promiseCache
                }))
            })
    }

    const getStatus = (key: string): Selector<keyof Nodes | undefined> => (state) => {
        const focus = sliceSelector(state).byId[key]
        if (focus) {
            return focus.meta.currentState
        }
        return undefined
    }

    const getIntent = (key: string): Selector<(keyof Nodes)[]> => (state) => {
        const focus = sliceSelector(state).byId[key]
        if (focus) {
            return focus.meta.desiredStates
        }
        return []
    }

    const getError = (key: string): Selector<Record<string, any>> => (state) => {
        const focus = sliceSelector(state).byId[key]
        if (focus) {
            return focus.internalData.error ?? {}
        }
        return {}
    }

    const getAll: Selector<Record<string, any>> = (state) => {
        return objectMap(sliceSelector(state).byId, ({ publicData }) => (publicData))
    }

    type SelectorAggregate = {
        [T in keyof typeof publicSelectors]: (key: string) => Selector<ReturnType<typeof publicSelectors[T]>>
    }
    const selectors: SelectorAggregate & {
        getStatus: (key: string) => Selector<keyof Nodes | undefined>;
        getIntent: (key: string) => Selector<(keyof Nodes)[]>;
        getError: (key: string) => Selector<Record<string, any>>;
        getAll: Selector<Record<string, any>>
    } = {
        ...(Object.entries(publicSelectors) as Entries<typeof publicSelectors>)
            .reduce((previous, [name, selector]) => ({
                ...previous,
                [name]: wrapPublicSelector(sliceSelector)(selector)
            }), {} as Partial<SelectorAggregate>) as SelectorAggregate,
        getStatus,
        getIntent,
        getError,
        getAll
    }

    return {
        slice,
        selectors,
        publicActions,
        iterateAllSSMs
    }
}

