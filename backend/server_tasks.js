const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const {generatereport,gethash,setAudit,buildtoken,getAuth,log,logerr,
       isparamvalidstring,isparamvalidint, createDBPool, processimportuserscsv,
       logwarn,updateshifts}=require('./server_utils')


const config = JSON.parse(fs.readFileSync('config.json'));

let settings = {
        tokenlifetimehours:48,
        // syncusersstamp:-1,
        rowsperinsert:100,
        // monthmiddledate:15,
        runscanssync:0,
        runuserssync:0,
        extendedlogging:0,
        createdevuser:0,
        syncscansinterval:5,
        syncusersinterval:5,
        lastdaytogenreport:0,
        pingInterval: 300
}

let timercountsyncscans = 0;
let timercountsyncusers = 0;
// let userssynced=false;

const dbPool = createDBPool(config.db);




//==========================================SYNCING SETTINGS
setInterval(() => {     syncsettings(); }, 7000);
setTimeout(() => {      syncsettings(); }, 1500);
async function syncsettings()
    {
        try {	const result = await dbPool.query("SELECT data,name from Settings;");
                settingslastsync = new Date().getTime();

                result.recordset.forEach(elem => {
                    if(typeof elem.data=='string')  elem.data = parseInt(elem.data);

                    if(elem.name=="rowsperinsert")  settings.rowsperinsert = elem.data;
                    // else if(elem.name=="monthmiddledate")    settings.monthmiddledate=elem.data;
                    else if(elem.name=="runuserssync")  settings.runuserssync = elem.data;
                    else if(elem.name=="runscanssync")  settings.runscanssync = elem.data;
                    // else if(elem.name=="syncusersstamp"&&settings.syncusersstamp<elem.data)  syncusers(elem.data);
                    else if(elem.name=="extendedlogging")   settings.extendedlogging = elem.data;
                    else if(elem.name=="createdevuser")     settings.createdevuser = elem.data;
                    else if(elem.name=="syncscansinterval") settings.syncscansinterval = elem.data;
                    else if(elem.name=="syncusersinterval") settings.syncusersinterval = elem.data;
                    else if(elem.name=="lastdaytogenreport")settings.lastdaytogenreport = elem.data;
                    else if(elem.name=="pingInterval")      settings.pingInterval = elem.data;
                });
			}
		catch(err)
			{   logerr(err);
		    }
    }
//==========================================CHECKING IF SETTINGS ARE PRESENT
setInterval(() => {     checksettingspresent(); }, 60000);
setTimeout(() => {      checksettingspresent(); }, 5000);
let descriptionforsettings =
    {   tokenlifetimehours: { data: 48,     min: 1, max : 9999999,  printname : "Delogare dupa(ore)"},
        syncusersstamp:     { data: 10,     min: -2,max : 9999999999999999, printname : "Actualizat utilizatori la"},
        rowsperinsert:      { data: 100,    min: 1, max : 999,  printname : "Inserari per query"},
        monthmiddledate:    { data: 15,     min: 1, max : 31,   printname : "Ultima data din raport(1\/2 din luna)"},
        runscanssync:       { data: 0,      min: 0, max : 1,    printname : "Sincronizare scanari carduri incedo"},
        runuserssync:       { data: 0,      min: 0, max : 1,    printname : "Sincronizare utilizatori incedo"},
        extendedlogging:    { data: 0,      min: 0, max : 1,    printname : "Logare detaliata"},
        createdevuser:      { data: 1,      min: 0, max : 1,    printname : "Generare automata utilizator [dev]"},
        syncscansinterval:  { data: 2,      min: 1, max : 7,    printname : "Interval descarcare scanari incedo(minute)"},
        syncusersinterval:  { data: 10,     min: 1, max : 999999,printname : "Interval sincronizare utilizatori incedo(minute)"},
        lastIncedoScansId:  { data: 9999999,min: 0, max : 9999999999999999,printname : "Ultimul id Scanare Incedo."},
        lastdaytogenreport: { data: 2,      min: 1, max : 31, printname : "Ultima zi generare rapoarte luna trecuta."},
        maxlateminutes1:    { data: 10,     min: 0, max : 59, printname : "Intarziere maxima(minute) (pierdere 30 min)."},
        maxlateminutes2:    { data: 30,     min: 0, max : 59, printname : "Intarziere maxima(minute) (pierdere o ora)."},
        roundtohour:        { data: 0,      min: 0, max : 1, printname : "Rotunjire la ora(bifat), 30min(nebifat)."},
        scanignoreinterval: { data: 15,     min: 15,max : 120, printname : "Interval minim intre scanari (minute)."},
        singlescanner:      { data: 0,      min: 0, max : 1, printname : "1 scanner/usa(bifat), 2 scannere/usa(nebifat)"},
        pingInterval:       { data: 5 * 60, min: 20,max: 30 * 60, printname: "Interval verificare cititoare carduri (secunde)"},
        use15rounding:      { data: 1,      min: 0, max : 1, printname : "Activare algoritm rotunjire la 15 minute."},
        useadvrounding:     { data: 1,      min: 0, max : 1, printname : "Activare algoritm rotunjire avansata."},
        nightstart:         { data: 22,     min: 0, max : 24, printname : "Ora incepere noapte."},
        morningend:         { data: 6,      min: 0, max : 24, printname : "Ora terminare noapte."},
        finalizeascsv:      { data: 1,      min: 0, max : 1,  printname : "Format finalizare raport.(bifat csv, nebifat xlsx)"},
        lockonfinalize:     { data: 0,      min: 0, max : 1,  printname : "Blocare finalizare raport dupa finalizare."},
        allowfindaysbefore: { data: 25,      min: 0, max : 31, printname : "Zile permitere finaliz. inainte de sfarsit luna."},
    }

