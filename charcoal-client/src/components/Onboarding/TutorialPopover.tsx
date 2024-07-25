import { grey } from "@mui/material/colors"
import MuiPopper from "@mui/material/Popper"
import React, { FunctionComponent, useState } from "react"
import { styled } from "@mui/styles"
import { Paper } from "@mui/material"
import { useNextOnboarding } from "./useOnboarding"
import { useSelector } from "react-redux"
import { getNextOnboardingEntry } from "../../slices/player"

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
});

type TutorialPopoverProps = {
    anchorEl: React.MutableRefObject<HTMLElement>;
    placement: 'right';
    condition?: boolean;
    checkPoints: string[];
}

export const TutorialPopover: FunctionComponent<TutorialPopoverProps> = ({ anchorEl, placement, condition, checkPoints }) => {
    const [arrowRef, setArrowRef] = useState<HTMLSpanElement>(null)
    const nextOnboardingEntry = useSelector(getNextOnboardingEntry)
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
                    <Paper sx={{ background: grey[300], padding: '0.5em' }}>
                        Test Popper<br/>Content
                    </Paper>
                </Popper>
                : null
            }
        </React.Fragment>
}

export default TutorialPopover
