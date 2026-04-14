/**
 * Centralized theme factory for Make The World application.
 * 
 * This factory creates Material UI themes with a consistent visual language
 * while allowing distinctiveness through different color palettes.
 * 
 * ## Purpose
 * 
 * The factory takes base colors and derives a complete theme with:
 * - Primary and secondary color palettes
 * - Extras palette (gradients, pale colors, section styling, etc.)
 * - Consistent structure across all themes
 * 
 * This ensures that all themes in the application share the same visual language
 * while maintaining distinctiveness (e.g., workbench vs chat spine).
 * 
 * ## Usage Examples
 * 
 * ```typescript
 * // Character themes (single color)
 * const blueTheme = createMakeTheWorldTheme({ primary: blue })
 * const pinkTheme = createMakeTheWorldTheme({ primary: pink })
 * 
 * // Workbench theme (two colors for depth)
 * const workbenchTheme = createMakeTheWorldTheme({ 
 *     primary: orange, 
 *     secondary: deepOrange 
 * })
 * 
 * // With base theme (for dark mode support)
 * const theme = createMakeTheWorldTheme({ 
 *     primary: blue, 
 *     baseTheme: parentTheme 
 * })
 * ```
 * 
 * ## Migration Pattern
 * 
 * **As we standardize visual elements, we will:**
 * 
 * 1. **Make components depend on themes from this factory**
 *    - When refactoring or developing new visual elements (chips, badges, etc.),
 *      design them to use theme properties rather than hardcoded colors
 *    - Example: Instead of `blue[500]`, use `theme.palette.primary.main` or
 *      `theme.palette.extras.chipGradient` (once added)
 * 
 * 2. **Extend factory options as needed**
 *    - As we encounter new visual patterns that need theme-based styling,
 *      we will extend the `extras` palette in `theme/extensions.ts`
 *    - We will then update this factory to populate those new properties
 *    - This allows centralized control while maintaining flexibility
 * 
 * 3. **Expected growth**
 *    - The factory options will naturally expand over time as we standardize
 *      more visual elements (chips, badges, tooltips, etc.)
 *    - Each new pattern discovered will inform the theme structure
 * 
 * ## Example Migration: MiniChip Component
 * 
 * Currently, `MiniChip` uses hardcoded `blue` colors:
 * ```typescript
 * background: linearGradient(blue, 500, 700)
 * ```
 * 
 * After migration, it would use theme:
 * ```typescript
 * const theme = useTheme()
 * background: theme.palette.extras.chipGradient
 * ```
 * 
 * This requires:
 * 1. Adding `chipGradient` to `theme/extensions.ts` `extras` interface
 * 2. Adding `chipGradient` derivation to this factory
 * 3. Updating `MiniChip` to use `theme.palette.extras.chipGradient`
 * 
 * This pattern ensures all chips across the app can be styled consistently
 * while maintaining theme-specific colors.
 */

import { createTheme, Theme, ThemeOptions } from '@mui/material/styles'
import { grey } from '@mui/material/colors'

// Import theme extensions to ensure module augmentation is applied
import './extensions'

/**
 * Material UI color palette type.
 * Colors from @mui/material/colors are objects with numeric keys (50, 100, 200, ... 900)
 */
export type MaterialUIColor = Record<string | number, string>

export interface MakeTheWorldThemeOptions {
    /**
     * Primary color palette (e.g., orange, blue, pink)
     * Used for primary actions, main UI elements, and as the base for gradients
     */
    primary: MaterialUIColor
    
    /**
     * Optional secondary color palette (e.g., deepOrange)
     * If not provided, uses the primary color for secondary actions
     * Used to create visual depth and complement the primary color
     */
    secondary?: MaterialUIColor
    
    /**
     * Optional base theme to extend
     * Useful for inheriting dark mode settings, typography, etc.
     */
    baseTheme?: Theme
    
    /**
     * Optional overrides for specific theme options
     * Allows fine-tuning while maintaining the consistent structure
     */
    overrides?: Partial<ThemeOptions>
}

/**
 * Creates a Make The World theme with a consistent visual language.
 * 
 * The theme includes:
 * - Primary/secondary color palettes derived from input colors
 * - Extras palette with gradients, pale colors, and section styling
 * - Consistent structure that components can rely upon
 * 
 * @param options - Theme configuration options
 * @returns A Material UI theme configured with Make The World visual language
 */
