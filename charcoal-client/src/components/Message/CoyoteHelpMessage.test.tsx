/**
* @vitest-environment jsdom
*/

import React from 'react'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { createMakeTheWorldThemeFromColor } from '../../theme/createMakeTheWorldTheme'
import { blue } from '@mui/material/colors'
import CoyoteHelpMessage from './CoyoteHelpMessage'

describe('CoyoteHelpMessage', () => {
    it('renders required onboarding copy', () => {
        render(
            <ThemeProvider theme={createMakeTheWorldThemeFromColor(blue)}>
                <CoyoteHelpMessage message={{
                    DisplayProtocol: 'CoyoteGameHelpMessage',
                    MessageId: 'MESSAGE#help',
                    CreatedTime: Date.now()
                }} />
            </ThemeProvider>
        )

        expect(screen.getByText('Welcome to the Coyote Game')).toBeDefined()
        expect(screen.getByText(/You play a supra-genius coyote in the cartoon American Southwest\./)).toBeDefined()
        expect(screen.getByText(/Move around by giving a direction or destination: "east" or "climb up the cliff\."/)).toBeDefined()
        expect(screen.getByText(/Order Acme products by describing what you want to buy from the catalog: "order rocket power roller-skates" or "order a plate of birdseed and a cannister of ball bearings from Acme\."/)).toBeDefined()
        expect(screen.getByText(/When your setup is ready, ask for a reading of your plan: "predict" or "what's my plan\?"/)).toBeDefined()
        expect(screen.getByText(/Wait for the Road Runner to put your plan into action: "wait for road runner\."/)).toBeDefined()
    })
})
