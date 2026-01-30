import React, { FunctionComponent, ReactNode } from 'react'
import { Box, Tabs, Tab } from '@mui/material'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'

type LayeredExamplesTabsProps = {
    siblings: { id: ComponentUUID; label?: string | null }[];
    currentId: ComponentUUID | null;
    onChange: (nextId: ComponentUUID) => void;
    children: ReactNode;
}

export const LayeredExamplesTabs: FunctionComponent<LayeredExamplesTabsProps> = ({
    siblings,
    currentId,
    onChange,
    children
}) => {
    const handleChange = (_: React.SyntheticEvent, value: ComponentUUID) => {
        onChange(value)
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Tabs
                value={currentId ?? (siblings[0]?.id ?? false)}
                onChange={handleChange}
                variant="scrollable"
                scrollButtons="auto"
                aria-label="Example layers"
            >
                {siblings.map(({ id, label }) => (
                    <Tab
                        key={id}
                        value={id}
                        label={label && label.trim().length > 0 ? label : 'Untitled'}
                    />
                ))}
            </Tabs>
            <Box sx={{ flex: 1, overflow: 'auto', mt: 2 }}>
                {children}
            </Box>
        </Box>
    )
}

export default LayeredExamplesTabs
