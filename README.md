# Make The World

Make The World is a cloud platform for creating worlds and telling stories together, in text, on the web. The system
provides the tools for a group to create and explore a world together, and for that world to be available any time
someone goes to it (and if you are already wondering ["What's the catch?"](#theCatch), I applaud your realism and direct you down the page).

Make The World is not a tool you install on your home computer: It is cloud-native, residing in AWS (Amazon Web
Services) and accessible through any web-browser (okay, *most* web-browsers, ain't nobody got time to keep supporting
old version of Internet Explorer). When you go to its web-site, it provides, at the highest level, two ways to
interact and collaborate:

### Playing

To explore the world and tell stories with the other members of your community, you play the role of a character in
the fictional space (much as with any table-top roleplaying game, like Dungeons & Dragons). The interface for this
looks, deliberately, like the love-child of an old text-adventure game (e.g. Zork or Planetfall) with a modern
chat application.

When you play a character, that character will be in some particular play (internally labelled, inaccurately but
usefully, as a "room") in the fictional space ... something created by someone in the community. Maybe you when you
just start a new world, maybe someone you've never met in a world that already has a history of community authorship.

If you type dialogue in then everyone who is playing a character in the same fictional place ("room") will get
notified and can respond the same way: Strike up a conversation, that's much of what roleplaying is.

If you type in a command (like "kiss the frog") the MTW system will do its level best to figure out what you are
trying to do, whether you can do it, and to play out the effects. As you might guess **this is the hard part**.
Show compassion for the poor system, language processing and weak-AI are still very much in their early stages.
The long-term goal for MTW is to have an automated "game-master" that is capable of playing along with the
interesting situations that players create for and between each other. I repeat: *Long-term goal*. Not today.

And, of course, many of the simplest and most useful commands are those for exploring: Moving from one place in
the world to another, looking carefully at things in the environment, drawing connections and maybe solving puzzles.

### Creating

To create a world for others to explore, you engage with MTW's suite of collaboration tools: These look much more
like a document editor or database tool than a chat window. Everything (and I really do mean *everything*) about these
systems is still in flux, and being prototyped, but the general goal is a system that lets any user do the following:

- Create worlds that are as big or as little as you want, including different versions of things other people have
contributed ... and view those *privately* with those who agree to check them out, but not push them in front of the
entire audience until you...
- Workshop your creations (if you choose) with the community to both get feedback, and get signoff on whether your
ideas are ones that should be part of the world everyone sees. Perhaps folks will agree with your magical little town showing up *when someone wants to tell a story* about it, but will not agree to it being accessible all the time, to anyone. Fiction and communities can be complicated that way.
- Leverage weak AI as a ghost-writer to reduce the sheer mind-numbing tedium of describing absolutely *everything* when all you really care about is (for instance) "This is a spooky cave" and "Spiders!"

# <a name="theCatch"></a>What's the catch?

If you've paid even a little attention, you're likely aware that running cloud-native applications on AWS can get
expensive, and running even weak AI can get **really** expensive. You may even be noting that nowhere in this
document is any description of subscription fees, or any other way to subsidize all these expenses. You might
even be remembering the old adage "If you don't see the product being sold, then **you** are the product."

Which, yeah, fair to worry about. Not accurate in this case, but very fair.

So here's the thing: I really, really don't want to create some monetized mess that only the monied can afford to
play around with. I've seen communities like the ones MTW aims to support founder (several times) on the
inequality of "Such-and-so is paying for the MUD server, so they get their say in the fiction, because nobody
else wants to pony up the cost."

Not to toot my own horn, but I am pretty darn savvy at the AWS ecosystem, and as I've pursued this project I have
done so always by finding the nooks and crannies where AWS **isn't** making very much money: Make The World is built
entirely on the interstitial scale-to-zero microservices that exist to connect the big money-makers to each other.
That means that everything about the system, top to bottom, scales sub-linearly with usage: Twice as many users
cost substantially less than twice as much, and when nobody is using the system (which is the basic reality for
communities just starting up), the costs over time are measured in double-digit pennies *per month*. The goal, even
with AI involved, is to create a system that anybody can afford to experiment with, and which doesn't cost more than
about ten dollars per month to host until you're serving a community of dozens, if not hundreds, of people.

And *that* is the origin of the real catch: Anything that doesn't fit into that *budget* has not gone into the system.
That means that the AI is slow and limited, the warm-up from hibernation when you're the first user to log on is
pretty noticeable, the response time for even simple requests can be triple-digit milliseconds rather than single.

In short, Make The World is a Honda Civic, not a Lamborghini. That's the catch that comes along with not getting
on the treadmill of "Make fancier features to justify the runaway costs of the previous fancy features." The system
is frugal by design, and it performs like it.

# Wishlist for V2 alpha development

Here are some of the things I'm looking to continue to add as the V2 alpha proceeds toward a beta state:

- Vastly improved AI tooling
- More robust moderation tools, to deal with potential bad actors (spammers, trolls, etc.)
- In-game Objects you can pick up, drop, use, manipulate, give and receive.
- Character-local properties (i.e. differing strengths and weaknesses, different knowledge-bases)
- Asynchronous messaging, to leave folks in-game notes even when they're not present
- Scene requests, to tell people what you'd like to play and what kind of people would help you do it
- Story authoring tools to create automated quests, riddles and events that people can opt into
- Story instancing, so different groups can have their own versions of the same story, and work
through them imdependently

# Resources

If you want to dig even further, here are some gateway links to the rest of Make The World's documentation:

- [Create your own MTW service](./documentation/awsAccount/index.md): This is mostly a guide for creating your own AWS
account, for the non-technical. If you already *have* an AWS account, deploying MTW is almost trivial.
- [Development Documentation](./documentation/index.md): If you want to develop your own, better, version of the MTW
code-base using this as a starting point then the Development Documentation section is where you should start.

## License Summary

This code is made available under a modified MIT license. See the LICENSE file.
