import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface ConfigurationData {
    AppBaseURL?: string;
    AnonymousAPIURI?: string;
    UserPoolId?: string;
    UserPoolClient?: string;
    WebSocketURI?: string;
    RefreshToken?: string;
    error: boolean;
}

const initialState: ConfigurationData = {
    error: false
}

const configurationSlice = createSlice({
    name: 'configuration',
    initialState,
    reducers: {
        receiveConfiguration(state, action: PayloadAction<ConfigurationData>) {
            state.AppBaseURL = action.payload.AppBaseURL
            state.AnonymousAPIURI = action.payload.AnonymousAPIURI
            state.UserPoolClient = action.payload.UserPoolClient
            state.UserPoolId = action.payload.UserPoolId
            state.WebSocketURI = action.payload.WebSocketURI
            state.RefreshToken = action.payload.RefreshToken
            state.error = action.payload.error
        },
        receiveRefreshToken(state, action: PayloadAction<string | undefined>) {
            state.RefreshToken = action.payload
        },
        receiveConfigurationError(state) {
            state.error = true
        }
    }
})

export const getConfiguration = (state: any): Omit<ConfigurationData, 'error'> => (state.configuration)
export const getConfigurationError = (state: any): boolean => (state.configuration.error)

export const loadConfiguration = async (dispatch: any) => {
    const refreshToken = window.localStorage.getItem("RefreshToken")
    const jsonContents = await fetch('/config.json')
    const configurationRaw = await jsonContents.json()
    if (!Array.isArray(configurationRaw)) {
        dispatch(receiveConfigurationError())
    }
    else {
        const configuration = (configurationRaw as any[]).reduce<Record<string, string>>((previous, item) => {
            if (typeof item === 'object') {
                if ('OutputKey' in item && 'OutputValue' in item) {
                    const { OutputKey, OutputValue } = item
                    if (typeof OutputKey === 'string' && typeof OutputValue === 'string') {
                        return {
                            ...previous,
                            [OutputKey]: OutputValue
                        }
                    }
                }
            }
            return previous
        }, {})
        if (!(configuration.UserPoolId && configuration.UserPoolClient && configuration.WebSocketURI && configuration.AnonymousApiURI)) {
            dispatch(receiveConfigurationError())
        }
        else {
            dispatch(receiveConfiguration({
                AppBaseURL: configuration.AppBaseURL,
                AnonymousAPIURI: configuration.AnonymousApiURI,
                UserPoolId: configuration.UserPoolId,
                UserPoolClient: configuration.UserPoolClient,
                WebSocketURI: configuration.WebSocketURI,
                RefreshToken: refreshToken ? refreshToken : undefined,
                error: false
            }))
        }
    }
}

export const { receiveConfiguration, receiveConfigurationError, receiveRefreshToken } = configurationSlice.actions
export default configurationSlice.reducer
