import React, { ReactNode } from 'react'
import { keyframes } from '@mui/material'

const load8 = keyframes`
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
`

interface SpinnerProps {
    size: number;
    border: number;
    children?: ReactNode;
}

export const Spinner = ({
    size = 20,
    border = 2,
    children
}: SpinnerProps) => {
    return <div
        style={{
            borderRadius: "50%",
            borderTop: `${border}px solid rgba(0, 0, 0, 0.2)`,
            borderRight: `${border}px solid rgba(0, 0, 0, 0.2)`,
            borderBottom: `${border}px solid rgba(0, 0, 0, 0.2)`,
            borderLeft: `${border}px solid #000000`,
            animation: `${load8} 1.1s infinite linear`,
            width: size,
            height: size
        }}
    >
        { children }
    </div>
}

export default Spinner
