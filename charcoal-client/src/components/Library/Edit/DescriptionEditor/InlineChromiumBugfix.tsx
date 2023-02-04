import Box from '@mui/material/Box'

// Put this at the start and end of an inline component to work around this Chromium bug:
// https://bugs.chromium.org/p/chromium/issues/detail?id=1249405
export const InlineChromiumBugfix = () => (
    <Box
        component="span"
        contentEditable={false}
        sx={{ fontSize: 0 }}
    >
        ${String.fromCodePoint(160) /* Non-breaking space */}
    </Box>
)

export default InlineChromiumBugfix
