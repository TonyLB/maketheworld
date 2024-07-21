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
import useStateSeekingMachines from './components/useSSM';
import { useNavigate } from 'react-router-dom';

declare module '@mui/styles' {
  interface DefaultTheme extends Theme {}
}

const theme = createTheme();

export const App = () => (
  <StyledEngineProvider injectFirst>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppController />
    </ThemeProvider>
  </StyledEngineProvider>
)

const ConfiguredApp = () => {
  useStateSeekingMachines()
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
  else if (configuration.WebSocketURI && configuration.AnonymousAPIURI) {
    if (!configuration.RefreshToken) {
      return <SignInOrUp />
    }
    else {
      return <App />
    }
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
