import React, { FunctionComponent } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'

import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'

type HomeProps = {
    signOut?: () => void;
}

export const Settings: FunctionComponent<HomeProps> = ({
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
            {[
                {
                    icon: null,
                    title: 'Logout',
                    onClick: () => {
                        signOut()
                    },
                    href: undefined
                }
            ].map(({ icon, title, href, onClick }) => (
                <Grid key={title} item sm={3}>
                    <Card onClick={() => {
                        if (href) {
                            navigate(href)
                        }
                        else {
                            if (onClick) {
                                onClick()
                            }
                        }
                    }}>
                        <CardHeader
                            avatar={<Avatar>{icon}</Avatar>}
                            title={title}
                        />
                        <CardContent>
                        </CardContent>
                    </Card>
                </Grid>
            )) }
        </Grid>
    </Box>
}

export default Settings
