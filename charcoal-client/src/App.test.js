import React from 'react';
import { render } from '@testing-library/react';
import App from './App';

jest.mock('./cacheDB')

global.WebSocket = jest.fn()

test('renders learn react link', () => {
  const { container } = render(<App />);
  expect(container.firstChild).toMatchSnapshot();
});
