import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { navigationTabPinnedByHref } from '../../selectors/navigationTabs'

export interface NavigationTab {
    label: string;
    href: string;
}

const initialState = [] as NavigationTab[]

const navigationSlice = createSlice({
    name: 'navigationTabs',
    initialState,
    reducers: {
        //
        // TODO:  Check before pushing that you will not generate duplicate tabs
        //
        // TODO:  Create changeable sequencing for tabs
        //
        add(state, action: PayloadAction<NavigationTab>) {
            const current = state.find(({ href }) => (href === action.payload.href))
            if (current) {
                current.label = action.payload.label
            }
            else {
                state.push(action.payload)
            }
        },
        remove(state, action: PayloadAction<string>) {
            state = state.filter(({ href }) => (href !== action.payload))
        }
    }
})

export const { add, remove } = navigationSlice.actions
export default navigationSlice.reducer
