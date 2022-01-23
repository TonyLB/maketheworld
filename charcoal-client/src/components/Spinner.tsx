import React, { ReactChild, ReactChildren } from 'react'
import makeStyles from '@mui/styles/makeStyles';

const useLocalStyles = makeStyles(theme => ({
    spinner: {
        borderRadius: "50%",
        // position: "relative",
        borderTop: "1.1em solid rgba(0, 0, 0, 0.2)",
        borderRight: "1.1em solid rgba(0, 0, 0, 0.2)",
        borderBottom: "1.1em solid rgba(0, 0, 0, 0.2)",
        borderLeft: "1.1em solid #000000",
        animation: "$load8 1.1s infinite linear"
    },
    "@keyframes load8": {
        from: {
            transform: "rotate(0deg)"
        },
        to: {
            transform: "rotate(360deg)"
        }
    }
}))

interface SpinnerProps {
    size: number;
    border: number;
    children?: ReactChild | ReactChildren;
}

export const Spinner = ({
    size = 20,
    border = 2,
    children
}: SpinnerProps) => {
    const styles = useLocalStyles()
    return <div
        className={styles.spinner}
        style={{
            width: size,
            height: size,
            borderWidth: border
        }}
    >
        { children }
    </div>
}

export default Spinner
