//
// feedback is a slice in the UI portion of the redux store that
// maintains a FIFO queue of feedback messages from the internals
// of the system (e.g. failure to connect to the backend) to
// populate a Material UI Snackbar component.
//

import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit'

import { RootState, Selector } from '../../../store'

export interface Feedback {
    message: string;
}

const initialState = [] as Feedback[]

const feedbackSlice = createSlice({
    name: 'feedback',
    initialState,
    reducers: {
        push(state, action: PayloadAction<string>) {
            state.push({ message: action.payload })
        },
        pop(state) {
            state.shift()
        }
    }
})

export const { push, pop } = feedbackSlice.actions

export const getFeedback: Selector<Feedback[]> = (state: RootState) => (state.UI.feedback)

export const getFirstFeedback: Selector<string> = createSelector(
    getFeedback,
    (feedback) => {
        if (feedback.length) {
            return feedback[0].message
        }
        return ''
    }
)

export default feedbackSlice.reducer