async function checksettingspresent() {
    try {
        const result = await dbPool.query("SELECT * from Settings;");

        const toinsert = [];
        const toUpdate = [];
        let forInsertAudit = "";
        let forUpdateAudit = "";
        Object.keys(descriptionforsettings).forEach(key => {
            let found = false;
            let currentElement;

            result.recordset.forEach(elem => {
                if(elem.name == key) {
                    found = true;
                    currentElement = elem;
                }
            });

            if (!found) {
                let s = descriptionforsettings[key]
                toinsert.push("('" + key + "'," + s.data+",'" + s.printname + "'," + s.min+"," + s.max+")");
                forInsertAudit += key + ",";
            }
            else {
                let initialData = currentElement.data;
                let sql = "";

                currentElement.data = Math.max(currentElement.data, currentElement.min);
                currentElement.data = Math.min(currentElement.data, currentElement.max);

                sql += "UPDATE Settings SET min = " + currentElement.min +
                ", max = " + currentElement.max +
                ", printname = '" + currentElement.printname + "'";
                if (initialData != currentElement.data) {
                    sql += ", data = " + currentElement.data;
                    forUpdateAudit += key + ",";
                }
                sql += " WHERE id = " + currentElement.id + ";"

                toUpdate.push(sql);
            }
        });

        if (toinsert.length > 0) {
            await dbPool.query("INSERT INTO Settings(name,data,printname,min,max) VALUES" + toinsert.join(',') + ";");

            forInsertAudit = forInsertAudit.slice(0, -1);
            log("[TSK]Missing settings, added:" + toinsert.join(','))
            setAudit(-2,"Tasks","Added setings:" + forInsertAudit,dbPool.pool)
        }

        if (toUpdate.length > 0) {
            await dbPool.query(toUpdate.join(""));

            if (forUpdateAudit.length > 0) {
                forUpdateAudit = forUpdateAudit.slice(0, -1);
                log("[TSK]Out of range settings value, modified:" + forUpdateAudit);
                setAudit(-2,"Tasks","Modified setings:" + forUpdateAudit, dbPool.pool);
            }
        }
    }
    catch(err) {
        logerr(err);
    }
}


setTimeout(() => { findUnusedSettingsInDB(); }, 5000);

async function findUnusedSettingsInDB() {
    try {
        const result = await dbPool.query("SELECT * from Settings;");
        let unusedSettings = [];

        result.recordset.forEach(elem => {
            if (!descriptionforsettings.hasOwnProperty(elem.name)) {
                unusedSettings.push(elem.name);
            }
        });
        if(unusedSettings.length > 0)
            logwarn("Found unused settings in DB: " + unusedSettings.join(", "));
    }
    catch(err) {
        logerr(err);
    }
}

