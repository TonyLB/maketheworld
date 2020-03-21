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
        }
    })).reduce((prev, item) => ({ ...prev, ...item }), {})),
    darkgreen: {
        color: theme.palette.getContrastText(green[700]),
        backgroundColor: green[700],
    }
}))

export default useStyles