var cluster = require('cluster');

function gracefullyDie(server, reason) {
  process.send({
    cmd: 'need_replacement',
    workerId: cluster.worker.id,
    reason
  });
}

module.exports = {
  RequestCount: function(maxRequests) {
    var requestCount = 0;
    var dying = false;

    return function(request, response, next) {
      requestCount = requestCount + 1;

      if (!dying && requestCount >= maxRequests) {
        dying = true;
        gracefullyDie(request.socket.server, `Request count limit of ${maxRequests} reached!`);
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
        gracefullyDie(request.socket.server, `Memory footprimit limit of ${maxRssMb} reached!`);
      }

      next();
    }
  }
}
