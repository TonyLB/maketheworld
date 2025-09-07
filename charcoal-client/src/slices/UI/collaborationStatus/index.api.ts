import { CollaborationStatusAction, CollaborationStatusCondition } from './baseClasses'
import { socketDispatchPromise } from '../../lifeLine'
import delayPromise from '../../../lib/delayPromise'
import { getStatus } from '../../lifeLine'

export const lifelineCondition: CollaborationStatusCondition = ({}, getState) => {
    const state = getState()
    const status = getStatus(state)
    return (status === 'CONNECTED')
}

export const fetchCollaborationStatus: CollaborationStatusAction = ({ internalData, publicData, actions }) => 
    async (dispatch) => {
        try {
            const response = await dispatch(socketDispatchPromise({
                message: 'collaborationStatus'
            }, { service: 'asset' }))
            
            return {
                publicData: { 
                    status: response.status,
                    loading: false 
                },
                internalData: { 
                    error: undefined,
                    incrementalBackoff: 0.5 // Reset backoff on success
                }
            }
        } catch (error: any) {
            throw {
                error: error.message || 'Failed to fetch collaboration status',
                incrementalBackoff: Math.min((internalData.incrementalBackoff || 0.5) * 2, 30)
            }
        }
    }

export const backoffAction: CollaborationStatusAction = ({ internalData: { incrementalBackoff = 0.5 }}) => 
    async (dispatch) => {
        if (incrementalBackoff >= 30) {
            throw new Error('Maximum backoff reached')
        }
        await delayPromise(incrementalBackoff * 1000)
        return { 
            internalData: { 
                incrementalBackoff: Math.min(incrementalBackoff * 2, 30) 
            } 
        }
    }
