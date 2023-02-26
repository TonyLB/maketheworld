import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit'

import { Selector } from '../../../store'

export interface NavigationTab {
    label: string;
    href: string;
    iconName?: string;
    closable: boolean;
}

const initialState = [] as NavigationTab[]

const navigationSlice = createSlice({
    name: 'navigationTabs',
    initialState,
    reducers: {
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
            const matchIndex = state.findIndex(({ href }) => (href === action.payload))
            if (matchIndex !== -1) {
                state.splice(matchIndex, 1)
            }
        }
    }
})

export const { add, remove } = navigationSlice.actions

export const navigationTabs: Selector<NavigationTab[]> = ({ UI: { navigationTabs = [] } }) => (navigationTabs)

//
// TODO: Change navigationTab functionality so that it handles the possibility of
// "Who is on" being one of the visible tabs (i.e., small screen)
//
export const navigationTabSelected = (pathname: string): Selector<NavigationTab | null> => createSelector(
    navigationTabs,
    (navigationTabs) => {
        const matches = navigationTabs
            .filter(({ href }) => (pathname.startsWith(href)))
            .sort(({ href: hrefA = '' }, { href: hrefB = '' }) => (hrefB.length - hrefA.length))
        if (matches.length) {
            return matches[0]
        }
        else {
            return null
        }
    }
)

export const navigationTabSelectedIndex = (pathname: string): Selector<number | null> => createSelector(
    navigationTabs,
    (navigationTabs) => {
        const matches = navigationTabs
            .reduce<number[]>((previous, { href }, index) => {
                if (pathname.startsWith(href)) {
                    return [...previous, index]
                }
                else {
                    return previous
                }
            }, [])
            .sort((indexA, indexB) => (navigationTabs[indexB].href.length - navigationTabs[indexA].href.length))
        if (matches) {
            return matches[0]
        }
        else {
            return null
        }
    }
)

export const navigationTabPinnedByHref = (hrefMatch: string): Selector<NavigationTab | undefined> => createSelector(
    navigationTabs,
    (tabs) => (tabs.find(({ href }) => (href === hrefMatch)))
)

export default navigationSlice.reducer
