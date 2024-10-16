import { createSlice, PayloadAction, createSelector, createAsyncThunk } from '@reduxjs/toolkit'
import { EphemeraAssetId, EphemeraCharacterId, EphemeraMapId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { unique } from '../../../lib/lists';

import { Selector } from '../../../store'
import { setIntent as activeCharacterSetIntent } from '../../activeCharacters';
import { setIntent as librarySetIntent } from '../../library';
import { setIntent as personalAssetSetIntent, getStatus } from '../../personalAssets'
import { heartbeat } from '../../stateSeekingMachine/ssmHeartbeat';
import { pushChoice } from '../choiceDialog';
import { addOnboardingComplete } from '../../player/index.api';

type NavigationTabBase = {
    label: string;
    href: string;
    iconName?: string;
    closable: boolean;
    cascadingClose?: boolean;
}

type NavigationTabGeneral = {
    type: 'CharacterEdit' | 'Notifications';
} & NavigationTabBase

type NavigationTabMap = {
    type: 'Map';
    characterId: EphemeraCharacterId;
} & NavigationTabBase

type NavigationTabMapEdit = {
    type: 'MapEdit';
    mapId: EphemeraMapId;
} & NavigationTabBase

type NavigationTabMessagePanel = {
    type: 'MessagePanel';
    scopedId: string;
    characterId: EphemeraCharacterId;
} & NavigationTabBase

type NavigationTabLibrary = {
    type: 'Library';
} & NavigationTabBase

type NavigationTabLibraryEdit = {
    type: 'LibraryEdit';
    assetId: EphemeraCharacterId | EphemeraAssetId;
} & NavigationTabBase

type NavigationTabComponentEdit = {
    type: 'ComponentEdit';
    assetId: EphemeraAssetId;
    componentId: string;
} & NavigationTabBase

type NavigationTabKnowledge = {
    type: 'Knowledge';
} & NavigationTabBase

export type NavigationTab = NavigationTabGeneral |
    NavigationTabMap |
    NavigationTabMapEdit |
    NavigationTabMessagePanel |
    NavigationTabLibrary |
    NavigationTabLibraryEdit |
    NavigationTabComponentEdit |
    NavigationTabKnowledge

export const isNavigationTabMap = (value: NavigationTab): value is NavigationTabMap => (value.type === 'Map')
export const isNavigationTabMapEdit = (value: NavigationTab): value is NavigationTabMapEdit => (value.type === 'MapEdit')
export const isNavigationTabLibrary = (value: NavigationTab): value is NavigationTabLibrary => (value.type === 'Library')
export const isNavigationTabLibraryEdit = (value: NavigationTab): value is NavigationTabLibraryEdit => (value.type === 'LibraryEdit')
export const isNavigationTabComponentEdit = (value: NavigationTab): value is NavigationTabLibraryEdit => (value.type === 'ComponentEdit')
export const isNavigationTabMessagePanel = (value: NavigationTab): value is NavigationTabMessagePanel => (value.type === 'MessagePanel')

export const closeTab = createAsyncThunk(
    'navigationTabs/closeTab',
    async ({ href, pathname, callback }: { href: string, pathname: string; callback: (newHref: string) => void }, thunkAPI) => {
        const { dispatch, getState } = thunkAPI
        dispatch(addOnboardingComplete(['closeTab']))
        const state: any = getState()
        const tab = navigationTabPinnedByHref(href)(state)
        const allTabs = navigationTabs(state)
        const tabIndex = navigationTabSelectedIndex(pathname)(state)
        let removeHrefs = [href]
        const libraryStillNeeded = Boolean(allTabs.find(({ href: checkHref, type }) => ((href !== checkHref) && (['Library', 'LibraryEdit'].includes(type)))))
        if (tab) {
            switch(tab.type) {
                case 'LibraryEdit':
                    const assetState = getStatus(tab.assetId)(state)
                    if (!(assetState === 'FRESH')) {
                        const dialogValue = await dispatch(pushChoice({
                            title: `Do you want to save ${tab.assetId.split('#')[1]}`,
                            message: 'There are outstanding changes in this asset.  Do you want to save?',
                            options: [
                                { label: 'Save', returnValue: 'Save' },
                                { label: `Don't Save`, returnValue: 'NoSave' },
                                { label: 'Cancel', returnValue: 'Cancel' }
                            ]
                        }))
                        if (dialogValue === 'Cancel') {
                            return []
                        }
                        if (dialogValue === 'Save') {
                            dispatch(personalAssetSetIntent({ key: tab.assetId, intent: ['NEEDSAVE'] }))
                        }
                    }
                    if (!libraryStillNeeded) {
                        dispatch(librarySetIntent(['INACTIVE']))
                        dispatch(heartbeat)
                    }
                    break
                case 'Library':
                    if (!libraryStillNeeded) {
                        dispatch(librarySetIntent(['INACTIVE']))
                        dispatch(heartbeat)
                    }
                    break
                case 'MessagePanel':
                    removeHrefs = allTabs
                        .filter((tab: NavigationTab): tab is NavigationTabMessagePanel | NavigationTabMap => (['Map', 'MessagePanel'].includes(tab.type)))
                        .filter(({ characterId }) => (characterId === tab.characterId))
                        .map(({ href }) => (href))
                    dispatch(activeCharacterSetIntent({ key: tab.characterId, intent: ['INACTIVE'] }))
                    dispatch(heartbeat)
                    break
                case 'Map':
                    dispatch(activeCharacterSetIntent({ key: tab.characterId, intent: ['CONNECTED'] }))
                    dispatch(heartbeat)
                    break                    
            }
            if (tab && tab.cascadingClose) {
                removeHrefs = unique(
                    removeHrefs,
                    allTabs.map(({ href }) => (href)).filter((hrefMatch) => (hrefMatch.startsWith(href)))
                )
            }
            if (tabIndex !== null) {
                const lastValidIndex = allTabs.slice(0, tabIndex).reduce<number>((previous, { href }, index) => {
                    if (!removeHrefs.includes(href)) {
                        return index
                    }
                    return previous
                }, -1)
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
                current.iconName = action.payload.iconName
            }
            else {
                state.push(action.payload)
            }
        },
        rename(state, action: PayloadAction<{ fromHRef: string; toHRef: string; componentId: string }>) {
            const current = state.find(({ href }) => (href === action.payload.fromHRef))
            if (current) {
                current.href = action.payload.toHRef
                if (current.type === 'ComponentEdit') {
                    current.componentId = action.payload.componentId
                }
            }
        },
        clear(state) {
            state = []
        }
    },
    extraReducers: (builder) => {
        //
        // Remove tabs from list after completion of closeTab thunk
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

export const { add, rename, clear } = navigationSlice.actions

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
