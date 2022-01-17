import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit'

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

export const navigationTabs = ({ navigationTabs = [] }: { navigationTabs: NavigationTab[] }) => (navigationTabs)

export const navigationTabSelected = (pathname: string) => ({ navigationTabs = [] }: { navigationTabs: { href: string }[]}) => {
    const matches = navigationTabs
        .filter(({ href }) => (pathname.startsWith(href)))
        .sort(({ href: hrefA = '' }, { href: hrefB = '' }) => (hrefA.length - hrefB.length))
    if (matches.length) {
        return matches[0]
    }
    else {
        return null
    }
}

export const navigationTabPinnedByHref = (hrefMatch: string) => createSelector(
    navigationTabs,
    (tabs) => (tabs.find(({ href }) => (href === hrefMatch)))
)

export default navigationSlice.reducer