//==========================================SYNC SCANS & SYNC USERS WITH INCEDO
let isusersyncinprogress=false;
let isscansyncinprogress=false;
// try {   const task_syncscans = require('./server_import_scans.js');
//         const task_syncusers = require('./server_crud_users.js');


//         setTimeout(async () =>
//             {   try {   if(settings.runuserssync == 1 && !isusersyncinprogress)
//                             {   isusersyncinprogress=true;
//                                 await task_syncusers.syncUsers();
//                                 isusersyncinprogress=false;
//                             }


//                         if(settings.runscanssync == 1 && !isscansyncinprogress)
//                             {   isscansyncinprogress=true;
//                                 await task_syncscans.syncScans();
//                                 isscansyncinprogress=false;
//                             }
//                     }
//                 catch(err)
//                     {   logerr(err);
//                         isscansyncinprogress=false;
//                         isusersyncinprogress=false;
//                     }
//             }, 5000);


//         setInterval(async () =>
//             {   //sync scans
//                 try {   if(settings.runscanssync == 1 && !isscansyncinprogress)
//                             {   timercountsyncscans++;
//                                 if(timercountsyncscans>=settings.syncscansinterval)
//                                     {   isscansyncinprogress=true;
//                                         await task_syncscans.syncScans();
//                                         timercountsyncscans=0;
//                                         isscansyncinprogress=false;
//                                     }

//                             }
//                     }
//                 catch(err){logerr(err);isscansyncinprogress=false;}
//             }, 60*1000);
//         setInterval(async () =>
//             {//sync users
//                 try {   if(settings.runuserssync == 1 && !isusersyncinprogress)
//                             {   timercountsyncusers++;
//                                 if(timercountsyncusers>=settings.syncusersinterval)
//                                     {   isusersyncinprogress=true;
//                                         await task_syncusers.syncUsers();
//                                         timercountsyncusers=0;
//                                         isusersyncinprogress=false;
//                                     }
//                             }
//                     }
//                 catch(err){logerr(err);isusersyncinprogress=false;}
//             }, 60*1000);
//     }
// catch (error)
//     {   logerr(error)
//     }

//===============================================READ FILE IMPORT USERS
setInterval(() => {     readFileImportUsers(); }, 3600000);
setTimeout(() => {      readFileImportUsers(); }, 8000);
async function readFileImportUsers() {
    try {
        // process automated at 1 AM
        if(new Date().getHours() != 1) { return; }

        //checks if file exists
        let fullPathCSV = `${config.systemImportUsersPath}`
        if (!fs.existsSync(fullPathCSV)) {
            log("[TSK]Nu exista fisier pentru importarea angajatilor")
            return;
        }

        //for settings
        await syncsettings()
        //for users
        const usermapping=
            {   //username:{},
                //id:{},
                cardid:{},
                matricol:{},
                //name:{},//for adding vacations get id from name
            }
        let resultusers = await dbPool.query("SELECT * from Users WHERE deactivated=0;")
        // usermapping.username={}
        // usermapping.name={}
        // usermapping.id={}
        usermapping.cardid={}
        usermapping.matricol={}
        resultusers.recordset.forEach(user => {
            // if(typeof user.username ==='string'&&user.username.length>0)usermapping.username[user.username]=user;
            // usermapping.id[user.id]=user;
            if(user.cardid1&&user.cardid1.length>0)usermapping.cardid[user.cardid1]=user;
            if(user.cardid2&&user.cardid2.length>0)usermapping.cardid[user.cardid2]=user;
            usermapping.matricol[user.matricol]=user
            // usermapping.name[user.name]=user
        });
        //for subgroups
        const subGroupMapping = {
            keyRef: {},
            //id:{}
        };
        let {recordset} = await dbPool.query("SELECT * from SubGroups");
        //subGroupMapping.id = {};
        subGroupMapping.keyRef = {}
        recordset.forEach(subGroup => {
            //subGroupMapping.id[subGroup.id] = subGroup;
            if(typeof subGroup.key_ref=='string'&&subGroup.key_ref.length > 5)subGroupMapping.keyRef[subGroup.key_ref] = subGroup;
        })

        let content = fs.readFileSync(fullPathCSV).toString()
        let result = await processimportuserscsv(content,settings,usermapping,subGroupMapping, dbPool)

        if (result.error.length > 0) {
            logerr(result.error)
            return
        } else {
            log('[TSK]Inserted '+result.addedusers+' users.');
            log('[TSK]Updated '+result.updatedusers+' users.');
            setAudit(-2,"TSK","Importare utilizatori: adaugati:"+result.addedusers+", actualizati:"+result.updatedusers,dbPool);
            let importdonepath = `${config.systemImportUsersDone}`
            if (!fs.existsSync(importdonepath)) {
                fs.mkdirSync(importdonepath);
            }
            let filename = path.basename(fullPathCSV);
            let movedfilepath = path.resolve(importdonepath, filename)
            fs.rename(fullPathCSV, movedfilepath, (err) => {
                if(err) throw err;
                else log("[TSK]Moved import users csv in 'done' directory.")
            })
        }
    } catch (error) {
        logerr(error)
        return;
    }
}

