import React from 'react';
import { Provider } from 'react-redux'
import { store } from './store/index.js'
import Chat from './components/Chat.js'
import './App.css';

export const App = () => (
  <Provider store={store}>
    <Chat />
  </Provider>
)

export default App;
