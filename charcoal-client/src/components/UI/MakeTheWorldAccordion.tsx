import React, { FunctionComponent, ReactNode, useState } from 'react'
import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    Box,
    Fade
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

// Import theme extensions as side-effect to ensure module augmentation is applied
import '../../theme/extensions'

export interface MakeTheWorldAccordionProps {
    /**
     * The title/header text for the accordion section
     */
    title: string
    
    /**
     * The content to display when expanded
     */
    children: ReactNode
    
    /**
     * Whether the accordion is expanded by default
     */
    defaultExpanded?: boolean
    
    /**
     * Whether the accordion is disabled
     */
    disabled?: boolean
    
    /**
     * Optional icon to display in the header (left side)
     */
    icon?: ReactNode
    
    /**
     * Optional action buttons to display in the header (right side)
     */
    actions?: ReactNode
    
    /**
     * Optional summary shown when collapsed (e.g. "north, south, stairs" for Exits).
     * Fades in when the accordion closes and fades out when it opens.
     * Truncates with ellipsis if it overflows the header.
     */
    summary?: ReactNode
}

/**
 * Make The World styled Accordion component.
 * 
 * This component provides a consistent accordion pattern that uses the theme's
 * extras palette for visual language elements. It's designed to be used across
 * the application wherever collapsible sections are needed.
 * 
 * The accordion uses theme-aware styling that adapts to different theme contexts
 * (e.g., workbench vs chat spine) while maintaining a consistent visual language.
 * 
 * @example
 * ```tsx
 * <MakeTheWorldAccordion title="Components" defaultExpanded>
 *   <List>
 *     <ListItem>Component 1</ListItem>
 *     <ListItem>Component 2</ListItem>
 *   </List>
 * </MakeTheWorldAccordion>
 * ```
 */
export const MakeTheWorldAccordion: FunctionComponent<MakeTheWorldAccordionProps> = ({
    title,
    children,
    defaultExpanded = false,
    disabled = false,
    icon,
    actions,
    summary
}) => {
    const [expanded, setExpanded] = useState(defaultExpanded)

    return (
        <Accordion
            expanded={expanded}
            onChange={(_, exp) => setExpanded(exp)}
            disabled={disabled}
            sx={{
                boxShadow: 'none',
                border: (theme) => `1px solid ${(theme.palette as any).extras?.sectionBorder ?? theme.palette.divider}`,
                borderRadius: '0.5em',
                marginBottom: '0.5em',
                '&:before': {
                    display: 'none', // Remove default MUI accordion divider
                },
                '&.Mui-expanded': {
                    margin: '0 0 0.5em 0', // Consistent margin when expanded
                },
            }}
        >
            <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                    backgroundColor: (theme) => 
                        (theme.palette as any).extras?.sectionHeaderBackground ?? 
                        theme.palette.background.paper,
                    borderRadius: '0.5em',
                    minHeight: '48px',
                    '&.Mui-expanded': {
                        minHeight: '48px',
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,
                    },
                    '&:hover': {
                        backgroundColor: (theme) => 
                            (theme.palette as any).extras?.sectionHeaderBackground ?? 
                            theme.palette.action.hover,
                    },
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        gap: 1,
                    }}
                >
                    {icon && (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                color: (theme) => theme.palette.text.secondary,
                            }}
                        >
                            {icon}
                        </Box>
                    )}
                    <Typography
                        variant="subtitle1"
                        sx={{
                            flexGrow: 1,
                            flexShrink: 0,
                            fontWeight: 500,
                            minWidth: 0,
                        }}
                    >
                        {title}
                    </Typography>
                    {summary !== undefined && (
                        <Fade in={!expanded}>
                            <Box
                                sx={{
                                    minWidth: 0,
                                    flexShrink: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    color: 'text.secondary',
                                    typography: 'body2',
                                }}
                            >
                                {summary}
                            </Box>
                        </Fade>
                    )}
                    {actions && (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                flexShrink: 0,
                            }}
                            onClick={(e) => e.stopPropagation()} // Prevent accordion toggle when clicking actions
                        >
                            {actions}
                        </Box>
                    )}
                </Box>
            </AccordionSummary>
            <AccordionDetails
                sx={{
                    backgroundColor: (theme) => 
                        (theme.palette as any).extras?.sectionBackground ?? 
                        theme.palette.background.paper,
                    padding: 2,
                    borderTop: (theme) => `1px solid ${(theme.palette as any).extras?.sectionBorder ?? theme.palette.divider}`,
                    borderBottomLeftRadius: '0.5em',
                    borderBottomRightRadius: '0.5em',
                }}
            >
                {children}
            </AccordionDetails>
        </Accordion>
    )
}

export default MakeTheWorldAccordion
