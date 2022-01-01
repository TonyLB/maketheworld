import { castDraft } from 'immer'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ssmMeta, InferredDataTypeAggregateFromNodes } from './baseClasses'

type singleSSMArguments<Nodes extends Record<string, any>> = {
    name: string;
    initialSSMState: keyof Nodes;
    initialSSMDesired: keyof Nodes;
    initialData: InferredDataTypeAggregateFromNodes<Nodes>;
}

type singleSSMSlice<K> = {
    meta: ssmMeta<K>
}

export const singleSSM = <Nodes extends Record<string, any>>({
    name,
    initialSSMState,
    initialSSMDesired,
    initialData
}: singleSSMArguments<Nodes>) => (
    createSlice({
        name,
        initialState: {
            ...initialData,
            meta: {
                currentState: initialSSMState,
                desiredState: initialSSMDesired,
                inProgress: null
            }
        } as singleSSMSlice<keyof Nodes>,
        reducers: {
            setIntent(state, action: PayloadAction<keyof Nodes>) {
                state.meta.desiredState = castDraft(action.payload)
            }
        }
    })
)