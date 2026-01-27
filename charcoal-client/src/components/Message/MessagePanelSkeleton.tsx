import React, { FunctionComponent } from 'react'
import { Box, Skeleton } from '@mui/material'
import MessageComponent from './MessageComponent'

/**
 * MessagePanelSkeleton - Skeleton loader for MessagePanel during initial data load
 * 
 * Renders skeleton loaders that approximate the MessagePanel structure:
 * - Prominent Room-Summary header skeleton at top
 * - Multiple message-like skeletons with varying sizes
 * - Input area skeleton at bottom
 */
export const MessagePanelSkeleton: FunctionComponent = () => {
    return (
        <Box sx={{
            display: 'grid',
            height: '100%',
            gridTemplateColumns: "1fr",
            gridTemplateRows: "1fr auto",
            gridTemplateAreas: `
                "messages"
                "input"
            `
        }}>
            {/* Messages area */}
            <Box sx={{
                gridArea: 'messages',
                position: 'relative',
                padding: '10px',
                overflow: 'hidden'
            }}>
                {/* Prominent Room-Summary header skeleton */}
                <Box sx={{ 
                    marginBottom: '20px', 
                    marginLeft: '-10px', 
                    marginRight: '-10px',
                    marginTop: '-10px',
                    width: 'calc(100% + 20px)',
                    position: 'relative'
                }}>
                    <MessageComponent
                        flush={true}
                        leftGutter={0}
                        rightGutter={0}
                        sx={{
                            marginLeft: 0,
                            marginRight: 0,
                            width: '100%',
                            maxWidth: 'none'
                        }}
                    >
                        <Box sx={{
                            background: (theme: any) => (theme.palette.extras?.paleGradient || 'rgba(0, 0, 0, 0.05)'),
                            padding: '15px 20px',
                            paddingLeft: '90px', // Offset content back to align with other messages
                            width: '100%',
                            marginLeft: 0,
                            marginRight: 0,
                            boxSizing: 'border-box'
                        }}>
                            {/* Room name skeleton */}
                            <Skeleton 
                                variant="text" 
                                width="40%" 
                                height={28}
                                sx={{ marginBottom: '8px' }}
                            />
                            {/* Room description lines */}
                            <Skeleton variant="text" width="90%" height={20} sx={{ marginBottom: '4px' }} />
                            <Skeleton variant="text" width="85%" height={20} sx={{ marginBottom: '4px' }} />
                            <Skeleton variant="text" width="70%" height={20} />
                        </Box>
                    </MessageComponent>
                </Box>

                {/* Message skeletons - mix of left and right aligned */}
                {[1, 2, 3, 4].map((index) => {
                    const isRight = index % 2 === 0
                    return (
                        <Box key={index} sx={{ marginBottom: '12px' }}>
                            <MessageComponent
                                leftIcon={
                                    !isRight ? (
                                        <Box sx={{ height: "100%", display: 'flex', alignItems: 'end', paddingBottom: '5px' }}>
                                            <Skeleton variant="circular" width={40} height={40} />
                                        </Box>
                                    ) : undefined
                                }
                                leftGutter={70}
                                rightIcon={
                                    isRight ? (
                                        <Box sx={{ height: "100%", display: 'flex', alignItems: 'end', paddingBottom: '5px' }}>
                                            <Skeleton variant="circular" width={40} height={40} />
                                        </Box>
                                    ) : undefined
                                }
                                rightGutter={70}
                            >
                                <Box sx={{
                                    background: (theme: any) => (theme.palette.extras?.paleGradient || 'rgba(0, 0, 0, 0.05)'),
                                    padding: '10px 15px',
                                    borderRadius: '15px',
                                    marginRight: '10px',
                                    marginLeft: isRight ? 'auto' : '10px',
                                    width: isRight ? '70%' : '65%'
                                }}>
                                    {/* Character name skeleton */}
                                    <Skeleton variant="text" width="30%" height={20} sx={{ marginBottom: '6px' }} />
                                    {/* Message text skeletons */}
                                    <Skeleton variant="text" width="100%" height={16} sx={{ marginBottom: '4px' }} />
                                    <Skeleton variant="text" width={index % 3 === 0 ? '90%' : '100%'} height={16} />
                                </Box>
                            </MessageComponent>
                        </Box>
                    )
                })}
            </Box>

            {/* Input area skeleton */}
            <Box sx={{
                gridArea: 'input',
                width: '100%',
                padding: '10px'
            }}>
                <MessageComponent
                    leftIcon={
                        <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            height: '100%',
                            paddingLeft: '10px',
                            paddingRight: '10px',
                            minWidth: '80px'
                        }}>
                            <Skeleton variant="text" width={60} height={24} />
                        </Box>
                    }
                    leftGutter={100}
                    rightIcon={
                        <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'flex-end',
                            height: '100%',
                            gap: '8px',
                            paddingRight: '10px'
                        }}>
                            <Skeleton variant="circular" width={32} height={32} />
                            <Skeleton variant="circular" width={32} height={32} />
                        </Box>
                    }
                    rightGutter={160}
                >
                    <Box sx={{
                        padding: '10px 15px',
                        marginRight: '10px',
                        marginLeft: '10px'
                    }}>
                        <Skeleton 
                            variant="rectangular" 
                            width="100%" 
                            height={60}
                            sx={{ borderRadius: '4px' }}
                        />
                    </Box>
                </MessageComponent>
            </Box>
        </Box>
    )
}

export default MessagePanelSkeleton
