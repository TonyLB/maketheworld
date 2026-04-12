/**
 * Initialize Primitives - Idempotent System Bootstrap
 *
 * This function ensures the primitives asset exists with required system components:
 * - VORTEX room (the initial game location)
 * - STRAIGHTAWAY, CLIFFTOP, CORNER, BRIDGE rooms (Coyote-game demo topology; stable ids for eval / prototypes)
 * - knowledgeRoot knowledge (the root of the knowledge graph)
 * - DEFAULT situation (default facet for room rendering, ShortName Default)
 *
 * IDEMPOTENCY GUARANTEE:
 * - If primitives is fully initialized, this function does nothing (no chunk created)
 * - If primitives is missing components, it applies a repair edit (creates chunk)
 * - If primitives doesn't exist, it creates it from scratch
 * 
 * This differs from applyEdit which would create a no-op chunk even if no changes needed.
 */

import ReadOnlyAssetWorkspace from "@tonylb/mtw-asset-workspace/ts/readOnly"
import type { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { applyEdit } from "../applyEdit"

export const PRIMITIVES_ASSET_ID = 'ASSET#primitives'

// Coyote-game demo rooms (candidates to extract to a separate asset later); VORTEX remains the canonical default origin.
const FULL_PRIMITIVES_WML = `<Asset uuid=(primitives)>
    <Room uuid=(VORTEX) />
    <Room uuid=(STRAIGHTAWAY) />
    <Room uuid=(CLIFFTOP) />
    <Room uuid=(CORNER) />
    <Room uuid=(BRIDGE) />
    <Knowledge uuid=(knowledgeRoot) />
    <Situation uuid=(DEFAULT)>
        <ShortName>Default</ShortName>
    </Situation>
</Asset>`

export async function initializePrimitives(): Promise<{
    success: boolean
    action: 'skipped' | 'created' | 'repaired'
    message: string
    /** Merged schema when action is 'created' or 'repaired' (for publishing Content Update) */
    schema?: StandardForm
}> {
    // Primitives must be in Canon zone - construct workspace directly
    const assetWorkspace = new ReadOnlyAssetWorkspace(PRIMITIVES_ASSET_ID, 'Canon')
    
    // Try to load existing primitives content
    try {
        await assetWorkspace.loadJSON()
        
        const existing = assetWorkspace.standard
        
        // Check if asset doesn't exist or has no content
        if (assetWorkspace.status.json === 'Error' || !existing || existing._components.length === 0) {
            const result = await applyEdit({
                AssetId: PRIMITIVES_ASSET_ID,
                RequestId: `initialize-primitives-create-${Date.now()}`,
                schema: FULL_PRIMITIVES_WML,
                createIfNeeded: true,
                zone: 'Canon'
            })
            
            return result.success
                ? {
                    success: true,
                    action: 'created' as const,
                    message: 'Primitives asset created',
                    schema: result.schema
                }
                : {
                    success: false,
                    action: 'created' as const,
                    message: `Failed to create primitives: ${result.error}`
                }
        }
        
        // Check for required components using byUniversalId
        const hasVortex = Boolean(existing.byUniversalId['ROOM#VORTEX'])
        const hasStraightaway = Boolean(existing.byUniversalId['ROOM#STRAIGHTAWAY'])
        const hasClifftop = Boolean(existing.byUniversalId['ROOM#CLIFFTOP'])
        const hasCorner = Boolean(existing.byUniversalId['ROOM#CORNER'])
        const hasBridge = Boolean(existing.byUniversalId['ROOM#BRIDGE'])
        const hasKnowledgeRoot = Boolean(existing.byUniversalId['KNOWLEDGE#knowledgeRoot'])
        const hasDefaultSituation = Boolean(existing.byUniversalId['SITUATION#DEFAULT'])

        // Case 2a: Already properly initialized
        if (
            hasVortex &&
            hasStraightaway &&
            hasClifftop &&
            hasCorner &&
            hasBridge &&
            hasKnowledgeRoot &&
            hasDefaultSituation
        ) {
            return {
                success: true,
                action: 'skipped',
                message: 'Primitives already initialized (no changes needed)'
            }
        }
                
        // Build edit that adds only the missing components
        const repairComponents: string[] = []
        if (!hasVortex) {
            repairComponents.push('    <Room uuid=(VORTEX) />')
        }
        if (!hasStraightaway) {
            repairComponents.push('    <Room uuid=(STRAIGHTAWAY) />')
        }
        if (!hasClifftop) {
            repairComponents.push('    <Room uuid=(CLIFFTOP) />')
        }
        if (!hasCorner) {
            repairComponents.push('    <Room uuid=(CORNER) />')
        }
        if (!hasBridge) {
            repairComponents.push('    <Room uuid=(BRIDGE) />')
        }
        if (!hasKnowledgeRoot) {
            repairComponents.push('    <Knowledge uuid=(knowledgeRoot) />')
        }
        if (!hasDefaultSituation) {
            repairComponents.push('    <Situation uuid=(DEFAULT)>\n        <ShortName>Default</ShortName>\n    </Situation>')
        }

        const repairWML = `<Asset uuid=(primitives)>\n${repairComponents.join('\n')}\n</Asset>`
        
        const result = await applyEdit({
            AssetId: PRIMITIVES_ASSET_ID,
            RequestId: `initialize-primitives-repair-${Date.now()}`,
            schema: repairWML
        })
        
        if (result.success) {
            return {
                success: true,
                action: 'repaired',
                message: `Primitives repaired (added ${repairComponents.length} missing component(s))`,
                schema: result.schema
            }
        } else {
            console.error('Initialize Primitives: Repair failed', result)
            return {
                success: false,
                action: 'repaired',
                message: `Primitives repair failed: ${result.error}`
            }
        }
        
    } catch (error) {
        console.error('Initialize Primitives: Error checking/repairing existing primitives', error)
        return {
            success: false,
            action: 'repaired',
            message: `Failed to check/repair primitives: ${error instanceof Error ? error.message : String(error)}`
        }
    }
}

export default initializePrimitives
