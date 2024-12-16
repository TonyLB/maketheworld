# How does Make The World work (tech stack)

Okay, technical talk here, feel free to glaze over and move to the next section ... or perk your ears up, if this is your jam.

Make The World is a serverless build on the Amazon Web Services platform.  When someone creates an instance, the Serverless Application
Repository instantiates a CloudFormation stack in their account (independent of any other Make-The-World resources anywhere else in
the world), and CloudFormation then creates all the structures needed to support their game instance.

### CloudFormation resources

CloudFormation is the AWS solution for *Infrastructure as Code*, which means basically "I write some code *describing* what a set of cloud
resources to look like, then CloudFormation *creates* those resources when I ask it to."  Make The World uses two distinct templates, to
create two *Stacks* (CloudFormation's way of grouping a set of resources created together).

#### template.yaml

This describes the infrastructure requirements of the pieces of Make The World that actually make it run.  This file creates the main stack,
which has just a *ton* of stuff.  A small sampling:
- DynamoDB tables for *ephemera* and *messages*
- Several Lambda function (the AWS solution for running code in the cloud) that act as glue to make sure that data is consistent
- A real-time API for connection to the client, so that the system can know quickly when somebody closes their tab (no more of that tedious
problem of people losing their connection but not formally logging out)

### The system in operation

So, suppose you've run the install, and it worked out fine (fingers crossed!)  You noticed that the only server (even virtual) that gets instantiated
by the system also gets *decommissioned* at the end of the install process.  If you (like me) came up in the programming era of the 90s and 00s, you
can knock around the AWS system all you want (I'd recommend starting in the EC2 area) trying to answer the immediate question "Where is my server?  Where
is Make The World *running*?"

It's not there.  Don't panic.  That's not how serverless systems work.  Make The World creates computing resources in response to events.  If nobody is
on your system, then the system is nothing but inert storage and a web-site.  When someone logs in to the web-site ... well then, things get going:  Each
time a user does something that requires changes to the system, AWS apportions a tiny fraction of a virtual server's time, loads the needed code from
a high-speed cache in a miniscule fraction of a second, does what needs to be done and then takes the resources back.

At its best (which we aspire to), serverless architecture means that the compute resources just *work*, the way you can plug a television into the wall
and just get electricity: CPU cycles, hot and cold, on tap from AWS's incalculably robust supply.  Likewise, all of the data resources are stored
in AWS serverless solutions ... they respond to requests, but you don't have to think of them as actually *residing* anywhere.  There is no server
that can get struck by lightning, or upgraded wrong by your service company.  What there is instead is a world-spanning *network* of servers, supporting
a pretty hefty chunk of our information economy ... and we get to peel off penny-sized increments of that power for our own purposes.

Some days I really enjoy living in the future.