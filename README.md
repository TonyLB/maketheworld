# BurnedOverMush

This is the code base for the BurnedOverMUSH serverless multi-user environment.  Right now, this is lifted directly from the code and template for the simple-websocket-chat-app.  There are three functions contained within the directories and a SAM template that wires them up to a DynamoDB table and provides the minimal set of permissions needed to run the app:

```
.
├── README.md                   <-- This instructions file
├── onconnect                   <-- Source code onconnect
├── ondisconnect                <-- Source code ondisconnect
├── sendmessage                 <-- Source code sendmessage
└── template.yaml               <-- SAM template for Lambda Functions and DDB
```


# Deploying to your account

Install the [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html) and use it to package, deploy, and describe your application.  These are the commands you'll need to use:

First, deploy the permanent storage stack for the world:
```
aws cloudformation deploy \
    --template-file .\permanentsTemplate.yaml \
    --stack-name BurnedOverPermanentsStack \
    --capabilities CAPABILITY_IAM
```

Next deploy the running application stack:

```
sam package \
    --template-file template.yaml \
    --output-template-file packaged.yaml \
    --s3-bucket REPLACE_THIS_WITH_YOUR_S3_BUCKET_NAME

sam deploy \
    --template-file packaged.yaml \
    --stack-name BurnedOverStack \
    --capabilities CAPABILITY_IAM

aws cloudformation describe-stacks \
    --stack-name BurnedOverStack --query 'Stacks[].Outputs'
```

## Deploying separate development stacks

If you want to develop new code, you probably want separate stacks with separate resources, so as not to disturb
your production environment (the one players are actually interacting with).  Create a separate stack by running
the deploy commands again, with some changes and overrides.

First, deploy the permanent storage stack for the world:
```
aws cloudformation deploy \
    --template-file .\permanentsTemplate.yaml \
    --stack-name BurnedOverDevPermanentsStack \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides TablePrefix=burnedoverdev
```

Next deploy the running application stack:

```
sam package \
    --template-file template.yaml \
    --output-template-file packaged.yaml \
    --s3-bucket REPLACE_THIS_WITH_YOUR_DEV_S3_BUCKET_NAME

sam deploy \
    --template-file packaged.yaml \
    --stack-name BurnedOverDevStack \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides TablePrefix=burnedoverdev PermanentsStack=BurnedOverDevPermanentsStack

aws cloudformation describe-stacks \
    --stack-name BurnedOverDevStack --query 'Stacks[].Outputs'
```


## Testing the chat API

To test the WebSocket API, you can use [wscat](https://github.com/websockets/wscat), an open-source command line tool.

1. [Install NPM](https://www.npmjs.com/get-npm).
2. Install wscat:
``` bash
$ npm install -g wscat
```
3. On the console, connect to your published API endpoint by executing the following command:
``` bash
$ wscat -c wss://{YOUR-API-ID}.execute-api.{YOUR-REGION}.amazonaws.com/{STAGE}
```
4. To test the sendMessage function, send a JSON message like the following example. The Lambda function sends it back using the callback URL: 
``` bash
$ wscat -c wss://{YOUR-API-ID}.execute-api.{YOUR-REGION}.amazonaws.com/prod
connected (press CTRL+C to quit)
> {"message":"sendmessage", "data":"hello world"}
< hello world
```

## License Summary

This code is made available under a modified MIT license. See the LICENSE file.
