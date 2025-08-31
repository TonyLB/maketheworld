import { CacheSessionConnectionsData } from './sessionCache'
import { unique } from '@tonylb/mtw-utilities/ts/lists'

// Type constraint for internalCache that has SessionConnections property
export interface InternalCacheWithSessionConnections {
    SessionConnections: CacheSessionConnectionsData
}

// Target types that can be resolved
export type ResolvableTarget = `SESSION#${string}` | `CONNECTION#${string}` | `!SESSION#${string}` | `!CONNECTION#${string}`

export class TargetResolver {
    private internalCache: InternalCacheWithSessionConnections

    constructor(internalCache: InternalCacheWithSessionConnections) {
        this.internalCache = internalCache
    }

    /**
     * Extracts SESSION# targets (excluding exclusions)
     */
    private extractSessionTargets(targets: ResolvableTarget[]): string[] {
        return targets
            .filter(target => target.startsWith('SESSION#') && !target.startsWith('!SESSION#'))
            .map(target => target.replace('SESSION#', ''))
    }

    /**
     * Extracts CONNECTION# targets (excluding exclusions)
     */
    private extractConnectionTargets(targets: ResolvableTarget[]): string[] {
        return targets
            .filter(target => target.startsWith('CONNECTION#') && !target.startsWith('!CONNECTION#'))
            .map(target => target.replace('CONNECTION#', ''))
    }

    /**
     * Extracts SESSION# exclusion targets
     */
    private extractSessionExclusions(targets: ResolvableTarget[]): string[] {
        return targets
            .filter(target => target.startsWith('!SESSION#'))
            .map(target => target.replace('!SESSION#', ''))
    }

    /**
     * Extracts CONNECTION# exclusion targets
     */
    private extractConnectionExclusions(targets: ResolvableTarget[]): string[] {
        return targets
            .filter(target => target.startsWith('!CONNECTION#'))
            .map(target => target.replace('!CONNECTION#', ''))
    }

    /**
     * Resolves session IDs to connection IDs using the internal cache
     */
    private async resolveSessionTargets(sessionIds: string[]): Promise<string[]> {
        if (sessionIds.length === 0) {
            return []
        }

        const sessionConnections = await this.internalCache.SessionConnections.get(sessionIds)
        return sessionConnections || []
    }

    /**
     * Applies exclusion patterns to connection IDs
     * @param connections List of connection IDs to filter
     * @param exclusions List of connection IDs to exclude
     * @returns Filtered list of connection IDs
     */
    private applyExclusions(connections: string[], exclusions: string[]): string[] {
        if (!exclusions || exclusions.length === 0) {
            return connections
        }

        const excludedConnections = new Set(exclusions)
        
        return connections.filter(connectionId => {
            return !excludedConnections.has(connectionId)
        })
    }

    /**
     * Resolves a list of Session and Connection IDs (with exclusions) to a list of unique connection IDs
     * @param targets Array of targets including SESSION#, CONNECTION#, and exclusion patterns
     * @returns Promise resolving to array of unique connection IDs
     */
    async resolve(targets: ResolvableTarget[]): Promise<`CONNECTION#${string}`[]> {
        // Extract different target types
        const sessionTargets = this.extractSessionTargets(targets)
        const connectionTargets = this.extractConnectionTargets(targets)
        const sessionExclusions = this.extractSessionExclusions(targets)
        const connectionExclusions = this.extractConnectionExclusions(targets)

        // Resolve session targets and session exclusions in parallel
        const [sessionConnections, sessionExclusionConnections] = await Promise.all([
            this.resolveSessionTargets(sessionTargets),
            this.resolveSessionTargets(sessionExclusions)
        ])
        
        // Combine all connection targets and session connections, ensuring uniqueness
        const allConnections = unique(connectionTargets, sessionConnections)
        
        // Apply exclusions (both connection exclusions and session exclusion connections)
        const allExclusions = unique(connectionExclusions, sessionExclusionConnections)
        const finalConnections = this.applyExclusions(allConnections, allExclusions)
        
        return finalConnections.map((connectionId) => (`CONNECTION#${connectionId}` as const))
    }
}