//===============================================GENERATE REPORTS
setInterval(checkreports,3600000);
setTimeout(checkreports, 10000);
async function checkreports()
    {   const date = new Date();
        let year = date.getFullYear(), month = date.getMonth(), day = date.getDate(), hour = date.getHours();

        if(hour != 2) { return; }
        log("[TSK]Checking reports...");
        let dates = [];

        dates.push(year*100+month);
        if(day <= settings.lastdaytogenreport+1)//+1 because it is generated in the morning 2am the day after the last one
            {   month--; if(month<0) {month+=12;year--;}
                dates.push(year*100+month);
            }

        let usermapping = {};
        try {   const result = await dbPool.query("SELECT * from Users WHERE deactivated=0;");
                result.recordset.forEach(user => {  usermapping[user.id]=user;  });
            }
        catch (error) {logerr(error);}



        try {   const result = await dbPool.query("SELECT * from SubGroups;");
                let generatedcount=0;
                for(let i=0;i<result.recordsets[0].length;i++)
                    {   const subgr=result.recordsets[0][i];
                        if(subgr.name.toLowerCase().includes('transfer'))continue;
                        for(let j=0;j<dates.length;j++)
                            {   const d=dates[j];
                                const lockedPath = config.systemClockingLockedPath+""+Math.trunc(d/100)+"\\"+(("0"+((d%100+1).toString())).slice(-2))+"\\";
                                const filename=subgr.key_ref.split("-").reverse().join("-")+"_L.lock";
                                if(!fs.existsSync(lockedPath+filename))
                                    {   await generatereport(Math.trunc(d/100),d%100,usermapping,dbPool.pool,subgr.id);
                                        log("[TSK]Report for "+d+"/"+subgr.key_ref+" GENERATED!");
                                        generatedcount++;
                                    }
                            }
                    }
                setAudit(-2,"Tasks","Generare automata raport "+dates.join(',')+" pentru "+generatedcount+" subgr.",dbPool.pool);
            }
        catch(err)
            {   logerr(err);
            }
        // if(!anyreportgenerated)log("[TSK]No report to generate.")
    }



//===============================================GENERATE META INFO SCANS FOR DASHBOARD
setInterval(() => {
    generatemetascans();
}, 10*60000);

generatemetascans();
async function generatemetascans()
    {   let start = new Date(); start.setHours(0,0,0,0);
        start = start.getTime();
        const end = start+24*3600*1000

        try{    const part1 = "(SELECT COUNT(id) as count FROM Users WHERE ispresent=1)";
                const part2 = "(SELECT COUNT(id) as count FROM Users WHERE waspresent=1)";
                const part3 = "(SELECT COUNT(id) as count FROM Scans WHERE stamp>"+start+" AND stamp<"+end+")";
                const part4 = "(SELECT COUNT(id) as count FROM Users WHERE islate=1)";
                const part5 = "(SELECT COUNT(id) as count FROM Users WHERE isovertime=1)";

                const sql = "INSERT INTO Metascans(stamp,userspresent,userstotal,scancount,latecount,overtimecount) VALUES("+new Date().getTime()+","+part1+","+part2+","+part3+","+part4+","+part5+");";

                await dbPool.query(sql);

                //reset totals
                const now = new Date();
                if(now.getHours()==0 && now.getMinutes()<11)
                    await dbPool.query("UPDATE USERS SET waspresent=0 WHERE id>-1;");
            }
        catch(err)
            {   logerr(err);}
    }



