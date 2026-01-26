import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import cacheDB, { ClientSettingType } from '../../cacheDB'

interface ServerSettings {
    ChatPrompt: string;
}

interface ClientSettings {
    TextEntryLines: number;
    ShowNeighborhoodHeaders: boolean;
    AlwaysShowOnboarding: boolean;
    currentCharacterId?: EphemeraCharacterId | null;
    showCharacterSelection?: boolean; // User-initiated character selection (not persisted)
}

interface ConnectionInfo {
    sessionId: string;
    playerName: string;
}

interface SettingsData {
    server: ServerSettings;
    client: ClientSettings;
    connection: ConnectionInfo;
}

const initialState: SettingsData = {
    server: {
        ChatPrompt: 'What do you do?'
    },
    client: {
        TextEntryLines: 1,
        ShowNeighborhoodHeaders: false,
        AlwaysShowOnboarding: false,
        currentCharacterId: null
    },
    connection: {
        sessionId: '',
        playerName: ''
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
        },
        updateConnection(state, action: PayloadAction<Partial<ConnectionInfo>>) {
            state.connection = { ...state.connection, ...action.payload }
        }
    }
})

export const getServerSettings = (state: any): ServerSettings => (state.settings.server)
export const getClientSettings = (state: any): ClientSettings => (state.settings.client)
export const getConnection = (state: any): ConnectionInfo => (state.settings.connection)
export const getSessionId = (state: any): string => (state.settings.connection?.sessionId || '')
export const getPlayerName = (state: any): string => (state.settings.connection?.playerName || '')
export const getCurrentCharacterId = (state: any): EphemeraCharacterId | null | undefined => 
    (state.settings.client.currentCharacterId)
export const getShowCharacterSelection = (state: any): boolean => 
    (state.settings.client.showCharacterSelection || false)

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


export const { receiveServerSettings, receiveClientSettings, updateConnection } = settingsSlice.actions
export default settingsSlice.reducer
