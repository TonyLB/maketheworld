import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit'
import { EphemeraAssetId, EphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/baseClasses'

import { Selector } from '../../../store'

type NavigationTabBase = {
    label: string;
    href: string;
    iconName?: string;
    closable: boolean;
}

type NavigationTabGeneral = {
    type: 'CharacterEdit' | 'Notifications';
} & NavigationTabBase

type NavigationTabMap = {
    type: 'Map';
    characterId: EphemeraCharacterId;
} & NavigationTabBase

type NavigationTabMessagePanel = {
    type: 'MessagePanel';
    characterId: EphemeraCharacterId;
} & NavigationTabBase

type NavigationTabLibrary = {
    type: 'Library';
} & NavigationTabBase

type NavigationTabLibraryEdit = {
    type: 'LibraryEdit';
    assetId: EphemeraCharacterId | EphemeraAssetId;
} & NavigationTabBase

export type NavigationTab = NavigationTabGeneral |
    NavigationTabMap |
    NavigationTabMessagePanel |
    NavigationTabLibrary |
    NavigationTabLibraryEdit

export const isNavigationTabMap = (value: NavigationTab): value is NavigationTabMap => (value.type === 'Map')
export const isNavigationTabLibrary = (value: NavigationTab): value is NavigationTabMap => (value.type === 'Library')

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
