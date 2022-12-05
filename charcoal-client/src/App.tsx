import React, { useState } from 'react'
import { Provider } from 'react-redux'
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
import { AuthConfig } from './config'
import './App.css';

declare module '@mui/styles' {
  interface DefaultTheme extends Theme {}
}

Amplify.configure(AuthConfig)

const theme = createTheme();

export const App = ({ signOut }: { signOut: () => void }) => (
  <StyledEngineProvider injectFirst>
    <ThemeProvider theme={theme}>
      <Provider store={store}>
        <CssBaseline />
        <AppController signOut={signOut} />
        {/* <Chat /> */}
      </Provider>
    </ThemeProvider>
  </StyledEngineProvider>
)

export default (withAuthenticator as any)(App, {
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
