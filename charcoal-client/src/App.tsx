import React from 'react'
import { Provider } from 'react-redux'
import Amplify from 'aws-amplify'
import { withAuthenticator } from 'aws-amplify-react'
import { CssBaseline } from '@mui/material'
import { Theme } from '@mui/material/styles';
import { ThemeProvider, StyledEngineProvider, createTheme } from '@mui/material/styles';

import '@mui/styles'

import { store } from './store/index'
import AppController from './components/AppController'
import { AuthConfig } from './config'
import './App.css';

declare module '@mui/styles' {
  interface DefaultTheme extends Theme {}
}

Amplify.configure(AuthConfig)

const theme = createTheme();

export const App = () => (
  <StyledEngineProvider injectFirst>
    <ThemeProvider theme={theme}>
      <Provider store={store}>
        <CssBaseline />
        <AppController />
        {/* <Chat /> */}
      </Provider>
    </ThemeProvider>
  </StyledEngineProvider>
)

export default (withAuthenticator as any)(App, {
  signUpConfig: {
    hiddenDefaults: ['phone_number']
  }
})
