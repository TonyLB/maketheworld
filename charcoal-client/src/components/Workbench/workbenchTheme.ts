import type { Theme } from '@mui/material'
import { useTheme } from '@mui/material'
import { orange, deepOrange } from '@mui/material/colors'

// Import theme extensions as side-effect to ensure module augmentation is applied
import '../../theme/extensions'
import { createMakeTheWorldTheme } from '../../theme/createMakeTheWorldTheme'

/**
 * Creates a Material UI theme for the Authoring Workbench.
 * 
 * This theme is designed to give the workbench a visually distinctive look
 * that differentiates it from the chat spine (play mode).
 * 
 * The theme uses the centralized `createMakeTheWorldTheme` factory to ensure
 * consistency with the overall visual language while maintaining distinctiveness
 * through orange/amber color tones.
 * 
 * To change the workbench appearance:
 * 1. Modify the color arguments passed to `createMakeTheWorldTheme` below
 * 2. All workbench components will automatically update
 */

/**
 * Creates the workbench theme.
 * 
 * Configured with warm orange/amber tones to visually differentiate the
 * authoring workbench from the chat spine (play mode).
 * 
 * The workbench uses orange as the primary color and deepOrange as the secondary
 * to create a distinctive authoring-focused appearance that contrasts with the
 * default blue used in the chat spine.
 * 
 * @param baseTheme - Optional base theme to extend. If not provided, creates a standalone theme.
 * @returns A Material UI theme configured for the workbench
 */
export const createWorkbenchTheme = (baseTheme?: Theme): Theme => {
    return createMakeTheWorldTheme({
        primary: orange,
        secondary: deepOrange,
        baseTheme,
    })
}

/**
 * Hook to get the workbench theme based on the current parent theme.
 * 
 * This hook reads the parent theme and creates a workbench theme that extends it.
 * Use this when you need the workbench theme to be aware of the parent theme
 * (e.g., for dark mode support).
 * 
 * @returns The workbench theme
 */
export const useWorkbenchTheme = (): Theme => {
    const baseTheme = useTheme()
    return createWorkbenchTheme(baseTheme)
}

/**
 * Default workbench theme (standalone, not extending parent).
 * 
 * Use this when you want a completely independent theme.
 * For most cases, prefer using `useWorkbenchTheme()` hook or
 * `createWorkbenchTheme(useTheme())` to respect parent theme settings.
 */
export const workbenchTheme = createWorkbenchTheme()
