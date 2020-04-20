import React from 'react';
import { render } from '@testing-library/react';
import NeighborhoodDescriptionMessage from './NeighborhoodDescriptionMessage';

describe('NeighborhoodDescriptionMessage component', () => {
    it('should render empty message', () => {
        const { container } = render(<NeighborhoodDescriptionMessage />)
        expect(container.firstChild).toMatchSnapshot()
    })

    it('should render test message', () => {
        const { container } = render(<NeighborhoodDescriptionMessage message={{
                Description: "This is a test",
                Name: "Test"
            }}/>)
        expect(container.firstChild).toMatchSnapshot()
    })
})

