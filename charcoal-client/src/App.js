import React from 'react'
import { Provider } from 'react-redux'
import Amplify from 'aws-amplify'
import { withAuthenticator } from 'aws-amplify-react'
import { CssBaseline } from '@material-ui/core'

import { store } from './store/index.js'
import Chat from './components/Chat.js'
import { AuthConfig } from './config'
import awsconfig from './aws-exports'
import './App.css';

Amplify.configure(awsconfig)
Amplify.configure(AuthConfig)

export const App = () => (
  <Provider store={store}>
    <CssBaseline />
    <Chat />
  </Provider>
)

export default withAuthenticator(App, {
  signUpConfig: {
    hiddenDefaults: ['phone_number']
  }
})