export const createMakeTheWorldTheme = (options: MakeTheWorldThemeOptions): Theme => {
    const { primary, secondary, baseTheme, overrides } = options
    
    // Use secondary color if provided, otherwise use primary
    const secondaryColor = secondary ?? primary
    
    // Derive primary palette from primary color
    const primaryPalette = {
        main: primary[600],
        light: primary[400],
        dark: primary[800],
        contrastText: '#fff',
    }
    
    // Derive secondary palette from secondary color
    const secondaryPalette = {
        main: secondaryColor[600],
        light: secondaryColor[400],
        dark: secondaryColor[800],
        contrastText: '#fff',
    }
    
    // Build extras palette with consistent structure
    const extras = {
        // Character theme colors (used in chat spine)
        midPale: primary[100],
        pale: primary[50],
        paleTransparent: `${primary[50]} transparent`,
        paleGradient: `linear-gradient(${primary[50]} 30%, ${primary[100]})`,
        stripedGradient: `
            repeating-linear-gradient(
                45deg,
                transparent,
                transparent 10px,
                ${primary[50]}80 10px,
                ${primary[50]}80 20px
            ),
            linear-gradient(white 70%, ${primary[50]})
        `,
        /** System / out-of-world chat lines (WorldOOCMessage); neutral stripes, not character-primary. */
        stripedGradientGrey: `
            repeating-linear-gradient(
                45deg,
                transparent,
                transparent 10px,
                ${grey[200]}80 10px,
                ${grey[200]}80 20px
            ),
            linear-gradient(white 70%, ${grey[100]})
        `,
        
        // Workbench-specific colors (used in authoring workbench)
        // These use the primary color to maintain consistency
        sectionBorder: primary[500],
        sectionBackground: primary[50],
        sectionHeaderBackground: primary[100],
        sidebarBackground: primary[50],
        sidebarBorder: primary[500],
        headerGradient: `linear-gradient(75deg, ${primary[200]}, ${primary[50]})`,
    }
    
    // Build the theme
    const themeOptions: ThemeOptions = {
        palette: {
            primary: primaryPalette,
            secondary: secondaryPalette,
            
            // Inherit from base theme if provided
            background: baseTheme?.palette.background ?? {
                default: '#fff',
                paper: '#fff',
            },
            text: baseTheme?.palette.text ?? {
                primary: 'rgba(0, 0, 0, 0.87)',
                secondary: 'rgba(0, 0, 0, 0.6)',
                disabled: 'rgba(0, 0, 0, 0.38)',
            },
            divider: baseTheme?.palette.divider ?? 'rgba(0, 0, 0, 0.12)',
            
            // Standard semantic colors (inherit from base or use defaults)
            error: baseTheme?.palette.error ?? {
                main: '#d32f2f',
                light: '#ef5350',
                dark: '#c62828',
                contrastText: '#fff',
            },
            warning: baseTheme?.palette.warning ?? {
                main: '#ed6c02',
                light: '#ff9800',
                dark: '#e65100',
                contrastText: '#fff',
            },
            info: baseTheme?.palette.info ?? {
                main: '#0288d1',
                light: '#03a9f4',
                dark: '#01579b',
                contrastText: '#fff',
            },
            success: baseTheme?.palette.success ?? {
                main: '#2e7d32',
                light: '#4caf50',
                dark: '#1b5e20',
                contrastText: '#fff',
            },
            
            // Extras palette with consistent structure
            extras,
        },
        
        // Apply any overrides
        ...overrides,
    }
    
    // Create theme, extending base theme if provided
    if (baseTheme) {
        return createTheme(baseTheme, themeOptions)
    } else {
        return createTheme(themeOptions)
    }
}

/**
 * Convenience function for creating themes with a single color
 * (useful for character themes where primary and secondary are the same)
 */
export const createMakeTheWorldThemeFromColor = (
    color: MaterialUIColor,
    baseTheme?: Theme,
    overrides?: Partial<ThemeOptions>
): Theme => {
    return createMakeTheWorldTheme({
        primary: color,
        baseTheme,
        overrides,
    })
}
