'use strict';

const axios = require('axios');
const cluster = require('cluster');
const express = require('express');
const app = express();
const config = require('./config.json');

const handleRelayData = async (body) => {
    if (config.endpoints.length === 0) {
        return null;
    }
    for (const endpoint of config.endpoints) {
        console.log(`Relaying to ${endpoint}: ${body}`);
        await axios({
            url: endpoint,
            data: body,
            method: 'POST',
        });
    }
};

(async () => {
    // Check if cluster node is master or child
    if (cluster.isMaster) {
        console.log(`[Cluster] Master ${process.pid} is running`);

        // Fork workers
        for (let i = 0; i < config.clusters; i++) {
            cluster.fork();
        }

        // If worker gets disconnected, start new one. 
        cluster.on('disconnect', (worker) => {
            console.error(`[Cluster] Worker disconnected with id ${worker.id}`);
            let newWorker = cluster.fork();
            console.log('[Cluster] New worker started with process id %s', newWorker.process.pid);
        });
    
        cluster.on('online', (worker) => {
            console.log(`[Cluster] New worker online with id ${worker.id}`);
        });

        cluster.on('exit', (worker, code, signal) => {
            console.log(`[Cluster] Worker ${worker.process.pid} died with error code ${code}`);
        });
    } else {
        // Body parsing middleware
        app.use(express.json({ limit: '50mb' }));
        //app.use(express.raw({ limit: '50mb' }));

        // Parsing routes
        app.get('/', (req, res) => res.send('OK'));
        app.post('/raw', handleRelayData);
        app.post('/test', (req, res) => console.log(`Received: ${req.body}`));

        app.listen(config.port, config.host, () => console.log(`Listening on ${config.host}:${config.port}...`));
    }
})();