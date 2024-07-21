import { useEffect } from 'react'
import { Provider, useDispatch, useSelector } from 'react-redux'
import { CssBaseline } from '@mui/material'
import { Theme } from '@mui/material/styles';
import { ThemeProvider, StyledEngineProvider, createTheme } from '@mui/material/styles'

import '@mui/styles'

import { store } from './store/index'
import AppController from './components/AppController'
import './App.css';
import { getConfiguration, getConfigurationError, loadConfiguration, receiveRefreshToken } from './slices/configuration'
import Spinner from './components/Spinner'
import { SignInOrUp } from './components/SignIn'
import { setIntent } from './slices/lifeLine';
import { heartbeat } from './slices/stateSeekingMachine/ssmHeartbeat';

declare module '@mui/styles' {
  interface DefaultTheme extends Theme {}
}

const theme = createTheme();

const signOut = (dispatch, getState) => {
  dispatch(receiveRefreshToken(undefined))
  dispatch(setIntent(['SIGNOUT']))
  dispatch(heartbeat)
}

export const App = ({ signOut }: { signOut: () => void }) => (
  <StyledEngineProvider injectFirst>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppController signOut={signOut} />
    </ThemeProvider>
  </StyledEngineProvider>
)

const ConfiguredApp = () => {
  const error = useSelector(getConfigurationError)
  const configuration = useSelector(getConfiguration)
  const dispatch = useDispatch()
  useEffect(() => {
    if (!error) {
      if (!(configuration.WebSocketURI && configuration.AnonymousAPIURI)) {
        dispatch(loadConfiguration)
      }
    }
  }, [configuration, error])
  if (error) {
    return <div>Error loading MTW configuration</div>
  }
  else if (!configuration.RefreshToken) {
    return <SignInOrUp />
  }
  else if (configuration.WebSocketURI && configuration.AnonymousAPIURI) {
    return <App signOut={() => { dispatch(signOut) }}/>
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
