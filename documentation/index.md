# Developer Documentation

- [Foundational Concepts](foundations.md)
- 



#### template.yaml

This describes the infrastructure requirements of the pieces of Make The World that actually make it run.  This file creates the main stack,
which has just a *ton* of stuff.  A small sampling:
- DynamoDB tables for *ephemera* and *messages*
- Several Lambda function (the AWS solution for running code in the cloud) that act as glue to make sure that data is consistent
- A real-time API for connection to the client, so that the system can know quickly when somebody closes their tab (no more of that tedious
problem of people losing their connection but not formally logging out)

