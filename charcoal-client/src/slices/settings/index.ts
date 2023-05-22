import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import cacheDB, { ClientSettingType } from '../../cacheDB'

interface ServerSettings {
    ChatPrompt: string;
}

interface ClientSettings {
    TextEntryLines: number;
    ShowNeighborhoodHeaders: boolean;
    AlwaysShowOnboarding: boolean;
}

interface SettingsData {
    server: ServerSettings;
    client: ClientSettings;
}

const initialState: SettingsData = {
    server: {
        ChatPrompt: 'What do you do?'
    },
    client: {
        TextEntryLines: 1,
        ShowNeighborhoodHeaders: false,
        AlwaysShowOnboarding: false
    }
}

const settingsSlice = createSlice({
    name: 'settings',
    initialState,
    reducers: {
        receiveServerSettings(state, action: PayloadAction<ServerSettings>) {
            state.server = action.payload
        },
        receiveClientSettings(state, action: PayloadAction<Partial<ClientSettings>>) {
            state.client = { ...state.client, ...action.payload }
        }
    }
})

export const getServerSettings = (state: any): ServerSettings => (state.settings.server)
export const getClientSettings = (state: any): ClientSettings => (state.settings.client)

export const loadClientSettings = (dispatch: any) => {
    cacheDB.clientSettings.toArray()
        .then((settings) => (settings.filter(({ key }) => (key !== 'LastSync')).reduce((previous, { key, value }) => ({ ...previous, [key]: value }), {})))
        .then((settingMap) => {
            dispatch(receiveClientSettings(settingMap))
        })
}

export const putClientSettings = (settings: Partial<ClientSettings>) => (dispatch: any) => {
    cacheDB.clientSettings.bulkPut(Object.entries(settings).map(([key, value]) => ({ key, value } as ClientSettingType)))
        .then(() => {
            dispatch(receiveClientSettings(settings))
        })
}


export const { receiveServerSettings, receiveClientSettings } = settingsSlice.actions
export default settingsSlice.reducer
