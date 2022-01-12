import { castDraft, Draft } from 'immer'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ssmMeta, InferredDataTypeAggregateFromNodes, InferredPublicDataTypeAggregateFromNodes, PartialDataTypeAggregateFromNodes, TemplateFromNodes } from './baseClasses'
import { iterateOneSSM } from './index'

type singleSSMSlice<Nodes> = InferredDataTypeAggregateFromNodes<Nodes> & {
    meta: ssmMeta<keyof Nodes>
}

type singleSSMPublicReducer<Nodes extends Record<string, any>, D> = {
    (state: Draft<InferredPublicDataTypeAggregateFromNodes<Nodes>>, action: PayloadAction<D>): void;
}

type corePublicReducerType<Nodes extends Record<string, any>, D> = {
    (state: Draft<singleSSMSlice<Nodes>>, action: PayloadAction<D>): void;
}

type corePublicAction<Nodes extends Record<string, any>, D> = {
    (payload: D): void;
}

type wrappedPublicReducer<Nodes extends Record<string, any>, D> = {
    (payload: D): (dispatch: any, getState: any) => void
}

type singleSSMPublicSelector<Nodes extends Record<string, any>, D> = {
    (state: InferredPublicDataTypeAggregateFromNodes<Nodes>): D;
}

type wrappedPublicSelector<Nodes extends Record<string, any>, D> = {
    (state: singleSSMSlice<Nodes>): D;
}

type singleSSMArguments<Nodes extends Record<string, any>> = {
    name: string;
    initialSSMState: keyof Nodes;
    initialSSMDesired: keyof Nodes;
    initialData: InferredDataTypeAggregateFromNodes<Nodes>;
    sliceSelector: (state: any) => singleSSMSlice<Nodes>;
    publicReducers?: Record<string, singleSSMPublicReducer<Nodes, any>>;
    publicSelectors?: Record<string, singleSSMPublicSelector<Nodes, any>>;
    template: TemplateFromNodes<Nodes>;
}

const corePublicReducer =
    <Nodes extends Record<string, any>, D>
        (func: singleSSMPublicReducer<Nodes, D>): corePublicReducerType<Nodes, D> => {
        const wrapper = (state: Draft<singleSSMSlice<Nodes>>, action: PayloadAction<D>) => {
            func(state.publicData, action)
        }
        return wrapper
    }

const wrapPublicSelector =
    <Nodes extends Record<string, any>, D>
        (sliceSelector: (state: any) => singleSSMSlice<Nodes>) =>
        (select: singleSSMPublicSelector<Nodes, D>): wrappedPublicSelector<Nodes, D> =>
    {
        const wrapper = (state: any): D => {
            return select(sliceSelector(state).publicData)
        }
        return wrapper
    }

export const singleSSM = <Nodes extends Record<string, any>>({
    name,
    initialSSMState,
    initialSSMDesired,
    initialData,
    sliceSelector,
    publicReducers = {},
    publicSelectors = {},
    template
}: singleSSMArguments<Nodes>) => {
    const slice = createSlice({
        name,
        initialState: {
            ...initialData,
            meta: {
                currentState: initialSSMState,
                desiredState: initialSSMDesired,
                inProgress: null
            }
        } as singleSSMSlice<Nodes>,
        reducers: {
            setIntent(state, action: PayloadAction<keyof Nodes>) {
                state.meta.desiredState = castDraft(action.payload)
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

    const { internalStateChange } = slice.actions
    const iterateAllSSMs = (dispatch: any, getState: any) => {
        const sliceData = sliceSelector(getState())
        const { currentState, desiredState } = sliceData.meta
        if (desiredState !== currentState) {
            const getSSMData = (state: any) => {
                const currentData = sliceSelector(state)
                const { currentState, desiredState, inProgress } = currentData.meta
                const { internalData, publicData } = currentData
                return { currentState, desiredState, internalData, publicData, inProgress, template }
            }
            dispatch(iterateOneSSM({
                getSSMData,
                internalStateChange: ({ newState, inProgress, data }: {
                        newState: keyof Nodes,
                        inProgress: keyof Nodes,
                        data: InferredDataTypeAggregateFromNodes<Nodes>
                    }) => (internalStateChange({ newState, inProgress, data })),
                actions: slice.actions
            }))
        }
    }

    const getStatus = (state: any): keyof Nodes => {
        return sliceSelector(state).meta.currentState
    }

    const getIntent = (state: any): keyof Nodes => {
        return sliceSelector(state).meta.desiredState
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
        publicActions: {
            ...(Object.keys(publicReducers)
                .reduce((previous, key) => ({ ...previous, [key]: ((slice.actions as any)[key]) }), {})
            )
        },
        selectors,
        iterateAllSSMs
    }
}