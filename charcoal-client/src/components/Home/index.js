import React from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'

import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'

import ForumIcon from '@mui/icons-material/AllInbox'
import CalendarIcon from '@mui/icons-material/Event'
import MapIcon from '@mui/icons-material/Explore'
import ChatIcon from '@mui/icons-material/Sms'

//
// TODO:  Choose better typography for the Home page.
//

//
// TODO: Create a navigation path to the Help page
//
export const Home = ({
    myCharacters = []
}) => {
    const navigate = useNavigate()

    return <Box sx={{ flexGrow: 1, padding: "10px" }}>
        <div style={{ textAlign: "center" }}>
            <h2>Make the World</h2>
            A text-based platform for cooperative storytelling
            <Divider />
            <h2>Organize</h2>
            <Divider />
        </div>
        <Grid
            sx={{ width: "100%", padding: "10px" }}
            container
            direction="row"
            justifycontent="center"
            alignItems="center"
            spacing={3}
        >
            {[
                {
                    icon: <ForumIcon />,
                    title: 'Forum',
                    href: '/Forum/'
                },
                {
                    icon: <CalendarIcon />,
                    title: 'Calendar',
                    href: '/Calendar/'
                },
                {
                    icon: null,
                    title: 'Scenes',
                    href: '/Scenes/'
                },
                {
                    icon: null,
                    title: 'Stories',
                    href: '/Stories/'
                },
                {
                    icon: <ChatIcon />,
                    title: 'Out-of-game Chat',
                    href: '/Chat/'
                },
                {
                    icon: <MapIcon />,
                    title: 'Maps',
                    href: '/Maps/'
                },
                {
                    icon: null,
                    title: 'Logs',
                    href: '/Logs/'
                }
            ].map(({ icon, title, href }) => (
                <Grid key={title} item sm={3}>
                    <Card onClick={() => {
                        if (href) {
                            navigate(href)
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
        <div style={{ textAlign: "center" }}>
            <Divider />
            <h2>Play</h2>
            <Divider />
        </div>
        <Grid
            sx={{ width: "100%", padding: "10px" }}
            container
            direction="row"
            justifycontent="space-evenly"
            alignItems="center"
            spacing={3}
        >
            { myCharacters.map(({ Name, CharacterId }) => (
                CharacterId && <Grid key={`${Name}:${CharacterId}`} item sm={3}>
                    <Card onClick={() => {
                        if (CharacterId) {
                            navigate(`/Character/${CharacterId}/Play`)
                        }
                    }}>
                        <CardHeader
                            avatar={<Avatar>{Name[0] ? Name[0].toUpperCase() : '?'}</Avatar>}
                            title={Name}
                        />
                        <CardContent>
                        </CardContent>
                    </Card>
                </Grid>))
            }
        </Grid>
        <div style={{ textAlign: "center" }}>
            <Divider />
            <h2>Administer</h2>
            <Divider />
        </div>
        <Grid
            sx={{ width: "100%", padding: "10px" }}
            container
            direction="row"
            justifycontent="center"
            alignItems="center"
            spacing={3}
        >
            {[
                {
                    icon: null,
                    title: 'Code of Conduct',
                    href: '/CodeOfConduct'
                },
                {
                    icon: null,
                    title: 'Archived Characters',
                    href: '/Character/Archived'
                }
            ].map(({ icon, title, href }) => (
                <Grid key={title} item sm={3}>
                    <Card onClick={() => {
                        if (href) {
                            navigate(href)
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

Home.propTypes = {
    myCharacters: PropTypes.arrayOf(PropTypes.shape({
        CharacterId: PropTypes.string,
        Name: PropTypes.string,
        Pronouns: PropTypes.string,
        FirstImpression: PropTypes.string,
        OneCoolThing: PropTypes.string,
        Outfit: PropTypes.string,
        HomeId: PropTypes.string
    }))
}

export default Home
