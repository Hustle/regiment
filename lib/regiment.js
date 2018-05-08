'use strict';

const os = require('os');
const cluster = require('cluster');

const DEFAULT_DEADLINE_MS = 30000;

function makeWorker(workerFunc) {
  var server = workerFunc(cluster.worker.id);

  server.on('close', function() {
    process.exit();
  });

  process.on('SIGTERM', function() {
    server.close();
  });

  return server;
}

const Regiment = function(workerFunc, options) {
  if (cluster.isWorker) return makeWorker(workerFunc);

  options = options || {};

  const numCpus = os.cpus().length;
  let running = true;

  const deadline = options.deadline || DEFAULT_DEADLINE_MS;
  const numWorkers = options.numWorkers || numCpus;
  const logger = options.logger || console;

  function messageHandler(msg) {
    if (running && msg.cmd && msg.cmd === 'need_replacement') {
      const workerId = msg.workerId;
      const replacement = spawn();
      logger.log(`Replacing worker ${workerId} with worker ${replacement.id}`);
      replacement.on('listening', (address) => {
        logger.log(`Replacement ${replacement.id} is listening, killing ${workerId}`);
        kill(cluster.workers[workerId]);
      })
    }
  }

  function spawn() {
    const worker = cluster.fork();
    worker.on('message', messageHandler);
    return worker;
  }

  function fork() {
    for (var i=0; i<numWorkers; i++) {
      spawn();
    }
  }

  function kill(worker) {
    logger.log(`Killing ${worker.id}`);
    worker.process.kill();
    ensureDeath(worker);
  }

  function ensureDeath(worker) {
    setTimeout(() => {
      logger.log(`Ensured death of ${worker.id}`);
      worker.kill();
    }, deadline).unref();
    worker.disconnect();
  }

  function respawn(worker, code, signal) {
    if (running && !worker.exitedAfterDisconnect) {
      logger.log(`Respawning ${worker.id} after it exited`);
      spawn();
    }
  }

  function listen() {
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    cluster.on('exit', respawn);
  }

  function shutdown() {
    running = false;
    logger.log(`Shutting down!`);
    for (var id in cluster.workers) {
      kill(cluster.workers[id]);
    }
  }

  listen();
  fork();
}

Regiment.middleware = require('./middleware');

module.exports = Regiment;
