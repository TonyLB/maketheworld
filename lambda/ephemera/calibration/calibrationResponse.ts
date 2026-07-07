export type CalibrationRouteResponse = {
    statusCode: number
    body: string
}

export const calibrationJsonResponse = (
    statusCode: number,
    payload: Record<string, unknown>
): CalibrationRouteResponse => ({
    statusCode,
    body: JSON.stringify(payload),
})
