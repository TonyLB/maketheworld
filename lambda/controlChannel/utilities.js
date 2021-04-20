const AWS = require('aws-sdk')

const { AppSync, gql } = require('/opt/appsync')
require('cross-fetch/polyfill')

const { AWS_REGION } = process.env;

exports.documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })
exports.graphqlClient = new AppSync.AWSAppSyncClient({
    url: process.env.APPSYNC_ENDPOINT_URL,
    region: process.env.AWS_REGION,
    auth: {
      type: 'AWS_IAM',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN
      }
    },
    disableOffline: true
  })
exports.gql = gql
exports.SNS = new AWS.SNS()
