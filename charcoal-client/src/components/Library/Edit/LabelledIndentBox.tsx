import React, { ForwardedRef, ReactNode } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InlineChromiumBugfix from './DescriptionEditor/InlineChromiumBugfix'
import DeleteIcon from '@mui/icons-material/Delete'

type LabelledIndentBoxProps = {
    color: Record<number | string, string>;
    children: any;
    label: ReactNode;
    actions?: ReactNode;
    slate?: boolean;
    onDelete?: () => void;
}

//
// Refactor LabelledIndentBox withForwardRef, so that it doesn't need to be wrapped in a span in order to
// be used with Slate
//
export const LabelledIndentBox = React.forwardRef(<T extends LabelledIndentBoxProps>({ color, children, label, actions, slate, onDelete, ...attributes }: T, ref: ForwardedRef<any>) => {
    return <Box sx={{ position: "relative", width: "calc(100% - 0.1em)", display: 'inline-block' }}>
        <Box
            {...(slate ? { contentEditable: false } : {})}
            sx={{
                borderRadius: "0em 1em 1em 0em",
                borderStyle: 'solid',
                borderColor: color[500],
                background: color[100],
                display: 'inline',
                paddingRight: '0.25em',
                position: 'absolute',
                top: 0,
                left: 0
            }}
        >
            { label }
        </Box>
        <Box
            sx={{
                borderRadius: '0em 1em 1em 0em',
                borderStyle: 'solid',
                borderColor: color[500],
                background: color[50],
                paddingRight: '0.5em',
                paddingLeft: '0.25em',
                paddingTop: "0.5em",
                marginTop: '1em',
                minWidth: '1.5em',
                ...actions ? {
                    marginBottom: '0.35em'
                } : {},
            }}
        >
            <span {...attributes} ref={ref}>
                { slate && <InlineChromiumBugfix /> }
                {children}
                { slate && <InlineChromiumBugfix /> }
            </span>
        </Box>
        { actions && <Box
            {...(slate ? { contentEditable: false } : {})}
            sx={{
                paddingRight: '0.25em',
                position: 'absolute',
                bottom: '-0.35em',
                right: '1em'
            }}
        >
            { actions }
        </Box>}
        { onDelete &&
            <Box
                sx={{
                    position: 'absolute',
                    top: '0.35em',
                    right: '1em',
                    borderRadius: '50%',
                    borderStyle: 'solid',
                    borderColor: color[500],
                    background: color[50]
                }}
            >
                <IconButton size='small' onClick={onDelete}><DeleteIcon fontSize='small' /></IconButton>
            </Box>
        }
    </Box>
})

type SlateIndentBoxProps = {
    color: Record<number | string, string>;
    children: any;
    label: ReactNode;
    actions?: ReactNode;
}

export const SlateIndentBox = React.forwardRef(<T extends SlateIndentBoxProps>({ color, children, label, actions, ...attributes }: T, ref: ForwardedRef<any>) => {
    return <LabelledIndentBox
        color={color}
        label={label}
        actions={actions}
        slate
        { ...attributes }
        ref={ref}
    >
        {children}
    </LabelledIndentBox>
})
