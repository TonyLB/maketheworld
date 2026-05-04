import { grey } from "@mui/material/colors"
import MuiPopper from "@mui/material/Popper"
import React, { FunctionComponent, ReactElement, ReactNode, useState } from "react"
import { keyframes, Paper, styled, useMediaQuery } from "@mui/material"
import { useSelector } from "react-redux"
import { getNextOnboardingEntry } from "../../slices/player"
import { AlwaysShowOnboarding } from "./index"

const Popper = styled(MuiPopper)(({ theme }) => ({
    zIndex: 1,
    '&[data-popper-placement*="bottom"] .MuiPopper-arrow': {
        top: 0,
        left: 0,
        marginTop: "-0.9em",
        width: "3em",
        height: "1em",
        "&::before": {
            borderWidth: "0 1em 1em 1em",
            borderColor: `transparent transparent ${grey[300]} transparent`
        }
    },
    '&[data-popper-placement*="top"] .MuiPopper-arrow': {
        bottom: 0,
        left: 0,
        marginBottom: "-0.9em",
        width: "3em",
        height: "1em",
        "&::before": {
            borderWidth: "1em 1em 0 1em",
            borderColor: `${grey[300]} transparent transparent transparent`
        }
    },
    '&[data-popper-placement*="right"] .MuiPopper-arrow': {
        left: 0,
        marginLeft: "-0.9em",
        height: "3em",
        width: "1em",
        "&::before": {
            borderWidth: "1em 1em 1em 0",
            borderColor: `transparent ${grey[300]} transparent transparent`
        }
    },
    '&[data-popper-placement*="left"] .MuiPopper-arrow': {
        right: 0,
        marginRight: "-0.9em",
        height: "3em",
        width: "1em",
        "&::before": {
            borderWidth: "1em 0 1em 1em",
            borderColor: `transparent transparent transparent ${grey[300]}`
        }
    }
}))

const Arrow = styled("div")({
    position: "absolute",
    fontSize: 7,
    width: "3em",
    height: "3em",
    "&::before": {
        content: '""',
        margin: "auto",
        display: "block",
        width: 0,
        height: 0,
        borderStyle: "solid"
    }
})

const pulse = keyframes `
    25% {
      background: ${grey[300]}
    }
    50% {
      background: ${grey[400]}
    }
    75% {
      background: ${grey[300]}
    }
`

type TutorialPopoverProps = {
    anchorEl: React.MutableRefObject<HTMLElement>;
    placement: 'right' | 'top' | 'bottom' | 'left';
    condition?: boolean;
    checkPoints: string[];
}

export const TutorialPopover: FunctionComponent<TutorialPopoverProps> = ({ anchorEl, placement, condition, checkPoints }) => {
    const [arrowRef, setArrowRef] = useState<HTMLSpanElement | null>(null)
    const nextOnboardingEntry = useSelector(getNextOnboardingEntry)
    const portrait = useMediaQuery('(orientation: portrait)')
    const large = useMediaQuery('(min-height:600px)')
    
    const renderText = (text: ReactElement | string | ((arg: { portrait: boolean; large: boolean; alwaysShowSetting: ReactElement }) => ReactElement | string) | undefined): ReactNode => {
        if (!text) return null
        if (typeof text === 'function') {
            return text({ portrait, large, alwaysShowSetting: <AlwaysShowOnboarding /> })
        }
        return text
    }
    
    return (((condition ?? true) === false) || !(checkPoints.includes(nextOnboardingEntry?.key ?? '')))
        ? null
        : <React.Fragment>
            { anchorEl.current
                ? <Popper
                    open={true}
                    anchorEl={anchorEl.current}
                    placement={placement}
                    modifiers={[
                        {
                            name: 'offset',
                            options: { offset: [0, 20] }
                        },
                        {
                            name: 'arrow',
                            enabled: true,
                            options: {
                                element: arrowRef
                            }
                        }
                    ]}
                >
                    <Arrow ref={setArrowRef} className="MuiPopper-arrow" />
                    <Paper sx={{
                        background: grey[300],
                        padding: '0.5em',
                        maxWidth: '20em',
                        animation: `${pulse} 2s infinite`
                    }}>
                        { renderText(nextOnboardingEntry?.popoverText ?? nextOnboardingEntry?.text) }
                    </Paper>
                </Popper>
                : null
            }
        </React.Fragment>
}

export default TutorialPopover
