import React, { FunctionComponent, useCallback } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import { alpha } from '@mui/material/styles'
import ImportExportIcon from '@mui/icons-material/ImportExport'

interface AddImportProps {
    onImportClick: () => void
    isEven?: boolean
}

export const AddImport: FunctionComponent<AddImportProps> = ({
    onImportClick,
    isEven = false
}) => {
    const theme = useTheme()

    const rowBg = isEven
        ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.08)
        : 'transparent'
    const rowHoverBg = alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.35 : 0.18)

    const handleClick = useCallback(() => {
        onImportClick()
    }, [onImportClick])

    return (
        <Box
            onClick={handleClick}
            role="button"
            tabIndex={0}
            aria-label="Import component from another asset"
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleClick()
                }
            }}
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                padding: '0.5em 0.75em',
                cursor: 'pointer',
                borderRadius: '4px',
                backgroundColor: rowBg,
                '&:hover': {
                    backgroundColor: rowHoverBg
                }
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    width: '38px',
                    flexShrink: 0,
                    color: 'text.secondary'
                }}
            >
                <ImportExportIcon sx={{ fontSize: '1.25rem' }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                    Import
                </Typography>
            </Box>
        </Box>
    )
}

export default AddImport
