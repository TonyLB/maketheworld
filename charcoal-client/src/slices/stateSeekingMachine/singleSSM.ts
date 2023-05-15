import { castDraft, Draft } from 'immer'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ssmMeta, InferredDataTypeAggregateFromNodes, InferredPublicDataTypeAggregateFromNodes, PartialDataTypeAggregateFromNodes, TemplateFromNodes, ISSMData } from './baseClasses'
import { iterateOneSSM } from './index'
import { Entries } from '../../lib/objects'
import { Selector } from '../../store'
import { PromiseCache } from '../promiseCache'

type singleSSMSlice<Nodes extends ISSMData> = InferredDataTypeAggregateFromNodes<Nodes> & {
    meta: ssmMeta<keyof Nodes, InferredDataTypeAggregateFromNodes<Nodes>>
}

type singleSSMPublicReducer<Nodes extends Record<string, any>, D> = {
    (state: Draft<InferredPublicDataTypeAggregateFromNodes<Nodes>>, action: PayloadAction<D>): void;
}

type corePublicReducerType<Nodes extends Record<string, any>, D> = {
    (state: Draft<singleSSMSlice<Nodes>>, action: PayloadAction<D>): void;
}

type singleSSMPublicSelector<Nodes extends Record<string, any>, D> = {
    (state: InferredPublicDataTypeAggregateFromNodes<Nodes>): D;
}

type resultPublicSelector<D> = {
    (state: any): D;
}

type singleSSMArguments<Nodes extends Record<string, any>, PublicSelectorsType> = {
    name: string;
    initialSSMState: keyof Nodes;
    initialSSMDesired: (keyof Nodes)[];
    initialData: InferredDataTypeAggregateFromNodes<Nodes>;
    sliceSelector: (state: any) => singleSSMSlice<Nodes>;
    publicReducers?: Record<string, singleSSMPublicReducer<Nodes, any>>;
    publicSelectors: PublicSelectorsType;
    template: TemplateFromNodes<Nodes>;
    promiseCache: PromiseCache<InferredDataTypeAggregateFromNodes<Nodes>>
}

const corePublicReducer =
    <Nodes extends Record<string, any>, D>
        (func: singleSSMPublicReducer<Nodes, D>): corePublicReducerType<Nodes, D> => {
        const wrapper = (state: Draft<singleSSMSlice<Nodes>>, action: PayloadAction<D>) => {
            func(state.publicData, action)
        }
        return wrapper
    }

type wrappedPublicReducer<D> = {
    (payload: D): (dispatch: any, getState: any) => void
}
    
const wrapPublicSelector =
    <Nodes extends Record<string, any>, D>
        (sliceSelector: (state: any) => singleSSMSlice<Nodes>) =>
        (select: singleSSMPublicSelector<Nodes, D>): resultPublicSelector<D> =>
    {
        const wrapper = (state: any): D => {
            return select(sliceSelector(state).publicData)
        }
        return wrapper
    }

//
// TODO: Extend singleSSM to accept a promiseCache argument, and add per-type global promise caches to
// store promises by reference on each slice
//
export const singleSSM = <Nodes extends Record<string, any>, PublicSelectorsType extends Record<string, singleSSMPublicSelector<Nodes, any>>>({
    name,
    initialSSMState,
    initialSSMDesired,
    initialData,
    sliceSelector,
    publicReducers = {},
    publicSelectors,
    template,
    promiseCache
}: singleSSMArguments<Nodes, PublicSelectorsType>) => {
    const slice = createSlice({
        name,
        initialState: {
            ...initialData,
            meta: {
                currentState: initialSSMState,
                desiredStates: initialSSMDesired,
                inProgress: null,
                onEnterPromises: {}
            }
        } as singleSSMSlice<Nodes>,
        reducers: {
            setIntent(state, action: PayloadAction<(keyof Nodes)[]>) {
                state.meta.desiredStates = castDraft(action.payload)
            },
            internalStateChange(
                state,
                action: PayloadAction<{
                    newState: keyof Nodes,
                    inProgress?: keyof Nodes,
                    data: PartialDataTypeAggregateFromNodes<Nodes>
                }>
            ) {
                state.meta.currentState = castDraft(action.payload.newState)
                if (action.payload.inProgress !== undefined) {
                    state.meta.inProgress = castDraft(action.payload.inProgress)
                }
                if (action.payload.data?.internalData) {
                    state.internalData = { ...state.internalData, ...action.payload.data.internalData }
                }
                if (action.payload.data?.publicData) {
                    state.publicData = { ...state.publicData, ...action.payload.data.publicData }
                }
            },
            ...(Object.entries(publicReducers)
                .reduce(
                    (previous, [name, reducer]) => ({
                        ...previous,
                        [name]: corePublicReducer(reducer)
                    }), {})
            )
        }
    })

    const { internalStateChange, setIntent } = slice.actions
    const iterateAllSSMs = (dispatch: any, getState: any) => {
        const sliceData = sliceSelector(getState())
        const { currentState, desiredStates } = sliceData.meta
        if (!desiredStates.includes(currentState)) {
            const getSSMData = (state: any) => {
                const currentData = sliceSelector(state)
                const { currentState, desiredStates, inProgress } = currentData.meta
                const { internalData, publicData } = currentData
                return { currentState, desiredStates, internalData, publicData, inProgress, template }
            }
            dispatch(iterateOneSSM({
                getSSMData,
                internalStateChange: ({ newState, inProgress, data }: {
                        newState: keyof Nodes,
                        inProgress: keyof Nodes,
                        data: InferredDataTypeAggregateFromNodes<Nodes>
                    }) => (internalStateChange({ newState, inProgress, data })),
                internalIntentChange: ({ newIntent }: { newIntent: (keyof Nodes)[] }) => (setIntent(newIntent)),
                actions: slice.actions
            }))
        }
    }

    const getStatus = (state: any): keyof Nodes => {
        return sliceSelector(state).meta.currentState
    }

    const getIntent = (state: any): (keyof Nodes)[] => {
        return sliceSelector(state).meta.desiredStates
    }

    type SelectorAggregate = {
        [T in keyof typeof publicSelectors]: Selector<ReturnType<typeof publicSelectors[T]>>
    }
    const selectors: SelectorAggregate & {
        getStatus: Selector<keyof Nodes>;
        getIntent: Selector<(keyof Nodes)[]>;
    } = {
        ...(Object.entries(publicSelectors) as Entries<typeof publicSelectors>)
            .reduce((previous, [name, selector]) => ({
                ...previous,
                [name]: wrapPublicSelector(sliceSelector)(selector)
            }), {} as Partial<SelectorAggregate>) as SelectorAggregate,
        getStatus,
        getIntent
    }

    return {
        slice,
        publicActions: {
            ...(Object.keys(publicReducers)
                .reduce((previous, key) => ({ ...previous, [key]: ((slice.actions as any)[key]) }), {})
            )
        } as Record<string, wrappedPublicReducer<any>>,
        selectors,
        iterateAllSSMs
    }
}