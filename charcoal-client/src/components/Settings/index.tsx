import React, { FunctionComponent, useCallback } from 'react'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions/CardActions'
import CardHeader from '@mui/material/CardHeader'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import { useDispatch, useSelector } from 'react-redux'
import { getMySettings } from '../../slices/player'
import { socketDispatch } from '../../slices/lifeLine'
import { useOnboardingCheckpoint } from '../Onboarding/useOnboarding'
import { FormControlLabel, FormGroup, Switch } from '@mui/material'
import { getClientSettings } from '../../slices/settings'

type SettingsProps = {
    onAlwaysShowOnboardingChange: (value: boolean) => void;
    signOut?: () => void;
}

export const Settings: FunctionComponent<SettingsProps> = ({
    signOut = () => {},
    onAlwaysShowOnboardingChange = () => {}
}) => {
    const { onboardCompleteTags } = useSelector(getMySettings)
    const { AlwaysShowOnboarding } = useSelector(getClientSettings)
    const dispatch = useDispatch()
    const restartOnboarding = useCallback(() => {
        if (onboardCompleteTags.length) {
            dispatch(socketDispatch({
                message: 'updatePlayerSettings',
                action: 'removeOnboarding',
                values: onboardCompleteTags
            }, { service: 'asset' }))
        }
    }, [onboardCompleteTags, dispatch])

    return <Box sx={{ flexGrow: 1, padding: "10px" }}>
        <Grid
            sx={{ width: "100%", padding: "10px" }}
            container
            direction="row"
            justifyContent="center"
            alignItems="center"
            spacing={3}
        >
            <Grid item xs={12} sx={{ textAlign: "center" }}>
                <Divider />
                    <h2>Settings</h2>
                <Divider />
            </Grid>
            <Grid item xs={1} md={2} lg={3} />
            <Grid item xs={10} md={8} lg={6}>
                <Card>
                    <CardHeader title="Onboarding" />
                    <CardContent>
                        The onboarding tutorials help you learn your way around the Make the World application. You
                        can restart them at any time if you need a refresher.
                        <br />
                        <br />
                        <FormGroup>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={AlwaysShowOnboarding}
                                        onChange={(event) => { onAlwaysShowOnboardingChange(event.target.checked) }}
                                    />
                                }
                                label="Show Onboarding on all pages"
                            />
                        </FormGroup>
                    </CardContent>
                    <CardActions>
                        <Button onClick={restartOnboarding}>
                            Restart onboarding
                        </Button>
                    </CardActions>
                </Card>
            </Grid>
            <Grid item xs={1} md={2} lg={3} />
            <Grid item xs={4} />
            <Grid item xs={4} sx={{ textAlign: 'center' }}>
                <Button variant='outlined' onClick={() => { signOut() }}>
                    Sign Out
                </Button>
            </Grid>
            <Grid item xs={4} />
        </Grid>
    </Box>
}

export default Settings
