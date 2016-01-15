## Regiment - Whip your cluster into shape!

Regiment allows applications to **abuse** the NodeJS cluster module in order to seamlessly replace
workers after certain criteria is met. The goal is to keep the cluster working without dropping
requests.

#### Why would you want this?

 - You have a leak in production and want your application to stay up while you figure out what is
going on or wait for a dependency to fix their leak.

 - You are familiar with `max-old-space-size` and other V8 knobs that crash your application
when the threshold is met instead of gracefully responding to outstanding requests.

#### How does it work?

Workers use middleware to monitor for certain conditions like RSS size or requests served. When the
criteria for replacement is met, a worker signals that it needs to be replaced by sending a message
to the cluster.

The cluster receives the message and spins up a new worker. The cluster listens for the new worker
and sends a signal to the old worker which instructs it to not accept any new connections and to
exit after servicing all current requests. The old worker is then disconnected from the cluster
and receives no new requests.

 - Note: You can have up to 2x `numWorkers` when replacements come online but before the old
ones gracefully die. This is temporary and *by design* as it drops back down to `numWorkers`.

 - Note: By default, the number of workers is set to the number of available CPUs. This module works
just as well on small dynos where the number of CPUs is 1. A new worker is spawned and the old one
is replaced. The default for deadline is 15 seconds. HTTP-Cluster will wait this amount of time
for the worker to die by itself and then forcefully kill it.

#### Installation
```sh
npm install regiment
```

#### Usage w/ Express
```js
var Regiment = require('regiment');
var Express = require('express');

var app = Express();

app.use(Regiment.middleware.RequestCount(1000));   // Replace workers after every 1000 requests
app.use(Regiment.middleware.MemoryFootprint(750)); // Replace workers after rss reaches 750mb

Regiment(function(workerId) { return app.listen(); });          // default options
Regiment(function(workerId) { return app.listen(); }, options); // with options
```

##### Options

```js
{
  numWorkers: 1,  // Number of workers you want -- defaults to number of CPUs
  deadline: 5000, // Milliseconds to wait for worker to gracefully die before forcing death
}
```

##### Deployment Notes

 - On Heroku we've found 750mb memory footprint for 1 worker to be a sweetspot for our application
 on a 2x dyno where we account for startup memory usage of the replacement worker being ~100mb and
 give it a bit of a cushion for memory to balloon during the deadline (grace period).
 - A deadline (grace period) of 30 seconds is optimal for heroku. This is now the default.

#### Thanks

I was heavily inspired by @hunterloftis's Throng library and Forky.
