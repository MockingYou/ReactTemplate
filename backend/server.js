const cluster = require("cluster");
const fs = require("fs");
const {log,logerr} = require('./server_utils')
   

if(__dirname.includes('\\snapshot\\'))//PROD MODE CU THREADURI
    {   if(cluster.isMaster)
            runmaster()
        else runchild();
    }
else{   log("STARTING SERVER DEV MODE");////DEV MODE   PE UN SINGUR THREAD TOATE
        require('./server_tasks')
        require('./server_tls')
        require('./server_web')
    }




    


function runchild()
    {   if(process.env.WorkerName=="TOOLS")
            {   log("[TSK]>STARTUP "+process.env.WorkerName);   
                require('./server_tasks')
            }
        else if(process.env.WorkerName.startsWith("TLS"))
            {   log("[TLS]>STARTUP "+process.env.WorkerName);   
                require('./server_tls')
            }
        else if(process.env.WorkerName.startsWith("WEB"))
            {   log("[WEB]>STARTUP "+process.env.WorkerName);   
                require('./server_web')
            }

    }


function runmaster()
    {   log("[MST]>SERVER START-UP");     
        let workertools,workerTLS0,workerTLS1,workerTLS2,workerWEB0,workerWEB1,workerWEB2,workerWEB3,workerWEB4,workerWEB5;
    
        workertools = cluster.fork({WorkerName: "TOOLS"});
        workerTLS0  = cluster.fork({WorkerName: "TLS0",THREADID:0});
        workerWEB0  = cluster.fork({WorkerName: "WEB0",THREADID:0});

        //if(JSON.parse(fs.readFileSync('config.json')).multythreaded)
            {
                workerTLS1  = cluster.fork({WorkerName: "TLS1",THREADID:1});
                workerTLS2  = cluster.fork({WorkerName: "TLS2",THREADID:2});
        
                workerWEB1  = cluster.fork({WorkerName: "WEB1",THREADID:1});
                workerWEB2  = cluster.fork({WorkerName: "WEB2",THREADID:2});
                workerWEB3  = cluster.fork({WorkerName: "WEB3",THREADID:3});
                workerWEB4  = cluster.fork({WorkerName: "WEB4",THREADID:4});
                workerWEB5  = cluster.fork({WorkerName: "WEB5",THREADID:5});
            }

        // setTimeout(() => {
        //     workerTLS0.destroy();  
        // }, 5000);
        cluster.on("exit", function(worker, code, signal){
            if(worker==workertools){ workertools = cluster.fork({WorkerName: "TOOLS"}); log("THREAD TOOLS is DEAD, restarting");}

            else if(worker==workerTLS0){ workerTLS0  = cluster.fork({WorkerName: "TLS0",THREADID:0}); log("THREAD TLS0 is DEAD, restarting");}
            else if(worker==workerTLS1){ workerTLS1  = cluster.fork({WorkerName: "TLS1",THREADID:1}); log("THREAD TLS1 is DEAD, restarting");}
            else if(worker==workerTLS2){ workerTLS2  = cluster.fork({WorkerName: "TLS2",THREADID:2}); log("THREAD TLS2 is DEAD, restarting");}

            else if(worker==workerWEB0){ workerWEB0  = cluster.fork({WorkerName: "WEB0",THREADID:0}); log("THREAD WEB0 is DEAD, restarting");}
            else if(worker==workerWEB1){ workerWEB1  = cluster.fork({WorkerName: "WEB1",THREADID:1}); log("THREAD WEB1 is DEAD, restarting");}
            else if(worker==workerWEB2){ workerWEB2  = cluster.fork({WorkerName: "WEB2",THREADID:2}); log("THREAD WEB2 is DEAD, restarting");}
            else if(worker==workerWEB3){ workerWEB3  = cluster.fork({WorkerName: "WEB3",THREADID:3}); log("THREAD WEB3 is DEAD, restarting");}
            else if(worker==workerWEB4){ workerWEB4  = cluster.fork({WorkerName: "WEB4",THREADID:4}); log("THREAD WEB4 is DEAD, restarting");}
            else if(worker==workerWEB5){ workerWEB5  = cluster.fork({WorkerName: "WEB5",THREADID:5}); log("THREAD WEB5 is DEAD, restarting");}

            else if(!cluster.isMaster)logerr("[MST]UNKNOWN THREAD is DEAD, CAN'T RESTART");
        });

    }


// //all-4 threads
// require('./server_web')
// //3 threads
// require('./server_tls')
// //single threaded
// require('./server_tasks')



// function killWorker(worker)
// {
//     return function() {
//         worker.destroy();  
//     };
// }

// // This should be run on cluster.isMaster only
// function killWorkers()
// {
//     let delay = 0;
//     for (let id in cluster.workers) {
//         let func = killWorker(cluster.workers[id]);
//         if(delay==0)
//             func();
//         else
//             setTimeout(func, delay);
//         delay += 60000 * 5;// 5 minute delay, inserted to give time for each worker to re-spool itself
//     }
// }