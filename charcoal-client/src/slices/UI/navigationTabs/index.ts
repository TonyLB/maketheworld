import { createSlice, PayloadAction, createSelector, Dispatch, createAsyncThunk } from '@reduxjs/toolkit'
import { EphemeraAssetId, EphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/baseClasses'

import { Selector } from '../../../store'
import { setIntent as activeCharacterSetIntent } from '../../activeCharacters';
import { setIntent as librarySetIntent } from '../../library';
import { heartbeat } from '../../stateSeekingMachine/ssmHeartbeat';

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
export const isNavigationTabLibrary = (value: NavigationTab): value is NavigationTabLibrary => (value.type === 'Library')
export const isNavigationTabLibraryEdit = (value: NavigationTab): value is NavigationTabLibraryEdit => (value.type === 'LibraryEdit')
export const isNavigationTabMessagePanel = (value: NavigationTab): value is NavigationTabMessagePanel => (value.type === 'MessagePanel')

export const closeTab = createAsyncThunk(
    'navigationTabs/closeTab',
    async ({ href, pathname, callback }: { href: string, pathname: string; callback: (newHref: string) => void }, thunkAPI) => {
        const { dispatch, getState } = thunkAPI
        const state: any = getState()
        const tab = navigationTabPinnedByHref(href)(state)
        const allTabs = navigationTabs(state)
        const tabIndex = navigationTabSelectedIndex(pathname)(state)
        let removeHrefs = [href]
        if (tab) {
            switch(tab.type) {
                case 'Library':
                case 'LibraryEdit':
                    const libraryStillNeeded = Boolean(allTabs.find(({ href: checkHref, type }) => ((href !== checkHref) && (['Library', 'LibraryEdit'].includes(type)))))
                    if (!libraryStillNeeded) {
                        dispatch(librarySetIntent(['INACTIVE']))
                        dispatch(heartbeat)
                    }
                    break
                case 'Map':
                    dispatch(activeCharacterSetIntent({ key: tab.characterId, intent: ['CONNECTED'] }))
                    dispatch(heartbeat)
            }
            if (tabIndex !== null) {
                console.log(`all Tabs: ${JSON.stringify(allTabs, null, 4)}`)
                console.log(`Tab Index: ${tabIndex}`)
                console.log(`removeHrefs: ${JSON.stringify(removeHrefs, null, 4)}`)
                const lastValidIndex = allTabs.slice(0, tabIndex).reduce<number>((previous, { href }, index) => {
                    if (!removeHrefs.includes(href)) {
                        return index
                    }
                    return previous
                }, -1)
                console.log(`Last Valid Index: ${lastValidIndex}`)
                if (lastValidIndex > -1) {
                    callback(allTabs[lastValidIndex].href)
                }
                else {
                    callback('/')
                }
            }

        }
    
        return removeHrefs
    }
)

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
        }
    },
    extraReducers: (builder) => {
        //
        // Remove tab from list after completion of closeTab thunk
        //
        builder.addCase(closeTab.fulfilled, (state, action) => {
            action.payload.forEach((removeHref) => {
                const matchIndex = state.findIndex(({ href }) => (href === removeHref))
                if (matchIndex !== -1) {
                    state.splice(matchIndex, 1)
                }    
            })
        })
    }
})

export const { add } = navigationSlice.actions

export const navigationTabs: Selector<NavigationTab[]> = ({ UI: { navigationTabs = [] } }) => (navigationTabs)

export const navigationTabSelected = (pathname: string): Selector<NavigationTab | null> => createSelector(
    navigationTabs,
    (navigationTabs) => {
        if (pathname === '/') {
            return null
        }
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
        console.log(`pathname: ${pathname}`)
        if (pathname === '/') {
            return null
        }
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
