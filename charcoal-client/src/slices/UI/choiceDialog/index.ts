//
// choiceDialog supports a dispatch chain, whereby you can dispatch an action
// to raise a dialog, and chain a .then to take action depending upon the
// option the user chooses on the dialog that gets raised
//

import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit'

import { RootState, Selector, AppDispatch } from '../../../store'

interface ResolveFunction {
    (value: string): void
}

export interface ChoiceOption {
    label: string;
    returnValue: string;
}

//
// TODO: Figure out a way to produce this dispatch-chaining method without storing
// a (non-serializable) function in the Redux store ... it's not best practice, and
// it could limit debugging options going forward.
//
export interface ChoiceType {
    title: string;
    message: string;
    options: ChoiceOption[];
    resolve: ResolveFunction;
}

const initialState = [] as ChoiceType[]

const choiceDialogSlice = createSlice({
    name: 'choiceDialog',
    initialState,
    reducers: {
        push(state, action: PayloadAction<ChoiceType>) {
            state.push(action.payload)
        },
        pop(state) {
            state.shift()
        }
    }
})

export const { push, pop } = choiceDialogSlice.actions

export const getChoiceDialogs: Selector<ChoiceType[]> = (state: RootState) => (state.UI.choiceDialog)

export const getFirstChoiceDialog: Selector<ChoiceType | null> = createSelector(
    getChoiceDialogs,
    (feedback) => {
        if (feedback.length) {
            return feedback[0]
        }
        return null
    }
)

export const pushChoice = (choice: Omit<ChoiceType, "resolve">) => (dispatch: AppDispatch): Promise<string> => {
    return new Promise((resolve) => {
        dispatch(push({
            ...choice,
            resolve
        }))
    })
}

export default choiceDialogSlice.reducer
