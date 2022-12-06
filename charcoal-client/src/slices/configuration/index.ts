import { createSlice, PayloadAction } from '@reduxjs/toolkit'

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
            state = action.payload
        },
        receiveConfigurationError(state) {
            state.error = true
        }
    }
})

export const getConfiguration = (state: any): Omit<ConfigurationData, 'error'> => (state.configuration)
export const getConfigurationError = (state: any): boolean => (state.configuration.error)

export const loadConfiguration = async (dispatch: any) => {
    const jsonContents = await fetch('public/config.json')
    const configuration = await jsonContents.json()
    if (typeof configuration !== 'object') {
        dispatch(receiveConfigurationError())
    }
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
