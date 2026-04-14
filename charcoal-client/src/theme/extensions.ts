/**
 * Centralized Material UI theme extensions for the Charcoal Client.
 * 
 * This file defines TypeScript interface extensions for Material UI themes
 * that are used across the application, including:
 * - Character color themes (chat spine)
 * - Workbench themes (authoring workbench)
 * 
 * By centralizing these definitions, we ensure consistency and avoid
 * duplicate module declarations that would cause TypeScript errors.
 * 
 * This file should be imported as a side-effect (import './theme/extensions')
 * in any file that uses Material UI theme types, to ensure the module
 * augmentation is applied.
 */

// This is a module augmentation - it extends the @mui/material/styles module
// No exports needed, just the declaration
declare module '@mui/material/styles' {
    interface PaletteOptions {
        extras?: {
            // Character theme colors (used in chat spine)
            midPale?: string;
            pale?: string;
            paleTransparent?: string;
            paleGradient?: string;
            stripedGradient?: string;
            stripedGradientGrey?: string;
            
            // Workbench-specific colors (used in authoring workbench)
            sectionBorder?: string;
            sectionBackground?: string;
            sectionHeaderBackground?: string;
            sidebarBackground?: string;
            sidebarBorder?: string;
            headerGradient?: string;
        }
    }
    
    interface Palette {
        extras?: {
            // Character theme colors (used in chat spine)
            midPale?: string;
            pale?: string;
            paleTransparent?: string;
            paleGradient?: string;
            stripedGradient?: string;
            stripedGradientGrey?: string;
            
            // Workbench-specific colors (used in authoring workbench)
            sectionBorder?: string;
            sectionBackground?: string;
            sectionHeaderBackground?: string;
            sidebarBackground?: string;
            sidebarBorder?: string;
            headerGradient?: string;
        }
    }
}