//===============================================CREATE MISSING LOCATION
setTimeout(() =>  {  createmissinglocation();   }, 2000);
setInterval(() => {  createmissinglocation();   }, 60000);
async function createmissinglocation()
    {   try{    if((await dbPool.query("SELECT * FROM Locations WHERE name='Locatie lipsa'")).recordset.length<1)
                    {   await dbPool.query("INSERT INTO Locations(name) VALUES('Locatie lipsa')");
                        log("[TSK]Created missing location element.")
                    }
            }
            catch(err)
            {   logerr(err);}
    }
//===============================================RESET SUBGROUP EDIT HISTORY TO FALSE
setTimeout(() =>  {  locksubgroups();   }, 2000);
setInterval(() => {  locksubgroups();   }, 3600*1000);//every hour
async function locksubgroups()
    {   try{    if(new Date().getHours()==2)//if its 2am
                    {   await dbPool.query("UPDATE SubGroups SET editclockinghistory=0,editactivityhistory=0,editvacationhistory=0 WHERE id>-1;");
                        log("[TSK]Reset edithistory for subgroups to false.")
                    }
            }
        catch(err)
            {   logerr(err);}
    }

//===============================================CHECK LOCATION STATUS

setInterval(() => { checkLocationStatus(); }, 10 * 1000);

let secondsSinceLastPing = Infinity;

async function checkLocationStatus() {
    secondsSinceLastPing += 10;
    if(secondsSinceLastPing >= settings.pingInterval) {
        secondsSinceLastPing = 0;
    }
    else {
        return;
    }
    try {
        let locations = (await dbPool.query("SELECT id, ip, status FROM Locations WHERE deactivated = 0;")).recordset;
        let queries = [];
        let numberOfLocations = locations.length;
        for(let location of locations) {
            let startStamp = Date.now();
            exec("ping " + location.ip, async (err) => {
                let currentStamp = Date.now();
                if(err || currentStamp - startStamp > 5 * 1000) {
                    if(settings.extendedlogging)
                        logwarn("Ping failed ID: " + location.id);
                    if(location.status === 'ONLINE')
                        logwarn(`Location with id: ${location.id} and IP: ${location.ip} is now OFFLINE.`);
                    sql = "UPDATE Locations SET last_checked_stamp = " + currentStamp + ", status = 'OFFLINE' WHERE id = " + location.id + ";";
                    queries.push(sql);
                    numberOfLocations--;
                    if(numberOfLocations === 0) {
                        await dbPool.query(queries.join(""));
                    }
                    return;
                }
                if(location.status === 'OFFLINE')
                    logwarn(`Location with id: ${location.id} and IP: ${location.ip} is now ONLINE.`);
                sql = "UPDATE Locations SET last_checked_stamp = " + currentStamp + ", last_online_stamp = " + currentStamp + ", status = 'ONLINE' WHERE id = " + location.id + ";";
                numberOfLocations--;
                queries.push(sql);
                if(numberOfLocations === 0) {
                    await dbPool.query(queries.join(""));
                }
            });
        }
    }
    catch (err) {
        logerr(err);
    }
}

//===============================================CREATE DEFAULT SHIFT
setTimeout(() => {  createdefaultshift();    }, 2000);
setInterval(() => {  createdefaultshift();   }, 60000);
async function createdefaultshift()
    {   try{    if((await dbPool.query("SELECT * FROM Shifts WHERE name='Tura implicita'")).recordset.length<1)
                    {   await dbPool.query("INSERT INTO Shifts(name,hours,starthour,endhour,clamp) VALUES('Tura implicita',8,7,15,1)");
                        log("[TSK]Created default shift element.")
                    }
            }
            catch(err)
            {   logerr(err);}
    }

//===============================================UPDATE SHIFTS FOR EACH USER
setTimeout(() => {      syncshifts(); }, 12_000);
setTimeout(() => {      setInterval(() => {     syncshifts(); }, 600_000);//10 minutes
                 }, 60_000);//delay the start of 10 minutes by 1 minute (so 11min, 21min..51min)
async function syncshifts()
{
    try {
        const d = new Date();
        // let hour = d.getHours() + ':' + d.getMinutes()
        // process automated between 0:00 to 0:10 AM
        if(d.getHours()!=0 || d.getMinutes()>10) { return; }
        await updateshifts(dbPool,-1)
	} catch(err) {
        logerr(err);
	}
}


