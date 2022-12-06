import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { stringify } from 'uuid';

interface ConfigurationData {
    UserPoolId?: string;
    UserPoolClient?: string;
    WebSocketURI?: string;
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
            state.UserPoolClient = action.payload.UserPoolClient
            state.UserPoolId = action.payload.UserPoolId
            state.WebSocketURI = action.payload.WebSocketURI
            state.error = action.payload.error
        },
        receiveConfigurationError(state) {
            state.error = true
        }
    }
})

export const getConfiguration = (state: any): Omit<ConfigurationData, 'error'> => (state.configuration)
export const getConfigurationError = (state: any): boolean => (state.configuration.error)

export const loadConfiguration = async (dispatch: any) => {
    const jsonContents = await fetch('config.json')
    console.log(`JSON Contents: ${jsonContents}`)
    const configurationRaw = await jsonContents.json()
    if (!Array.isArray(configurationRaw)) {
        dispatch(receiveConfigurationError())
    }
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
    console.log(`Configuration: ${JSON.stringify(configuration, null, 4)}`)
    if (!(configuration.UserPoolId && configuration.UserPoolClient && configuration.WebSocketURI)) {
        dispatch(receiveConfigurationError())
    }
    dispatch(receiveConfiguration({
        UserPoolId: configuration.UserPoolId,
        UserPoolClient: configuration.UserPoolClient,
        WebSocketURI: configuration.WebSocketURI,
        error: false
    }))
}

export const { receiveConfiguration, receiveConfigurationError } = configurationSlice.actions
export default configurationSlice.reducer
