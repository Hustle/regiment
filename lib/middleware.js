var cluster = require('cluster');

function gracefullyDie(server) {
  process.send({ cmd: 'need_replacement', workerId: cluster.worker.id });
}

module.exports = {
  RequestCount: function(maxRequests) {
    var requestCount = 0;
    var dying = false;

    return function(request, response, next) {
      requestCount = requestCount + 1;

      if (!dying && requestCount >= maxRequests) {
        dying = true;
        gracefullyDie(request.socket.server);
      }

      next();
    };
  },

  MemoryFootprint: function(maxRssMb) {
    var dying = false;

    return function(request, response, next) {
      var currentRss = process.memoryUsage().rss / (1024 * 1024);

      if (!dying && currentRss >= maxRssMb) {
        dying = true;
        gracefullyDie(request.socket.server);
      }

      next();
    }
  }
}
