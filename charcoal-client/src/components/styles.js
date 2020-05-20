import {
    blue,
    pink,
    purple,
    green,
    grey
} from "@material-ui/core/colors"
import { makeStyles } from "@material-ui/core/styles"
import tinycolor from 'tinycolor2'

const drawerWidth = 400;

export const useStyles = makeStyles(theme => ({
    ...(Object.entries({ blue, pink, purple, green }).map(([colorName, color]) => ({
        [colorName]: {
            color: theme.palette.getContrastText(color[500]),
            backgroundColor: color[500]
        },
        [`light${colorName}`]: {
            color: theme.palette.getContrastText(color[50]),
            backgroundColor: color[50]
        },
        [`recap${colorName}`]:{
            backgroundColor: tinycolor(color[500]).darken(10).desaturate(60).toHexString()
        },
        [`recapLight${colorName}`]:{
            backgroundColor: tinycolor(color[50]).darken(10).desaturate(60).toHexString(),
            paddingLeft: theme.spacing(8)
        },
        [`direct${colorName}`]: {
            color: theme.palette.getContrastText(color[50]),
            backgroundColor: color[50],
            borderRadius: "10px",
            borderColor: color[500],
            borderWidth: "1px",
            borderStyle: "solid"
        },
        [`chip-${colorName}`]: {
            color: theme.palette.getContrastText(color[50]),
            backgroundColor: color[50]
        }
    })).reduce((prev, item) => ({ ...prev, ...item }), {})),
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
        color: theme.palette.getContrastText(theme.palette.primary.main),
        backgroundColor: theme.palette.primary.main,
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
    messageContainer: {
        height: "100%",
        display: "flex",
        flexDirection: "column-reverse",
        maxWidth: "lg",
        overflow: "auto"
    },
    messagePaper: {
        position: "relative",
        width: "100%",
        marginBottom: "10px"
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
    mapDrawerOpen: {
        width: 600,
        height: 400,
        flexShrink: 0,
        position: "relative",
        left: 0,
        top: 0,
        overflowY: "hidden",
        overflowX: "hidden",
        transition: theme.transitions.create(['width', 'height'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
        }),
        pointerEvents: 'auto'
    },
    mapDrawerClose: {
        transition: theme.transitions.create(['width', 'height'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
        }),
        position: "relative",
        left: 0,
        top: 0,
        overflowY: "hidden",
        overflowX: 'hidden',
        width: theme.spacing(14) + 1,
        height: theme.spacing(8),
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
    }
}))

export default useStyles