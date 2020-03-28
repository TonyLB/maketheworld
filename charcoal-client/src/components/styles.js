import {
    blue,
    pink,
    purple,
    green
} from "@material-ui/core/colors"
import { makeStyles } from "@material-ui/core/styles"

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
        [`chip-${colorName}`]: {
            color: theme.palette.getContrastText(color[50]),
            backgroundColor: color[50]
        }
    })).reduce((prev, item) => ({ ...prev, ...item }), {})),
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
    card: {
        margin: "10px"
    },
    topAppBar: {
        top: 0
    },
    bottomAppBar: {
        top: 'auto',
        bottom: 0,
    },
    lineEntry: {
        backgroundColor: theme.palette.background.default
    },
    messageContainer: {
        height: "calc(100% - 80px)",
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
    }
}))

export default useStyles