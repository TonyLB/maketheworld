export const reservedFields = ['name', 'key', 'value', 'zone', 'connection']

export const mapProjectionFields = (projectionFields: string[]): { ProjectionFields: string[], ExpressionAttributeNames: Record<string, string> } => {
    return projectionFields.reduce<{ ProjectionFields: string[], ExpressionAttributeNames: Record<string, string> }>((previous, projectionField) => {
        if (reservedFields.includes(projectionField.toLowerCase())) {
            return {
                ProjectionFields: [
                    ...previous.ProjectionFields,
                    `#${projectionField.toLowerCase()}`
                ],
                ExpressionAttributeNames: {
                    ...previous.ExpressionAttributeNames,
                    [`#${projectionField.toLowerCase()}`]: projectionField
                }
            }
        }
        return {
            ...previous,
            ProjectionFields: [
                ...previous.ProjectionFields,
                projectionField
            ]
        }
    }, { ProjectionFields: [], ExpressionAttributeNames: {} })
}

export default mapProjectionFields