const REGION = process.env.AWS_REGION
export const lambdaClient = new LambdaClient({ region: REGION })

export default lambdaClient
