import {
    blue,
    pink,
    purple,
    green,
    grey
} from "@mui/material/colors"
import makeStyles from '@mui/styles/makeStyles';
// import tinycolor from 'tinycolor2'
import { Theme, createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
    interface PaletteOptions {
        extras?: {
            pale?: string;
        }
    }
}

const drawerWidth = 400;

export const playerStyle = (color: string): string => (
    color
        ? `player${color.charAt(0).toUpperCase()}${color.slice(1)}`
        : ''
)

//
// TODO: Typescript-constrain characterPalettes
//
export const characterThemes = (Object.entries({ blue, pink, purple, green, grey })).map(([colorName, color]) => ({
    [colorName]: createTheme({
        palette: {
            primary: color,
            extras: {
                pale: color[50]
            }
        },
    })
})).reduce((prev, item) => ({ ...prev, ...item }), {})

export const useStyles = makeStyles((theme: Theme) => ({
    ...(Object.entries({ blue, pink, purple, green }).map(([colorName, color]) => ({
        [playerStyle(colorName)]: {
            '& .threadViewMessageColor': {
                color: theme.palette.getContrastText(color[50]),
                backgroundColor: color[50],
                borderColor: color[500]
            },
            '& .messageColor': {
                color: theme.palette.getContrastText(color[50]),
                backgroundColor: color[50],
            },
            '& .avatarColor': {
                color: theme.palette.getContrastText(color[50]),
                backgroundColor: color[500],
            },
            '& .chipColor': {
                color: theme.palette.getContrastText(color[50]),
                backgroundColor: color[50]
            }
        },
    })).reduce((prev, item) => ({ ...prev, ...item }), {})),
    threadViewMessage: {
        borderRadius: "10px",
        borderWidth: "1px",
        borderStyle: "solid"
    },
    //
    // If we have enough screen real-estate, offset messages from other people to the
    // left, and offset messages from yourself to the right.
    //
    threadViewOther: {
        '@media screen and (min-width: 1000px)': {
            width: `calc(100% - ${theme.spacing(12)})`,
            marginRight: theme.spacing(12)
        }
    },
    threadViewSelf: {
        '@media screen and (min-width: 1000px)': {
            width: `calc(100% - ${theme.spacing(12)})`,
            marginLeft: theme.spacing(12)
        }
    },
    recap: {
        backgroundColor: grey[200],
        paddingLeft: theme.spacing(8)
    },
    lightgrey: {
        backgroundColor: grey[200],
    },
    darkgrey: {
        backgroundColor: grey[400]
    },
    root: {
        '& .MuiTextField-root': {
            margin: theme.spacing(1),
            minWidth: '25ch',
        },
    },
    roomMessage: {
        color: theme.palette.getContrastText(blue[800]),
        backgroundColor: blue[800],
    },
    neighborhoodMessage: {
        color: theme.palette.getContrastText(theme.palette.primary.light),
        backgroundColor: theme.palette.primary.light,
    },
    card: {
        margin: "10px"
    },
    verticalFill: {
        position: "absolute",
        height: "100%"
    },
    topAppBar: {
        top: 0,
        zIndex: theme.zIndex.drawer + 1,
        flexShrink: 0,
        transition: theme.transitions.create(['width', 'margin'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.leavingScreen,
        }),
    },
    topAppBarShift: {
        marginRight: drawerWidth,
        width: `calc(100% - ${drawerWidth}px)`,
        transition: theme.transitions.create(['width', 'margin'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
    },
    bottomAppBar: {
        top: 'auto',
        flexShrink: 0,
        bottom: 0,
    },
    lineEntry: {
        backgroundColor: theme.palette.background.default
    },
    // Extra wrappers to sidestep a Firefox bug (as of May 2020)
    messageBottomSnapper: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        height: "100%",
        width: "100%"
    },
    messageContainer: {
        height: "100%",
        display: "flex",
        flexDirection: "column",
        maxWidth: "lg"
    },
    messagePaper: {
        position: "relative",
        width: "100%",
        marginBottom: "10px",
        overflow: "auto"
    },
    messageScrollButtonPlacement: {
        right: "0",
        bottom: "0",
        padding: "20px",
        marginBottom: "20px",
        pointerEvents: "auto"
    },
    neighborhoodPathsCard: {
        margin: "10px",
        height: "calc(100% - 20px)"
    },
    treeView: {
        height: 240,
        flexGrow: 1,
        maxWidth: 400
    },
    nested: {
        paddingLeft: theme.spacing(4),
    },
    pathTextField: {
        maxWidth: "12ch"
    },
    scrollingCardContent: {
        overflow: "auto"
    },

    menuButton: {
        marginRight: 36,
    },
    hide: {
        display: 'none',
    },
    drawer: {
        width: drawerWidth,
        flexShrink: 0,
        position: "relative",
        right: 0,
        whiteSpace: 'nowrap',
        pointerEvents: 'auto'
    },
    drawerOpen: {
        width: drawerWidth,
        flexShrink: 0,
        position: "relative",
        right: 0,
        overflowY: "auto",
        overflowX: "hidden",
        transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
        }),
        pointerEvents: 'auto'
    },
    drawerClose: {
        transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
        }),
        position: "relative",
        right: 0,
        overflowY: "auto",
        overflowX: 'hidden',
        width: theme.spacing(8) + 1,
        pointerEvents: 'auto'
    },
    mapDrawerVerticalOpen: {
        width: "100%",
        flexShrink: 1,
        flexBasis: 400,
        position: "relative",
        left: 0,
        top: 0,
        overflowY: "hidden",
        overflowX: "hidden",
        transition: theme.transitions.create(['flexBasis'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
        }),
        pointerEvents: 'auto'
    },
    mapDrawerVerticalClose: {
        transition: theme.transitions.create(['flexBasis'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
        }),
        position: "relative",
        left: 0,
        top: 0,
        overflowY: "hidden",
        overflowX: 'hidden',
        flexBasis: theme.spacing(8),
        flexGrow: 0,
        pointerEvents: 'auto'
    },
    mapDrawerHorizontalOpen: {
        flexShrink: 1,
        flexBasis: 600,
        position: "relative",
        left: 0,
        top: 0,
        marginRight: "40px",
        overflowY: "hidden",
        overflowX: "hidden",
        transition: theme.transitions.create(['flexBasis'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
        }),
        pointerEvents: 'auto'
    },
    mapDrawerHorizontalClose: {
        transition: theme.transitions.create(['flexBasis'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
        }),
        position: "relative",
        left: 0,
        top: 0,
        overflowY: "hidden",
        overflowX: 'hidden',
        flexBasis: theme.spacing(13) + 1,
        flexGrow: 0,
        pointerEvents: 'auto'
    },
    toolbar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: theme.spacing(0, 1),
        // necessary for content to be below app bar
        ...theme.mixins.toolbar,
    },
    content: {
        flexGrow: 1,
        padding: theme.spacing(3),
    },
    svgBlue: {
        fill: blue[500]
    },
    svgBlueContrast: {
        fill: theme.palette.getContrastText(blue[500])
    },
    svgLightBlue: {
        fill: blue[50]
    },
    svgLightBlueContrast: {
        fill: theme.palette.getContrastText(blue[50])
    },
    homeContents: {
        flexGrow: 1,
        padding: "10px"
    },
    homeGrid: {
        width: "100%",
        padding: "10px"
    },
    profileContents: {
        width: "calc(100% - 40px)",
        height: "100%",
        margin: "0px 20px",
        position: "relative"
    },
    characterChip: {
        maxWidth: "10em",
        textOverflow: "ellipsis"
    },
    characterSelectionList: {
    },
    characterSelectionListItem: {
        backgroundColor: grey[50],
        borderRadius: "10px",
        borderColor: grey[500],
        borderWidth: "1px",
        borderStyle: "solid"
    },
    characterAddListItem: {
        backgroundColor: grey[100],
        borderRadius: "10px",
        borderColor: grey[500],
        borderWidth: "1px",
        borderStyle: "solid",
        cursor: "pointer",
    },
    contextMessage: {
        zIndex: 0,
        position: 'relative',
        maxWidth: '500px',
        padding: '20px',
        margin: '20px',
        fontFamily: theme.typography.fontFamily,
        'text-shadow': `
            -0.5px -0.5px 0 #FFFFFF,
            0.5px -0.5px 0 #FFFFFF,
            -0.5px 0.5px 0 #FFFFFF,
            0.5px 0.5px 0 #FFFFFF
        `,
        '&:before': {
            borderRadius: '10px 0px 0px 10px',
            position: 'absolute',
            height: '100%',
            top: 0,
            left: 0,
            zIndex: -5,
            width: '50px',
            display: 'block',
            content: '" "',
            backgroundColor: 'lightGrey'
        }
    },
    subjectHeader: {
        zIndex: 0,
        position: 'relative',
        padding: '10px',
        margin: '10px',
        fontFamily: theme.typography.fontFamily,
        'text-shadow': `
            -1px -1px 0 #FFFFFF,
            1px -1px 0 #FFFFFF,
            -1px 1px 0 #FFFFFF,
            1px 1px 0 #FFFFFF
        `,
        '&:before': {
            borderRadius: '10px',
            position: 'absolute',
            height: '2em',
            width: '2em',
            top: 0,
            left: 0,
            zIndex: -5,
            display: 'block',
            content: '" "',
            backgroundColor: 'lightBlue'
        }
    },
    threadListItem: {
        cursor: 'pointer',
        userSelect: 'none',
        backgroundColor: grey[50],
        borderRadius: "10px",
        borderColor: grey[500],
        borderWidth: "1px",
        borderStyle: "solid",
        '&:hover': {
            backgroundColor: blue[50],
            color: theme.palette.getContrastText(blue[50])
        }
    }
}))

export default useStyles