setInterval(() => {     checkIsLate(); }, 300_000);//5min
setTimeout(() => {      checkIsLate(); }, 10_000);
async function checkIsLate() {
    const d = new Date();
    // let hour = d.getHours();
    let time=d.getHours()*60+d.getMinutes();
    if(time<12)return;//to not run it in the same time as the updateshifts at 00am
    try {
        //let result=
        await dbPool.query("UPDATE Users set islate=0,isovertime=0;"+
                            "UPDATE Users set islate=1 WHERE ispresent=0 AND shiftstart*30<"+time+" AND shiftend*30>"+time+";"+
                            "UPDATE Users set isovertime=1 WHERE ispresent=1 AND shiftend*30<"+time+";");

        //don't download the table and then upload back when you can do changes directly on the db, as we talked
        //elem.shiftstart < hour < elem.shiftend  is incorrect
        // const result = await newDBPool.query("SELECT islate,isovertime,ispresent,shiftstart,shiftend,id from Users;");
        // result.recordset.forEach(async elem => {
        //     if(elem.ispresent == 0 && elem.shiftstart < hour < elem.shiftend) { await newDBPool.query("UPDATE Users SET islate = 1 WHERE id=" + elem.id) }
        //     if(elem.ispresent == 1 && elem.shiftend < hour) {
        //         await newDBPool.query("UPDATE Users SET isovertime = 1 WHERE id=" + elem.id)
        //     } else if(elem.ispresent == 0 && elem.shiftend < hour) {
        //         await newDBPool.query("UPDATE Users SET isovertime = 0 WHERE id=" + elem.id)
        //     }
        //     if(elem.shiftend < hour && elem.isovertime == 0) { await newDBPool.query("UPDATE Users SET islate = 0 WHERE id=" + elem.id) }
        // });
    } catch(err) {
        logerr(err);
    }
}
//===============================================CREATE TRANSFER SUBGROUP
setTimeout(() => {  createtransfersubgroup();    }, 1000);
setInterval(() => {  createtransfersubgroup();   }, 60000);
async function createtransfersubgroup()
    {   try{    if((await dbPool.query("SELECT TOP 1 * FROM SubGroups WHERE name='Transferare'")).recordset.length<1)
                    {   if((await dbPool.query("SELECT TOP 1 * FROM Groups;")).recordset.length<1)
                            {   if((await dbPool.query("SELECT TOP 1 * FROM Units;")).recordset.length<1)
                                    {   await dbPool.query("INSERT INTO Units(name) VALUES ('TRANSFER');");
                                    }
                                const unitid = (await dbPool.query("SELECT TOP 1 * FROM Units;")).recordset[0].id;

                                await dbPool.query("INSERT INTO Groups(name,unit_id,code,key_ref) VALUES ('Transfer',"+unitid+",'TR','TRANSFER');");
                            }
                        const groupid=(await dbPool.query("SELECT TOP 1 * FROM Groups;")).recordset[0].id;

                        await dbPool.query("INSERT INTO SubGroups(name,group_id,code,key_ref) VALUES('Transferare',"+groupid+",'TRANSF','TRANSFER')");
                        log("[TSK]Created transfer subgroup.")
                    }
            }
            catch(err)
            {   logerr(err);}
    }
//====================================CREATE DEFAULT USER
setTimeout(() => { createdefaultuser();}, 5000);
setInterval(() => {createdefaultuser();}, 30000);
async function createdefaultuser()
    {   if(settings.createdevuser!=1) return;
        try{    const result = await dbPool.query("SELECT TOP 1 * FROM Users WHERE username='dev';");
                if(result.recordset.length>0) return;
                log("[TSK]Inserting default user....");

                let matricol = 1, subgroup =-1, permissionid =-1;
                result=await dbPool.query("SELECT TOP 1 * FROM Users order by matricol DESC;"+
                                          "SELECT * FROM Permissions;"+
                                          "SELECT TOP 1 * FROM SubGroups;");
                if(result.recordsets[0].length>0)   matricol = Math.max(result.recordsets[0][0].matricol+1,matricol);
                for(let i=0; i<result.recordsets[1].length; i++)  if(result.recordsets[1][i].name=='Admin')   {permissionid = result.recordsets[1][i].id; break;}
                if(permissionid<0 && result.recordsets[1].length>0)   {permissionid=result.recordsets[1][0].id;}
                if(result.recordsets[2].length>0)   subgroup = result.recordsets[2][0].id;

                await dbPool.query("INSERT INTO Users(matricol,name,last_name,first_name,username,hash,cardid1,permission_id,sub_group_id) "+
                                    "VALUES("+matricol+",'Dev','Cont','Admin','dev','daff4f3ec798a5095ccd24ef0aba3237','1880511749',"+permissionid+","+permissionid+");"+
                                    "UPDATE Settings SET data="+(new Date().getTime())+" WHERE name='syncusersstamp';");
                log("[TSK]Created default user dev.");
            }
        catch(err)
            {   logerr(err);

                return;
            }
    }
