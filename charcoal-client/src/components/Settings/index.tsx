import React, { FunctionComponent } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'

import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions/CardActions'
import CardHeader from '@mui/material/CardHeader'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'

type SettingsProps = {
    signOut?: () => void;
}

export const Settings: FunctionComponent<SettingsProps> = ({
    signOut = () => {}
}) => {
    const navigate = useNavigate()

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
                    </CardContent>
                    <CardActions>
                        <Button>
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
