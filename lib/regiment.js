'use strict';

const os = require('os');
const cluster = require('cluster');

const DEFAULT_DEADLINE_MS = 15000;

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

  const numCpus = os.cpus().length;
  let running = true;

  const deadline = options.deadline || DEFAULT_DEADLINE_MS;
  const numWorkers = options.numWorkers || numCpus;

  function messageHandler(msg) {
    if (running && msg.cmd && msg.cmd === 'need_replacement') {
      const workerId = msg.workerId;
      const replacement = spawn();
      replacement.on('listening', (address) => {
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
    worker.process.kill();
    ensureDeath(worker);
  }

  function ensureDeath(worker) {
    setTimeout(() => { worker.kill() }, deadline).unref();
    worker.disconnect();
  }

  function respawn(worker, code, signal) {
    if (running && !worker.suicide) {
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
    for (var id in cluster.workers) {
      kill(cluster.workers[id]);
    }
  }

  listen();
  fork();
}

Regiment.middleware = require('./middleware');

module.exports = Regiment;
