import React, { useEffect, useState } from 'react'
import { Provider, useDispatch, useSelector } from 'react-redux'
import { Amplify } from 'aws-amplify'
import {
  Authenticator,
  withAuthenticator,
  useAuthenticator,
  CheckboxField
} from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import { CssBaseline } from '@mui/material'
import { Theme } from '@mui/material/styles';
import { ThemeProvider, StyledEngineProvider, createTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import { blue } from '@mui/material/colors'
import CodeOfConductConsentDialog from './components/CodeOfConductConsent'

import '@mui/styles'

import { store } from './store/index'
import AppController from './components/AppController'
import './App.css';
import { getConfiguration, getConfigurationError, loadConfiguration } from './slices/configuration'
import Spinner from './components/Spinner'

declare module '@mui/styles' {
  interface DefaultTheme extends Theme {}
}

const theme = createTheme();

export const App = ({ signOut }: { signOut: () => void }) => (
  <StyledEngineProvider injectFirst>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppController signOut={signOut} />
      {/* <Chat /> */}
    </ThemeProvider>
  </StyledEngineProvider>
)

//
// TODO: Refactor below as AuthenticatedApp, then wrap that further (and export
// the wrapped component as default) in a Redux API request to secure the config
// JSON by asynchronous fetch.
//
const AuthenticatedApp = (withAuthenticator as any)(App, {
  signUpAttributes: ['email'],
  signUpConfig: {
    hiddenDefaults: ['phone_number']
  },
  components: {
    SignUp: {
      FormFields() {
        const { validationErrors } = useAuthenticator()
        const [showingDialog, setShowingDialog] = useState(false)

        return (
          <React.Fragment>
            <CodeOfConductConsentDialog
              open={showingDialog}
              onClose={ () => { setShowingDialog(false) } }
            />
            <Authenticator.SignUp.FormFields />

            {/* Append & require Terms & Conditions field to sign up  */}
            <CheckboxField
              errorMessage={validationErrors.acknowledgement as string}
              hasError={!!validationErrors.acknowledgement}
              name="acknowledgement"
              value="yes"
              label={
                <React.Fragment>
                  I agree to abide by the&nbsp;
                  <Box
                    component='span'
                    sx={{
                      backgroundColor: blue[50]
                    }}
                    onClick={(event: any) => {
                      event.preventDefault()
                      setShowingDialog(true)
                    }}
                  >
                    Code of Conduct
                  </Box>
                </React.Fragment>
              }
            />
          </React.Fragment>
        )
      }
    }
  },
  services: {
    async validateCustomSignUp(formData: { acknowledgement: boolean }) {
      if (!formData.acknowledgement) {
        return {
          acknowledgement: 'You must agree to abide by the Code of Conduct',
        };
      }
    },
  }
})

const ConfiguredApp = () => {
  const error = useSelector(getConfigurationError)
  const configuration = useSelector(getConfiguration)
  const dispatch = useDispatch()
  useEffect(() => {
    if (!error) {
      if (configuration.UserPoolClient && configuration.UserPoolId && configuration.WebSocketURI) {
        Amplify.configure({
          aws_project_region: "us-east-1",
          aws_appsync_region: "us-east-1",
          aws_appsync_authenticationType: "AMAZON_COGNITO_USER_POOLS",
          Auth: {
              // REQUIRED - Amazon Cognito Region
              region: 'us-east-1',
      
              // OPTIONAL - Amazon Cognito User Pool ID
              userPoolId: configuration.UserPoolId,
      
              // OPTIONAL - Amazon Cognito Web Client ID (26-char alphanumeric string)
              userPoolWebClientId: configuration.UserPoolClient,
      
              // OPTIONAL - Enforce user authentication prior to accessing AWS resources or not
              mandatorySignIn: true,
      
              // OPTIONAL - Manually set the authentication flow type. Default is 'USER_SRP_AUTH'
              authenticationFlowType: 'USER_SRP_AUTH',
      
          }      
        })
      }
      else {
        dispatch(loadConfiguration)
      }
    }
  }, [configuration, error])
  if (error) {
    return <div>Error loading MTW configuration</div>
  }
  else if (configuration.UserPoolClient && configuration.UserPoolId && configuration.WebSocketURI) {
    return <AuthenticatedApp />
  }
  else {
    return <Spinner size={150} border={10} />
  }
}

export const FinalApp = () => (
  <Provider store={store}>
    <ConfiguredApp />
  </Provider>
)
export default FinalApp
