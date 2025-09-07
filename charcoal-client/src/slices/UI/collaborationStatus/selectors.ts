import { CollaborationStatusPublic } from './baseClasses'

export const getCollaborationStatus = (publicData: CollaborationStatusPublic) => {
    return publicData.status
}

export const getCollaborationStatusPhase = (publicData: CollaborationStatusPublic) => {
    return publicData.status?.phase || 'Bootstrap'
}

export const isCollaborationStatusLoading = (publicData: CollaborationStatusPublic) => {
    return publicData.loading || false
}

export const getCollaborationStatusError = (publicData: CollaborationStatusPublic) => {
    return publicData.status?.phase === 'Error'
}

export const publicSelectors = {
    getCollaborationStatus,
    getCollaborationStatusPhase,
    isCollaborationStatusLoading,
    getCollaborationStatusError
}
