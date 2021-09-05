//
// Profile shows information about the player, and their characters, and allows them
// to edit that information.
//

//
// DEPENDENCY:  Create the MultiLevelNesting component, and use it to nest a CharacterEditor
// to the right of the character listing (with player-specific information below the character
// listing on the left-most panel)
//

//
// Refactor AllCharactersDialog and MyCharacterDialog in order to get the form-editing
// functionality.
//

import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useHistory } from 'react-router-dom'

import useStyles from '../styles'
import Avatar from '@material-ui/core/Avatar'
import Box from '@material-ui/core/Box'
import Card from '@material-ui/core/Card'
import CardActions from '@material-ui/core/CardActions'
import CardContent from '@material-ui/core/CardContent'
import CardHeader from '@material-ui/core/CardHeader'
import Divider from '@material-ui/core/Divider'
import Grid from '@material-ui/core/Grid'

import ForumIcon from '@material-ui/icons/AllInbox'
import CalendarIcon from '@material-ui/icons/Event'
import MapIcon from '@material-ui/icons/Explore'
import ChatIcon from '@material-ui/icons/Sms'

//
// TODO:  Choose better typography for the Home page.
//
export const Home = ({
    myCharacters = []
}) => {
    const classes = useStyles()
    const history = useHistory()

    return <Box className={classes.homeContents}>
        <div style={{ textAlign: "center" }}>
            <h2>Make the World</h2>
            A text-based platform for cooperative storytelling
            <Divider />
            <h2>Organize</h2>
            <Divider />
        </div>
        <Grid
            className={classes.homeGrid}
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
                            history.push(href)
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
            className={classes.homeGrid}
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
                            history.push(`/Character/${CharacterId}/Play`)
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
            className={classes.homeGrid}
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
                            history.push(href)
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