//====================================CREATE DEFAULT PERMISSION GROUP
setTimeout(() => {  createadmingroup();    }, 1000);
setInterval(() => {  createadmingroup();   }, 60000);
async function createadmingroup()
    {   try{    const result = await dbPool.query("SELECT TOP 1 * FROM Permissions WHERE name='Admin'");
                if(result.recordset.length<1)
                    {   await dbPool.query("INSERT INTO Permissions(name,p_admin, p_permissions) VALUES('Admin',1,1);");
                        log("[TSK]Created Admin permission group.")
                    }
                else{   if(result.recordset[0].p_admin!=1)
                            {   await dbPool.query("UPDATE Permissions SET p_admin=1 WHERE name='Admin';");
                                log("[TSK]Enabled admin privileges for Admin group.")
                            }
                    }
            }
        catch(err)
            {   logerr(err);}
    }

//====================================CREATE DEFAULT ACTIVITY SLOTS
setTimeout(() => {  createactivityslots();    }, 5000);
setInterval(() => {  createactivityslots();   }, 60000);
async function createactivityslots()
    {   try{    const result = await dbPool.query("SELECT COUNT(id) as count FROM Activitytypes;");
                if(result.recordset[0].count<15)
                    {   let toinsert = ["(1,'Securitate si Sanatate in Munca','SSM')","(2,'Situatii Urgenta','SU')","(3,'Sindicat','SIND')"];
                        for(let i=4; i<21; i++)   toinsert.push("("+i+",'','')");

                        await dbPool.query("INSERT INTO Activitytypes(slot,name,code) VALUES"+(toinsert.join(','))+";");
                        log("[TSK]Created Activity types slots.")
                    }
            }
        catch(err)
            {   logerr(err);}
    }

//====================================SUBGROUP SCHEDULE MAPPING
setTimeout(() => {  updatesubgrschedule();   }, 8000);
setInterval(() => { updatesubgrschedule();   }, 3600000);
async function updatesubgrschedule()
    {   try{    let month = new Date().getMonth()+1;
                let year = new Date().getFullYear();
                //INSERT
                let bathch = 100;//get from settings in future
                let keepgoing = true;
                let sql = "SELECT TOP "+bathch+" u.id,u.sub_group_id FROM Users u WHERE u.deactivated=0 AND u.id NOT IN (SELECT TOP 1 sc.userid FROM Subgrschedule sc WHERE sc.userid=u.id AND sc.year="+year+");"
                let header = "INSERT INTO Subgrschedule(userid,year,s1,s2,s3,s4,s5,s6,s7,s8,s9,s10,s11,s12) VALUES"
                while(keepgoing)
                    {   keepgoing = false;
                        let {recordset} = await dbPool.query(sql);
                        if(recordset.length>0)
                            {   let pieces = [];
                                recordset.forEach(user=>{   pieces.push("("+user.id+","+year+((","+user.sub_group_id).repeat(12))+")");    });
                                await dbPool.query(header+pieces.join(",")+";");
                                log("Created Subgr schedule for "+recordset.length+" users.")
                                keepgoing = true;
                            }
                    }
                //UPDATE
                let monthcolumns = [];
                for(let i=month;i<13;i++)   monthcolumns.push("sc.s"+i+"=u.sub_group_id");
                sql="UPDATE sc SET "+(monthcolumns.join(','))+" FROM Users u INNER JOIN Subgrschedule sc on u.id=sc.userid WHERE sc.year="+year+";";
                await dbPool.query(sql);
            }
        catch(err)
            {   logerr(err);}
    }