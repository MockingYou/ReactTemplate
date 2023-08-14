const fs = require('fs');
const crypto = require("crypto");
const mssql = require("mssql");
const XLSX = require("xlsx");
const wkhtmltopdf = require('wkhtmltopdf');
const { exec, execSync } = require("child_process");
const xl = require('excel4node');

//==========================CONSTS
const monthnames = ["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie","Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"];

//==========================LOGGING
function _log(toprint)
    {   const date = new Date();
        const h = ('0'+date.getHours()).slice(-2), min = ('0'+date.getMinutes()).slice(-2), s = ('0'+date.getSeconds()).slice(-2);
        const y = date.getFullYear(), m = ('0'+(date.getMonth()+1)).slice(-2), d = ('0'+date.getDate()).slice(-2);

        console.log(h+":"+min+":"+s+toprint)

        if(!fs.existsSync('logs'))fs.mkdirSync('logs');

        fs.appendFile("logs/"+y+"_"+m+"_"+d+'_log.log',h+":"+min+":"+s+toprint+"\n",()=>{});

        if(toprint.startsWith('[ERR]'))fs.appendFile('logs/errors.log',y+"/"+m+"/"+d+" "+h+":"+min+":"+s+toprint+"\n",()=>{});
    }
function log(toprint)
    {   if(typeof toprint==='object') toprint = JSON.stringify(toprint);
        else if(typeof toprint==='undefined') toprint = 'undefined;'
        else if(typeof toprint!=='string') return;
        _log("[INF]"+toprint);
    }
function logerr(toprint)
    {   if(typeof toprint==='object')
            {   if(typeof toprint.message!=='undefined')
                    toprint = toprint.message+"\n"+toprint.stack
                else toprint = JSON.stringify(toprint);
            }
        else if(typeof toprint==='undefined') toprint = 'undefined;'
        else if(toprint.hasOwnProperty('message')) toprint = toprint.message;
        else if(typeof toprint!=='string') return;
        _log("[ERR]"+toprint);
    }
function logwarn(toprint)
    {   if(typeof toprint==='object') toprint = JSON.stringify(toprint);
        else if(typeof toprint==='undefined') toprint = 'undefined;'
        else if(typeof toprint!=='string') return;
        _log("[WARN]"+toprint);
    }

//==========================PARAMETER VERIFICATION
function isparamvalidint(tocheck)
    {   if(typeof tocheck==="number" || typeof tocheck==="string"&&!isNaN(parseInt(tocheck))) return true;
        return false;
    }
function isparamvalidstring(tocheck)
    {   const specialChracters = /[`%'"]/;
        if(typeof tocheck==="number" || typeof tocheck==="string"&&tocheck!=='undefined'&&tocheck.length>0&&!specialChracters.test(tocheck)) return true;
        return false;
    }
function isparamvalidstringnolen(tocheck)
    {   const specialChracters = /[`%'"]/;
        if(typeof tocheck==="number" || typeof tocheck==="string"&&tocheck!=='undefined'&&(tocheck.length>0&&!specialChracters.test(tocheck)||tocheck.length==0)) return true;
        return false;
    }
function buildwhere(query,separator,params)
    {   let wherepieces = []
        if(typeof query!='string'||!query.startsWith('{')) return wherepieces
        try {   const obj = JSON.parse(query)
                for(let i=0; i<params.length; i++)
                    {   const elem = params[i];
                        if(obj.hasOwnProperty(elem.n))
                            {   if(elem.t=='str'&&isparamvalidstring(obj[elem.n]))
                                    wherepieces.push(elem.r+" LIKE '%"+obj[elem.n]+"%'");
                                else if(elem.t=='nr'&&isparamvalidint(obj[elem.n]))
                                    wherepieces.push(elem.r+" ="+obj[elem.n]+"");
                                else if(elem.t=='nrpos'&&isparamvalidint(obj[elem.n])&&obj[elem.n]>-1)
                                    wherepieces.push(elem.r+" ="+obj[elem.n]+"");
                                else if(elem.t=='date' || elem.t=='datetime') {
                                    if (obj[elem.n].hasOwnProperty('min')&&obj[elem.n].hasOwnProperty('max')){
                                        wherepieces.push(elem.r+">"+obj[elem.n].min+" AND "+elem.r+"<"+obj[elem.n].max)
                                    } else if (obj[elem.n].hasOwnProperty('min')) {
                                        wherepieces.push(elem.r+">"+obj[elem.n].min)
                                    } else if(obj[elem.n].hasOwnProperty('max')) {
                                        wherepieces.push(elem.r+"<"+obj[elem.n].max)
                                    }
                                }
                            }
                    }
            }
        catch (error) { logerr(error);   }
        return wherepieces.length==0?[]:[wherepieces.join(separator)];
    }
//==========================ENCRYPTION
const encryptionkey = crypto.scryptSync("superdupermegasecretpassword", 'salt', 24);
const iv = Buffer.alloc(16, 0)
function encrypt(text)
    {   try {   const cipher = crypto.createCipheriv("aes-192-cbc", encryptionkey, iv);
                const encrypted = cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
                //consol e.log(text+":"+encrypted)
                return encrypted
            }
        catch (error)
            {   return "corruptedData"
            }
    }
function decrypt(hash)
    {   try {
                //consol e.log(typeof hash)
                const decipher = crypto.createDecipheriv("aes-192-cbc", encryptionkey, iv);
                const decrypted = decipher.update(hash, 'hex', 'utf8') + decipher.final('utf8');
                return decrypted
            }
        catch (err)
            {   logerr(err)
                return "corruptedData"
            }
    }
function gethash(data)
    {   let toreturn = encrypt(data+data);
        if(toreturn.length>98) toreturn = toreturn.substring(0,98);
        return toreturn;
        //HASHING WITHOUT SALT IS INSECURE, ENCRYPTING INSTEAD but the db has a limit of 50 for has so wait until you edit that
        //return crypto.createHash("sha256").update(data, "binary").digest("base64");
    }

function buildtoken(name,id,hours)
    {   if(typeof hours!='number') hours = 24;
        return encrypt(name+"|"+id+"|"+(new Date().getTime()+hours*3600000))
    }
function getAuth(users,req)
    {   let resp = {auth:false,error:"Lipsesc date autentificare."};
        let found = "";
        if(typeof req==='string')
            found = req;
        else if(req)if(req.headers.cookie)
            req.headers.cookie.split(';').forEach(element => {
                if(element.trim().startsWith("jwt="))
                    {   found = element.split("=")[1];
                        return;
                    }
                else resp.error="Lipsesc datele autentificare.";
                //consol e.log(encrypt("dev|1925586162000")+" "+decrypt(encrypt("dev|1925586162000")))
                });
        if(found.length>3)
            {   const lines = decrypt(found).split("|");
                if(lines.length<2) resp.error = "Date autentificare corupte. "
                else{   if(new Date().getTime()>parseInt(lines[2]))
                            resp.error = "Datele de autentificare au expirat."
                        else{   found = false;
                                if(users.username.hasOwnProperty(lines[0].toLowerCase()))
                                    {   const user = users.username[lines[0].toLowerCase()];
                                        if(user.username.toLowerCase()==lines[0].toLowerCase())
                                            {   found = true;
                                                resp.auth = true;
                                                resp.id = user.id;
                                                resp.error = "";
                                                resp.name = user.name;
                                                resp.userlocal = user.userlocal;
                                                resp.selectedproj = user.selectedproj;
                                                resp.userref = user;
                                                return resp;
                                            }
                                    }
                                if(!found)resp.error="Utilizatorul nu a fost gasit";
                            }
                    }
            }
        return resp;
    }

//==========================DB
async function setAudit(userid, username, val, dbPool)
    {
        val = val.split("'").join("");
        if(!isparamvalidstring(val)) {logerr("INVALID param val for audit:"+val); return;}
        if(!isparamvalidint(userid)) {logerr("INVALID param userid for audit:"+userid); return;}
        if(val.length>59) val = val.substring(0,59)
        val = val.split("'").join('"');

        const sql = "INSERT INTO Audit(userid,username,stamp,val) VALUES("+userid+",'"+username+"',"+new Date().getTime()+",'"+val+"')";

        try {
            await dbPool.query(sql);
        } catch (error) {
            logerr(error);
        }
    }
function createDBPool(configObject)
    {   let p = {isconnected:false};
        const pool = new mssql.ConnectionPool(configObject);
        let isclosed = false;
        pool.on('error', function(err) {
            if(err) {   logerr("MS SQL ERROR:"); logerr(err.message);  }
            if(!err) {p.isconnected = false; pool.connect();}
        });
        p.pool = pool;
        p.connect = async()=>
            {   if(isclosed)return;
                try {   await pool.connect();
                        p.isconnected = true;
                    }
                catch (err) {
                        logerr(err);
                        p.isconnected = false;
                        p.connect();
                }
            }
        p.connect();
        p.query = async(q)=>
            {   if(isclosed) throw new Error("You closed the connection already.");
                try{    for(let i=0;i<20;i++)
                            if(!p.isconnected) {await new Promise(resolve => setTimeout(resolve, 400));}
                            else break;
                        if(!p.isconnected) throw new Error("DB not connected.");
                        return await new mssql.Request(p.pool).query(q);
                   }
                catch(err)
                   {    throw new Error("MSG:"+err.message+"\nStack:"+err.stack+"\nQuery:"+q);
                   }
            }
        p.disconnect = async()=>
            {   isclosed = true;
                try {   pool.close(); }
                catch (err) {logerr(err)}
            }
        return p;
    }

async function generateshiftday (recordsets, day) {
    let shift = recordsets[0][0][day];
    if(shift == undefined) { return }
    shift = Math.floor(shift/1000000);
    let end = shift%100;    shift = Math.floor(shift/100);
    let start = shift%100;  shift = Math.floor(shift/100);
    let dayShift = {daystart:0,dayend:24};
    dayShift.dayend = end/2; 
    if(dayShift.dayend<0) dayShift.dayend = 0;
    dayShift.daystart = start/2;  
    if(dayShift.daystart<0) dayShift.daystart = 0;   
    if(dayShift.daystart>dayShift.dayend) dayShift.daystart = dayShift.dayend;
    
    return dayShift
}

async function updateDB (dbPool, shiftid, userid) {
    let day = 'day' + new Date().getDate();
    const shiftSql = "SELECT " + day + "  FROM Shifts WHERE id=" + shiftid
    const shiftsSelect = await dbPool.query(shiftSql)
    let dayshift = await generateshiftday(shiftsSelect.recordsets, day)
    const userSql = "UPDATE Users SET shiftstart=" + dayshift.daystart + ",shiftend=" + dayshift.dayend + " WHERE id=" +  userid;
    const userUpdate = await dbPool.query(userSql)
}
function calculatedayfromshifts(shifts)
    {   let toreturn={};
        let date=new Date();date.setDate(1);date.setHours(1);
        const START_OF_MONTH = date.getTime();
        const HOURS_IN_MILLISECONDS = 60 * 60 * 1000;
        let day=new Date();day.setHours(12);day=day.getDate();
        shifts.forEach(shift => {   
            const STAMP = parseInt(shift.refdate);
            let daysbetween = Math.round((STAMP - START_OF_MONTH) / (24 * HOURS_IN_MILLISECONDS));
            let offset = (shift.period - (daysbetween % shift.period)) % shift.period;
            let rawday=parseInt(shift["day" + ((day-1 + offset) % shift.period+1)])//see if it is +1
            toreturn[shift.id]={start:Math.trunc(rawday/100000000),end:Math.trunc(rawday/1000000)%100};
        });
        return toreturn;
    }
async function updateshifts (dbPool,userid) 
    {   if(userid!=-1)
            {   let stamp=new Date();stamp.setHours(2);stamp=stamp.getTime();
                let result = await dbPool.query("SELECT shift FROM Users WHERE id="+userid+";"+
                                                "SELECT TOP 1 shiftid FROM ShiftSchedule WHERE userid="+userid+" AND "+(stamp+18*3600_000)+">=datestart AND "+stamp+"<=dateend ORDER BY id DESC;"+
                                                "SELECT * FROM Shifts;");
                if(result.recordsets[0].length==0)
                    {   logerr("Missing user to calculate shift for:"+userid);
                        return;
                    }
                let shiftid=result.recordsets[1].length>0?result.recordsets[1][0].shiftid:result.recordsets[0][0].shift;
                for(let i=0;i<result.recordsets[2].length;i++)
                    {   let shift=result.recordsets[2][i];
                        if(shift.id!=shiftid)continue;
                        let shiftdata=calculatedayfromshifts([shift])[shiftid];
                        await dbPool.query("UPDATE Users SET shiftstart="+shiftdata.start+",shiftend="+shiftdata.end+" WHERE id="+userid+";");
                        log("Upd schedule for:"+userid);
                        return;
                    }
                await dbPool.query("UPDATE Users SET shiftstart=0,shiftend=48 WHERE id="+userid+";");//fallback
            }
        else{   let stamp=new Date();stamp.setHours(2);stamp=stamp.getTime();
                let result = await dbPool.query("SELECT shift,id FROM Users WHERE deactivated=0;"+
                                                "SELECT shiftid,userid FROM ShiftSchedule WHERE "+(stamp+18*3600_000)+">=datestart AND "+stamp+"<=dateend ORDER BY id DESC;"+
                                                "SELECT * FROM Shifts;");
                let shiftdata=calculatedayfromshifts(result.recordsets[2]);
                let users={};
                result.recordsets[0].forEach(user => {users[user.id]={shift:user.shift,id:user.id};});
                result.recordsets[1].forEach(sch => {if(users.hasOwnProperty(sch.userid))
                                                        users[sch.userid].shift=sch.shiftid;});
                let toupdate=[];
                users=Object.values(users);
                for(let i=0;i<users.length;i++)
                    {   let user=users[i];
                        let start=0,end=48;
                        if(shiftdata.hasOwnProperty(user.shift))
                            {   start=shiftdata[user.shift].start;
                                end=shiftdata[user.shift].end;
                            }
                        toupdate.push("UPDATE Users SET shiftstart="+start+",shiftend="+end+" WHERE id="+user.id+";");
                        if(toupdate.length>99)
                            {   await dbPool.query(toupdate.join(''));
                                toupdate=[];
                                log("Updating user schedules...");
                            }
                    };
                if(toupdate.length>0)
                    {   await dbPool.query(toupdate.join(''));
                        log("Updating user schedules...");
                    }
            }
    }
    
    
async function updateshifts_old (dbPool) {
    const d = new Date().getTime();
    const sql= "SELECT * FROM Shiftschedule WHERE " + d + "> datestart AND " + d + "<dateend;"
    const usersResult = await dbPool.query("SELECT name,matricol,shift,islate,ispresent,shiftstart,shiftend,id from Users;");
    let result = await dbPool.query(sql);
    if(result.recordset.length > 0) {
        result.recordset.forEach(async elem => {
            await updateDB (dbPool, elem.shiftid, elem.userid)
            usersResult.recordset.forEach(async (user, index) => {
                if(user.id == elem.userid) {
                    usersResult.recordset.splice(index, 1)
                }
            })
            usersResult.recordset.forEach(async user => {
                await updateDB (dbPool, user.shift, user.id)
            })
        })
    } else {
        usersResult.recordset.forEach(async user => {
            await updateDB (dbPool, user.shift, user.id)
        })
    }
}
function processhiftdata(year,month,recordsets)
    {   let shift = recordsets[0][0];
        let holidays = recordsets[1];

        let weekendholiday = [];
        const lastday = new Date(year, month+1, 0).getDate();
            {   let type = new Date(year,month,1).getDay();
                for(let i=0; i<lastday; i++)
                    {	if(((type+6)%7>4)) weekendholiday.push("w");
                        else weekendholiday.push("n");
                        type++;
                    }
            }
        holidays.forEach(elem =>
            {   weekendholiday[new Date(parseInt(elem.stamp)+5*3600000).getDate()-1]="h";   });

        {   let daysperiod = []
            //CALCULATING THE DAYS FOR THE PERIOD INTERVAL
            for(let i=0; i<shift.period; i++)
                {   let val = parseInt(shift["day"+(i+1)]);
                    val = Math.floor(val/1000000);
                    let end = val%100;    val = Math.floor(val/100);
                    let start = val%100;  val = Math.floor(val/100);
                    let day = {daystart:0,dayend:24,type:'n',workinwendholiday:shift.workinwendandholiday==1};
                    if(shift.clampinterval===1)
                        {   day.dayend = end/2; if(day.dayend<0) day.dayend = 0;
                            day.daystart = start/2;  if(day.daystart<0) day.daystart = 0;   if(day.daystart>day.dayend) day.daystart = day.dayend;
                        }
                    daysperiod[i] = day
                }
            //CALCULATING THE OFFSET FROM THE START OF THE PERIOD TO THE START OF THE MONTH
            let offset = 0;
            const startofmonth = new Date(year,month,1,0,0,0).getTime();
            const stamp = parseInt(shift.refdate);
            if(true||stamp<startofmonth)//apparently this case works for both past and future..... dunno why
                {   const daysbetween = Math.round((stamp-startofmonth)/(24*3600000));
                    offset=(shift.period-(daysbetween%shift.period))%shift.period;
                }
            else{   const daysbetween = Math.round((startofmonth-stamp)/(24*3600000));
                    offset = (shift.period-(daysbetween%shift.period))%shift.period;
                }
            //GENERATING THE SHIFT DAY DATA
            let days = [];
            for(let i=0; i<31; i++)
                {   if(weekendholiday[i]!=='n'&&shift.workinwendandholiday!==1)
                        {   days[i] = {daystart:0,dayend:24,type:weekendholiday[i],workinwendholiday:shift.workinwendandholiday==1};
                        }
                    else days[i] = daysperiod[(i+offset)%shift.period]
                }
            return days;
        }
    }

function procesclockingdata(year,month,recordsets,usershift)
    {   let toreturn = [];
        let scans = recordsets[0];
        let holidays = recordsets[1];
        let vacations = recordsets[2];
        let activities = recordsets[3];
        let vacationtypes = recordsets[4];
        let schedules = recordsets[5];
        let shifts = recordsets[7];

        const MINUTES_IN_MILLISECONDS = 60 * 1000;
        const HOURS_IN_MILLISECONDS = 60 * MINUTES_IN_MILLISECONDS;
        const lastday = new Date(year, month+1, 0).getDate();

        //BUILDING ACTIVITIES ARRAY
        const activityArray = [];
        for (let day = 0; day < lastday; day++) {
            activityArray.push([]);
        }
        activities.forEach(activity => {
            let startDate = new Date(parseInt(activity.stamp));
            startDate = new Date(startDate.getTime() - startDate.getTimezoneOffset() * MINUTES_IN_MILLISECONDS);
            const day = startDate.getDate();
            const tempActivity = {
                stamp: activity.stamp,
                text: `(${activity.hours}:${activity.hashalfhour ? "30" : "00"}) ${activity.name}`
            }
            activityArray[day - 1].push(tempActivity);
        })

        //BUILDING MONTH DATA
        let weekendholiday = [];
        {   let type = new Date(year,month,1).getDay();
            for(let i=0; i<lastday; i++)
                {	if(((type+6)%7>4)) weekendholiday.push("w");
                    else weekendholiday.push("n");
                    type++;
                }
        }
        holidays.forEach(elem =>
            {   weekendholiday[new Date(parseInt(elem.stamp)+5*3600000).getDate()-1]="h";   });
        //BUILDING SHIFT DATA
        let shiftdataarray = [];
        let defaultshiftdata = [];
        for(let i=0;i<31;i++) defaultshiftdata[i] = {daystart:0,dayend:0,workinwendandholiday:false};
        shifts.forEach(shift =>
            {   let daysperiod = []
                //CALCULATING THE DAYS FOR THE PERIOD INTERVAL
                for(let i=0; i<shift.period; i++)
                    {   let val = parseInt(shift["day"+(i+1)]);
                        val = Math.floor(val/1000000);
                        let end = val%100;    val = Math.floor(val/100);
                        let start = val%100;  val = Math.floor(val/100);
                        let day = {daystart:0,dayend:24,type:'n',workinwendandholiday:shift.workinwendandholiday==1};
                        if(shift.clampinterval===1)
                            {   day.dayend = end/2; if(day.dayend<0) day.dayend = 0;
                                day.daystart = start/2;  if(day.daystart<0) day.daystart = 0;   if(day.daystart>day.dayend) day.daystart = day.dayend;
                            }
                        daysperiod[i] = day
                    }
                //CALCULATING THE OFFSET FROM THE START OF THE PERIOD TO THE START OF THE MONTH
                let offset = 0;
                const startofmonth = new Date(year,month,1,0,0,0).getTime();
                const stamp = parseInt(shift.refdate);
                if(true||stamp<startofmonth)//past, this case works for both past and future months
                    {   const daysbetween = Math.round((stamp-startofmonth)/(24*3600000));
                        offset=(shift.period-(daysbetween%shift.period))%shift.period;
                    }
                else{   const daysbetween = Math.round((startofmonth-stamp)/(24*3600000));
                        offset = (shift.period-(daysbetween%shift.period))%shift.period;
                    }
                //GENERATING THE SHIFT DAY DATA
                let days = [];
                for(let i=0; i<31; i++)
                    {   if(weekendholiday[i]!=='n'&&shift.workinwendandholiday!==1)
                            {   days[i] = {daystart:0,dayend:24,type:weekendholiday[i],workinwendandholiday:shift.workinwendandholiday==1};
                            }
                        else days[i] = daysperiod[(i+offset)%shift.period]
                    }
                if(shift.name=="Tura implicita") defaultshiftdata = days;
                shiftdataarray[shift.id] = days;
            });

        //ADDING DEFAULT SHIFT
        let shiftdata = defaultshiftdata;
        if(usershift>-1&&usershift<shiftdataarray.length&&typeof shiftdataarray[usershift]=='object')
            shiftdata = shiftdataarray[usershift];
        for(let i=0; i<lastday; i++)
            {   toreturn.push({start:shiftdata[i].daystart,end:shiftdata[i].dayend,type:shiftdata[i].type,workinwendandholiday:shiftdata[i].workinwendandholiday});
            }
        //ADDING SHIFT SCHEDULEs
        const stampstart = new Date(year,month,1).getTime();
        schedules.forEach( schedule =>
            {   if(schedule.shiftid<0||schedule.shiftid>=shiftdataarray.length||typeof shiftdataarray[schedule.shiftid]!='object')
                    {   logwarn("Tura stearsa dar inca folosita in planificare, id planificare:"+schedule.id+", id tura:"+schedule.shiftid);
                        return;
                    }
                const shiftdata = shiftdataarray[schedule.shiftid];
                let a1 = Math.round((parseInt(schedule.datestart)-stampstart)/(1000*24*3600))+1;
                let a2 = Math.round((parseInt(schedule.dateend)-stampstart)/(1000*24*3600))+1;
                if(a1<1) a1 = 1;
                if(a2>toreturn.length) a2 = toreturn.length;
                for(let i=a1; i<=a2; i++)
                    {   toreturn[i-1].start = shiftdata[i-1].daystart;
                        toreturn[i-1].end   = shiftdata[i-1].dayend;
                        toreturn[i-1].type  = shiftdata[i-1].type;
                        toreturn[i-1].workinwendandholiday  = shiftdata[i-1].workinwendandholiday;
                    }
            });
        let restvactationtypeid =-1,medicalvacationtypeid=-1;
        for(let i=0; i<vacationtypes.length; i++)
            if(vacationtypes[i].code.split('(')[0]=="CO"&&vacationtypes[i].deactivated!=1)
                restvactationtypeid=vacationtypes[i].id;
            else if(vacationtypes[i].code.split('(')[0]=="CM"&&vacationtypes[i].deactivated!=1)
                medicalvacationtypeid=vacationtypes[i].id;
        //toreturn.forEach(day => { if(day.workinwendandholiday)day.type='n';});
        //POPULATING VACATIONS
        vacations.forEach(elem =>
            {
                let a1 = Math.round((parseInt(elem.datestart)-stampstart)/(1000*24*3600))+1;
                let a2 = Math.round((parseInt(elem.dateend)-stampstart)/(1000*24*3600))+1;
                let type = "CONCEDIU";
                for(let i=0; i<vacationtypes.length; i++)   if(elem.type==vacationtypes[i].id)
                    {type=vacationtypes[i].vacationtype; break;}

                if(a1<1) a1 = 1;
                if(a2>toreturn.length) a2 = toreturn.length;
                for(let i=a1; i<=a2; i++)
                    {   if((elem.type==restvactationtypeid)&&weekendholiday[i-1]!='n'&&toreturn[i-1].workinwendandholiday)
                            {   toreturn[i-1].start=0;//if shift  can't work on SD then the next if will catch it
                                toreturn[i-1].end=0;
                                continue;
                            }
                        if(!toreturn[i-1].workinwendandholiday&&weekendholiday[i-1]!='n')  continue;
                        toreturn[i-1].type = "v";
                        toreturn[i-1].co = type;// -(elem.type*1000+2*toreturn[i-1].data.maxhours);
                    }
            });
        //POPULATING scans
        toreturn.forEach(day => {day.scans=[];});
        scans.forEach(elem =>
            {   const stamp = parseInt(elem.stamp);
                toreturn[new Date(stamp).getDate()-1].scans.push({id:elem.id,stamp:stamp,change:elem.modification,time:0,type:elem.inorout==1?'i':'o'});
            });
            
        //POPULATING ACTIVITIES
        for (let day = 0; day < lastday; day++) {
            toreturn[day].activities = activityArray[day];
        }

        return toreturn;
    }


function processShifts(year, month, userMappingID, subgroupID, shiftsScehdules, shifts, holidays, vacations, vacationTypes) {
    const HOURS_IN_MILLISECONDS = 60 * 60 * 1000;
    const LAST_DAY = new Date(year, month + 1, 0).getDate();
    const START_STAMP = new Date(year, month, 1).getTime();

    const shiftNamesTemp = new Set();
    shifts.forEach(shift => shiftNamesTemp.add(shift.name.split("TURA")[0].trim()));
    const shiftNames = [...shiftNamesTemp].sort();

    const weekendHolidays = [];
    {   
        let day = new Date(year,month,1).getDay();
            for(let i = 0; i < LAST_DAY; i++) {	
                if(((day + 6) % 7 > 4)) {
                    weekendHolidays.push("w");
                } else {
                    weekendHolidays.push("n");
                }
                day++;
            }
    }

    holidays.forEach(elem => weekendHolidays[new Date(parseInt(elem.stamp) + 5 * HOURS_IN_MILLISECONDS).getDate() - 1] = "h");
    let restVacationTypeID = -1;
    for(let i = 0; i < vacationTypes.length; i++) {
        if(vacationTypes[i].code.split('(')[0] === "CO" && vacationTypes[i].deactivated !== 1) {
            restVacationTypeID = vacationTypes[i].id; 
            break;
        }
    }
    
    //BUILDING SHIFT DATA
    const shiftDataArray = [];
    let defaultShiftDataArray = [];
    for(let day = 0; day < 31; day++) {
        defaultShiftDataArray[day] = {name:"",workweend:false,maxhours:24};
    }
    shifts.forEach(shift => {   
        const daysPeriod = [];
        //CALCULATING THE DAYS FOR THE PERIOD INTERVAL
        for(let i = 0; i < shift.period; i++) {   
            let val = parseInt(shift["day" + (i + 1)]);
            let hours = val % 100;  
            let day = {name:shift.name.split("TURA")[0].trim(), workweend:false,maxhours:24};

            day.maxhours = hours / 2;
            day.workweend = shift.workinwendandholiday === 1;
            daysPeriod[i] = day
        }
        //CALCULATING THE OFFSET FROM THE START OF THE PERIOD TO THE START OF THE MONTH
        let offset = 0;
        const START_OF_MONTH = new Date(year,month,1,0,0,0).getTime();
        const STAMP = parseInt(shift.refdate);
        let daysbetween = Math.round((STAMP - START_OF_MONTH) / (24 * HOURS_IN_MILLISECONDS));
        offset = (shift.period - (daysbetween % shift.period)) % shift.period;
        
        //GENERATING THE SHIFT DAY DATA
        const days = [];
        for(let i=0; i < 31; i++) {
            days[i] = daysPeriod[(i + offset) % shift.period]
        }
        if(shift.name.split("TURA")[0].trim() === "Tura implicita") {
            defaultShiftDataArray = days;
        }

        shiftDataArray[shift.id] = days;
    });

    //BUILDING USER DICT
    const userDict = {};
    Object.values(userMappingID).forEach(user => {   
        if (subgroupID >-1 && user.subGroupId !== subgroupID) {
            return;
        } 
        const days = []
        userDict[user.userid] = {
            id:user.userid,
            name:user.lastName + " " + user.firstName,
            days:days
        };
        let shiftDataTemp = defaultShiftDataArray;
        if (user.shift >-1 && user.shift < shiftDataArray.length && typeof shiftDataArray[user.shift] === 'object') {
            shiftDataTemp = shiftDataArray[user.shift];
        }
        for (let i=0; i < LAST_DAY; i++) {
            days.push({total:0,data:shiftDataTemp[i]});
        }
    });
    //ADDING SHIFT SCHEDULEs
    shiftsScehdules.forEach( schedule => {   
        if (!userDict.hasOwnProperty(schedule.userid)) {
            return;
        }
        let user = userDict[schedule.userid];

        if (schedule.shiftid < 0 || schedule.shiftid >= shiftDataArray.length || typeof shiftDataArray[schedule.shiftid] !== 'object') {   
            logwarn("Tura stearsa dar inca folosita in planificare, id planificare:"+schedule.id+", id tura:"+schedule.shiftid);
            return;
        }

        let shiftDataTemp = shiftDataArray[schedule.shiftid];

        let startDay = Math.round((parseInt(schedule.datestart) - START_STAMP) / (24 * HOURS_IN_MILLISECONDS)) + 1;
        let endDay = Math.round((parseInt(schedule.dateend) - START_STAMP) / (24 * HOURS_IN_MILLISECONDS)) + 1;

        startDay = Math.max(startDay, 1);
        endDay = Math.min(endDay, user.days.length);

        for(let day = startDay; day <= endDay; day++) {   
            user.days[day - 1].data = shiftDataTemp[day - 1];
        }
    });

    //SETTING DAY TYPES
    Object.values(userDict).forEach(user => {   
        for(let i = 0; i < user.days.length; i++) {
            user.days[i].daytype = (weekendHolidays[i] === 'n' || user.days[i].data.workweend) ? 'n' : weekendHolidays[i];
            user.days[i].total = user.days[i].daytype === "w" ? 0 : user.days[i].data.maxhours;
            user.days[i].name = user.days[i].data.name;
            if (user.hasOwnProperty(user.days[i].data.name)) {
                user[user.days[i].data.name].push(i);
            } else {
                user[user.days[i].data.name] = [i];
            }
        }
    });

    const VACATION_CODES = {};
    vacationTypes.forEach(elem => VACATION_CODES[elem.id] = elem.code.split('(')[0]);

    vacations.forEach(elem => {   
        if(userDict.hasOwnProperty(elem.userid)) {   
            let user = userDict[elem.userid];
            let startDay = Math.round((parseInt(elem.datestart) - START_STAMP) / (24 * HOURS_IN_MILLISECONDS))+1;
            let endDay = Math.round((parseInt(elem.dateend) - START_STAMP) / (24 * HOURS_IN_MILLISECONDS))+1;

            startDay = Math.max(startDay, 1);
            endDay = Math.min(endDay, user.days.length);

            for(let i = startDay; i <= endDay; i++) {   
                if (elem.type === restVacationTypeID && weekendHolidays[i - 1] !== 'n') {
                    continue;
                }
                if(!user.days[i - 1].data.workweend && weekendHolidays[i - 1] !== 'n') {
                    continue;
                }       
                user.days[i - 1].total = VACATION_CODES[elem.type];
            }
            return;
        }
    });

    const userDictArray = Object.values(userDict);

    const sortedShifts = [];
    shiftNames.forEach(shiftName => {
        const shiftTemp = {name: shiftName, users: []}
        userDictArray.forEach(user => {
            if (user.hasOwnProperty(shiftName) && user[shiftName].includes(0)) {
                shiftTemp.users.push(user);
            }
        })
        if (shiftTemp.users.length > 0) {
            sortedShifts.push(shiftTemp);
        }
    });

    return sortedShifts;
}

function processCondicaScans(year, month, dataArray, holidays, vacations, vacationTypes) {
    const HOURS_IN_MILLISECONDS = 60 * 60 * 1000;
    const LAST_DAY = new Date(year, month + 1, 0).getDate();
    const START_STAMP = new Date(year, month, 1).getTime();

    const weekendHolidays = [];
    {   
        let day = new Date(year,month,1).getDay();
            for(let i = 0; i < LAST_DAY; i++) {	
                if(((day + 6) % 7 > 4)) {
                    weekendHolidays.push("w");
                } else {
                    weekendHolidays.push("n");
                }
                day++;
            }
    }

    holidays.forEach(elem => weekendHolidays[new Date(parseInt(elem.stamp) + 5 * HOURS_IN_MILLISECONDS).getDate() - 1] = "h");
    let restVacationTypeID = -1;
    for(let i = 0; i < vacationTypes.length; i++) {
        if(vacationTypes[i].code.split('(')[0] === "CO" && vacationTypes[i].deactivated !== 1) {
            restVacationTypeID = vacationTypes[i].id; 
            break;
        }
    }

    const usersID = new Set();
    const userDictArray = [];

    dataArray.forEach(data => {
        if (!usersID.has(data.userid)) {
            const startDays = [];
            const endDays = [];
            for (let day = 0; day < 31; day++) {
                startDays.push("");
                endDays.push("");
            }
            userDictArray.push({
                id:data.userid, matricol: data.matricol, firstName: data.firstName, lastName: data.lastName, 
                subGroupId: data.subGroupId, sgName: data.sgName, sgkeyref: data.sgkeyref, 
                start: startDays, end: endDays
            });
            usersID.add(data.userid);     
        }
    });

    userDictArray.forEach(user => {
        dataArray.forEach(data => {
            if (user.id === data.userid) {
                let scanDate = new Date(parseInt(data.stamp));
                //scanDate = new Date(scanDate.getTime());
                const day = scanDate.getDate();
                const hour = scanDate.getHours();
                const minutes = scanDate.getMinutes();
                const scanIsOfTypeIn = data.inorout === 1;  //1 = in; 2 = out
                if (scanIsOfTypeIn) {
                    if(user.start[day - 1]==""||hour*60+minutes<user.start[day - 1])
                        user.start[day - 1]=hour*60+minutes;
                        //user.start[day - 1] = `${hour < 10 ? "0" : ""}${hour}:${minutes < 10 ? "0" : ""}${minutes}`;
                } else {
                    if(user.end[day - 1]==""||hour*60+minutes>user.end[day - 1])
                        user.end[day - 1]=hour*60+minutes;
                        //user.end[day - 1] = `${hour < 10 ? "0" : ""}${hour}:${minutes < 10 ? "0" : ""}${minutes}`;
                        //user.end[day - 1] = `${hour < 10 ? "0" : ""}${hour}:${minutes < 10 ? "0" : ""}${minutes}`;
                }
            }
        });
    });
    userDictArray.forEach(user => {
        for(let i=0;i<user.start.length;i++)if(user.start[i]!="")
            {   let hour=Math.trunc(user.start[i]/60),minutes=user.start[i]%60;
                user.start[i] = `${hour < 10 ? "0" : ""}${hour}:${minutes < 10 ? "0" : ""}${minutes}`;
            }
        for(let i=0;i<user.end.length;i++)if(user.end[i]!="")
            {   let hour=Math.trunc(user.end[i]/60),minutes=user.end[i]%60;
                user.end[i] = `${hour < 10 ? "0" : ""}${hour}:${minutes < 10 ? "0" : ""}${minutes}`;
            }
    });

    const VACATION_CODES = {};
    vacationTypes.forEach(elem => VACATION_CODES[elem.id] = elem.code.split('(')[0]);
    
    userDictArray.forEach(user => {
        vacations.forEach(vac => {   
            if(user.id === vac.userid) {   
                let startDay = Math.round((parseInt(vac.datestart) - START_STAMP) / (24 * HOURS_IN_MILLISECONDS))+1;
                let endDay = Math.round((parseInt(vac.dateend) - START_STAMP) / (24 * HOURS_IN_MILLISECONDS))+1;
    
                startDay = Math.max(startDay, 1);
                endDay = Math.min(endDay, LAST_DAY);
    
                for(let i = startDay; i <= endDay; i++) {   
                    if (vac.type === restVacationTypeID && weekendHolidays[i - 1] !== 'n') {
                        continue;
                    }
                    user.start[i - 1] = VACATION_CODES[vac.type];
                    user.end[i - 1] = VACATION_CODES[vac.type];
                }
                return;
            }
        });
    })

    return userDictArray;
}

async function getEditReportPermission(permissionId, dbPool) {
    const sql = `SELECT p_editReports FROM Permissions WHERE id = ${permissionId};`;
    let result;
    try {
        result = await dbPool.query(sql);
    } catch(err) {   
        logerr(err);
        logerr(sql);
        throw err;
    }
    return result.recordsets[0][0].p_editReports === 1;
}
function buildvacationdict(array)
    {   let toreturn={};
        array.forEach(vac => {  toreturn[vac.id]=vac;});
        return toreturn;
    }
//==========================REPORT GENERATION
/**
 * @param {Number} year Year
 * @param {Number} month Month, starting with 0
 * @param {Object} usermappingid The user cache.
 * @param {Object} dbPool Db pool connection  object.
 */
async function generatereport(year,month,usermappingid,dbPool,subgroupid)
    {   //subgroupid=-1;//COMMENT THIS WHEN YOU IMPLEMENTED SUBGROUP FILTERING


        //DOWNLOADING THE DATA scans,vacations,holidays
        const lastday = new Date(year, month+1, 0).getDate();
        const dateofreport = year*100+month;

        const stampstart = new Date(year,month,1).getTime();
        const stampend = new Date(year,month,lastday+1).getTime();

        // function getfiltersubgr (tableAlias) {
        //     return "INNER JOIN Users u ON "+tableAlias+".userid = u.id WHERE u.sub_group_id = "+subgroupid
        // }

        const wherequery = subgroupid<0?" WHERE ":" INNER JOIN Users u ON {$}.userid = u.id WHERE u.sub_group_id = "+subgroupid +" AND ";
        let sql = "";

        sql += "SELECT s.userid,s.stamp,s.inorout from Scans s "+ (wherequery.replace("{$}","s"))+" s.stamp>"+stampstart+" AND s.stamp<"+stampend+" ORDER BY s.stamp ASC;\n";
        sql += "SELECT * from Holidays WHERE stamp>"+stampstart+" AND stamp<"+stampend+";\n";
        sql += "SELECT v.* from Vacations v "+ (wherequery.replace("{$}","v"))+" v.datestart-100<"+stampend+" AND v.dateend+100>"+stampstart+";\n";//" AND ((v.datestart<"+stampstart+" AND dateend>"+stampstart+") OR (datestart<"+stampend+" AND datestart<"+stampend+") OR (datestart<"+stampstart+" AND dateend>"+stampend+") OR (datestart>"+stampstart+" AND dateend<"+stampend+"));";
        sql += "SELECT a.*,at.isadd,at.isremove,at.isaddovertime,at.isremoveovertime from Activities a LEFT JOIN Activitytypes at ON a.type=at.slot "+ (wherequery.replace("{$}","a"))+" a.stamp>"+stampstart+" AND a.stamp<"+stampend+";\n";
        sql += "SELECT * from Vacationtypes;\n"
        sql += "SELECT s.* from ShiftSchedule s "+ (wherequery.replace("{$}","s"))+" s.datestart-100<"+stampend+" AND s.dateend+100>"+stampstart+";\n";
        sql += "SELECT * from Settings;\n";
        sql += "SELECT * from Shifts;\n";

        let result;

        try {
                result = await dbPool.query(sql);
            }
        catch(err)
            {   logerr(err);
                logerr(sql);
                throw err;
            }

        let scans         = result.recordsets[0];
        let holidays      = result.recordsets[1];
        let vacations     = result.recordsets[2];
        let activities    = result.recordsets[3];
        let vacationdict = buildvacationdict(result.recordsets[4]);
        let schedules     = result.recordsets[5];
        let settings      = result.recordsets[6];
        let shifts        = result.recordsets[7];


        //BUILDING MONTH DATA
        let weekendholiday = [];
        {   let type = new Date(year,month,1).getDay();
            for(let i=0; i<lastday; i++)
                {	if(((type+6)%7>4)) weekendholiday.push("w");
                    else weekendholiday.push("n");
                    type++;
                }
        }
        holidays.forEach(elem =>
            {   weekendholiday[new Date(parseInt(elem.stamp)+5*3600000).getDate()-1]="h";   });
        // let vacationdict=buildvacationdict(result.recordsets[4]);
        // let restvactationtypeid =-1,medicalvacationtypeid=-1;
        // for(let i=0; i<vacationtypes.length; i++)
        //     if(vacationtypes[i].code.split('(')[0]=="CO"&&vacationtypes[i].deactivated!=1)    
        //         restvactationtypeid=vacationtypes[i].id;
        //     else if(vacationtypes[i].code.split('(')[0]=="CM"&&vacationtypes[i].deactivated!=1)
        //         medicalvacationtypeid=vacationtypes[i].id;

        //BUILDING SHIFT DATA
        let shiftdataarray = [];
        let defaultshiftdata = [];
        for(let i=0;i<31;i++) defaultshiftdata[i] = {includebreaks:false,clamp:true,clampstartend:true,daystart:0,dayend:0,workweend:false,maxhours:24,printstart:0,printend:48,useprint:false,paidh:0,unpaidh:0,allowedlatehours:2};
        shifts.forEach(shift =>
            {   let daysperiod=[];
                //CALCULATING THE DAYS FOR THE PERIOD INTERVAL
                for(let i=0; i<shift.period; i++)
                    {   let val = parseInt(shift["day"+(i+1)]);
                        let hours = val%100;  val = Math.floor(val/100);
                        let endprint = val%100;  val = Math.floor(val/100);
                        let startprint = val%100;  val = Math.floor(val/100);
                        let end = val%100;  val = Math.floor(val/100);
                        let start = val%100;  val = Math.floor(val/100);
                        let day = {includebreaks:false,clamp:true,clampstartend:true,daystart:0,dayend:0,workweend:false,maxhours:24,printstart:0,printend:48,useprint:false,paidh:0,unpaidh:0,allowedlatehours:2};

                        if(shift.clampinterval===1)
                            {   day.daystart = start*60/2;
                                day.dayend = (24-end/2)*60;
                                day.clampstartend = false;
                            }
                        day.clamp = shift.clamp;
                        day.maxhours = hours/2;
                        day.paidh = shift.extrapaidhours;
                        day.unpaidh = shift.extraunpaidhours;
                        if(day.dayend<0) day.dayend = 0;
                        if(day.daystart<0) day.daystart = 0;
                        if(day.daystart>24*60-day.dayend)
                            {   day.daystart = 24*60-day.dayend;
                                logwarn("Day start > end !!!!!:"+(day.daystart/60)+">"+(day.dayend/60)+" name:"+shift.name);
                            }
                        day.workweend = shift.workinwendandholiday==1;
                        day.includebreaks = shift.includebreaks==1;
                        day.allowedlatehours=shift.allowedlatehours;
                        day.printstart = startprint;
                        day.printend = endprint;
                        day.useprint = shift.useconfighours;
                        daysperiod[i] = day
                    }
                //CALCULATING THE OFFSET FROM THE START OF THE PERIOD TO THE START OF THE MONTH
                let offset=0;
                const startofmonth = new Date(year,month,1,0,0,0).getTime();
                const stamp = parseInt(shift.refdate);
                if(true||stamp<startofmonth)//this case works for both past and future
                    {   let daysbetween = Math.round((stamp-startofmonth)/(24*3600000));
                        offset = (shift.period-(daysbetween%shift.period))%shift.period;
                    }
                else{   let daysbetween = Math.round((startofmonth-stamp)/(24*3600000));//future
                        offset = (shift.period-(daysbetween%shift.period))%shift.period;
                    }
                //GENERATING THE SHIFT DAY DATA
                let days = [];
                for(let i=0; i<31; i++)
                    days[i] = daysperiod[(i+offset)%shift.period]

                if(shift.name=="Tura implicita") defaultshiftdata = days;

                shiftdataarray[shift.id] = days;
            });

        //BUILDING USER DICT
        let userdict = {};
        Object.values(usermappingid).forEach(user =>
            {   if(subgroupid>-1&&user.sub_group_id!=subgroupid) return;
                let days = []
                userdict[user.id] = {userid:user.id,username:user.name,days:days,co:0,overtime:0};
                let shiftdata = defaultshiftdata;
                if(user.shift>-1&&user.shift<shiftdataarray.length&&typeof shiftdataarray[user.shift]=='object')
                    shiftdata = shiftdataarray[user.shift];
                for(let i=0; i<lastday; i++)
                    days.push({list:[],activ:[],min:0,max:0,night:0,break:0,total:0,rawtotal:0,data:JSON.parse(JSON.stringify(shiftdata[i])),rawminutes:0,activityadd:0});
            });

        //ADDING SHIFT SCHEDULEs
        schedules.forEach( schedule =>
            {   if(!userdict.hasOwnProperty(schedule.userid)) return;
                let user = userdict[schedule.userid];
                //if(user.multishifts==0)return;

                if(schedule.shiftid<0||schedule.shiftid>=shiftdataarray.length||typeof shiftdataarray[schedule.shiftid]!='object')
                    {   logwarn("Tura stearsa dar inca folosita in planificare, id planificare:"+schedule.id+", id tura:"+schedule.shiftid);
                        return;
                    }

                let shiftdata = shiftdataarray[schedule.shiftid];

                let a1 = Math.round((parseInt(schedule.datestart)-stampstart)/(1000*24*3600))+1;
                let a2 = Math.round((parseInt(schedule.dateend)-stampstart)/(1000*24*3600))+1;

                if(a1<1) a1 = 1;
                if(a2>user.days.length) a2 = user.days.length;
                for(let i=a1; i<=a2; i++)
                    {   user.days[i-1].data = JSON.parse(JSON.stringify(shiftdata[i-1]));
                    }
            });

        //SETTING DAY TYPES
        Object.values(userdict).forEach(user =>
            {   for(let i=0; i<user.days.length; i++)
                    user.days[i].daytype=(weekendholiday[i]=='n'||user.days[i].data.workweend)?'n':weekendholiday[i];
            });

        //POPULATING scans
        scans.forEach(elem =>
            {   if(userdict.hasOwnProperty(elem.userid))
                    {   let user = userdict[elem.userid];
                        let stamp = parseInt(elem.stamp);
                        user.days[new Date(stamp).getDate()-1].list.push({stamp:stamp,isstart:elem.inorout==1});
                    }
            });
        
        //POPULATING VACATIONS
        vacations.forEach(elem =>
            {   if(userdict.hasOwnProperty(elem.userid))
                    {   let user = userdict[elem.userid];
                        let a1 = Math.round((parseInt(elem.datestart)-stampstart)/(1000*24*3600))+1;
                        let a2 = Math.round((parseInt(elem.dateend)-stampstart)/(1000*24*3600))+1;

                        if(a1<1) a1 = 1;
                        if(a2>user.days.length) a2 = user.days.length;
                        for(let i=a1; i<=a2; i++)
                            {   let hours=8;
                                let isCO=false;
                                let hoursovertime=0;
                                if(vacationdict.hasOwnProperty(elem.type))
                                    {   let type=vacationdict[elem.type];
                                        hours=type.hours;
                                        isCO=type.code.split('(')[0]=="CO";
                                        hoursovertime=type.hoursovertime*60+(type.hoursovertime>0?(type.hoursovertimehashalf*30):(-1*type.hoursovertimehashalf*30));
                                    }
                                if(isCO && weekendholiday[i-1]!='n')
                                    {   user.days[i-1].daytype = weekendholiday[i-1];//remove if not needed! or make day.data.maxh=0 start=0 end=0
                                        continue;
                                    }
                                if(!user.days[i-1].data.workweend&&weekendholiday[i-1]!='n')    continue;
                                user.days[i-1].daytype = "v";
                                user.days[i-1].co =- (elem.type*1000+2*0);//hours
                                user.overtime+=hoursovertime;
                                if(isCO)user.co++;
                            }
                        return;
                    }
            });
        //POPULATING ACTIVITIES
        activities.forEach(activ =>
            {   if(userdict.hasOwnProperty(activ.userid))
                    {   const user = userdict[activ.userid];
                        const day = user.days[new Date(parseInt(activ.stamp)).getDate()-1];
                        //if(activ.type>0&&activ.type<5)
                        if(day.activ.length<3)
                            {   let time=activ.hours*2+(activ.hashalfhour==1?1:0);
                                if(activ.isaddovertime==1)user.overtime+=time*30;
                                else if(activ.isremoveovertime==1)user.overtime-=time*30;
                                if(activ.isadd==1)
                                    {   day.activityadd+=time;
                                        day.data.maxhours+=time;//for activ/co that modify max hours
                                        //console.log(day.data)
                                    }
                                else if(activ.isremove==1)
                                    {   day.activityadd-=time;
                                        day.data.dayend-=time*30;//increase the end hour (calculated as hours to 24)
                                        if(day.data.dayend<0)day.data.dayend=0;
                                        day.data.maxhours+=time;//for activ/co that modify max hours
                                        //time=0;
                                    }
                                
                                day.activ.push(activ.type*100+time)//[activ.type]=activ.hours*2+(activ.hashalfhour==1?1:0);
                            }
                        else logwarn("Can't have more than 3 activities per day for user:"+user.username);
                    }
            });
        const userdictarray = Object.values(userdict);

        log("GenRep:Dld:"+scans.length+" s,"+holidays.length+" h,"+vacations.length+" v,"+activities.length+" a,"+schedules.length+" sch,usr:"+userdictarray.length+",subgr:"+subgroupid+",date:"+year+"-"+month);

        let maxlate1 = 10, maxlate2 = 10, morningend = 4, nightstart = 22,  batchsize = 100;
        let roundtohour = false, use15rounding = true, useadvrounding = true;

        settings.forEach(s => {
                 if(s.name=='maxlateminutes1')  maxlate1 = parseInt(s.data);
            else if(s.name=='maxlateminutes2')  maxlate2 = parseInt(s.data);
            else if(s.name=='roundtohour')      roundtohour = parseInt(s.data)===1;
            else if(s.name=='morningend')       morningend = parseInt(s.data);
            else if(s.name=='nightstart')       nightstart = parseInt(s.data);
            else if(s.name=='rowsperinsert')    batchsize = parseInt(s.data);
            else if(s.name=='use15rounding')    use15rounding = parseInt(s.data)===1;
            else if(s.name=='useadvrounding')    useadvrounding = parseInt(s.data)===1;
        });


        generatereport_processdata(year,month,userdictarray,maxlate1,maxlate2,roundtohour,use15rounding,useadvrounding,morningend,nightstart);

        //UPLOADING REPORT
        await generatereport_upload(dateofreport,userdictarray,dbPool,"Reports",batchsize,"Upl",subgroupid);
        //UPLOADING EXTRA HOURS
        await generatereport_upload(dateofreport,userdictarray,dbPool,"Reports_meta",batchsize,"UplSupl",subgroupid);
        //UPDATING CO DATA
        await generatereport_updateco(year,month,dbPool,subgroupid);
    }

async function generatereport_upload(dateofreport,userdictarray,dbPool,tablename,batchsize,logtag,subgroupid)
    {   //parameters: tablename=Reports/Reports_meta,nameoffield1=d/a,nameoffield2=d/a,logtag=Upl/UplSupl
        //GENERATE SQL HEADER
        let fields = [];
        let prefix="";
        if(tablename=='Reports')
            {   let fieldsprint = [];
                for(let i=1; i<32; i++)
                    {   fields.push('d'+i); fieldsprint.push('d'+i);
                        fields.push('a'+i); fieldsprint.push('a'+i);
                    }
                fields.push("co","overtime","overtimetotal");
                fieldsprint.push("co","overtimeapproved","overtimetotal");
                prefix="INSERT INTO Reports("+fieldsprint.join(',')+",date,generatedat,userid) VALUES";
                
            }
        else if(tablename=='Reports_meta')
            {   let fieldsprint = [];
                for(let i=1; i<32; i++)
                    {   fields.push('c'+i); fieldsprint.push('a'+i);
                    }
                fields.push("overtimetotal","overtimetotal","numOfLateDays");
                fieldsprint.push("total","ballance","numOfLateDays");
                prefix="INSERT INTO Reports_meta("+fieldsprint.join(',')+",date,generatedat,userid) VALUES";
            }
        //CALC OVERTIME TOTAL FOR BOTH TABLES
        const year=Math.trunc(dateofreport/100),month=(dateofreport%100);
        const lastday = new Date(year, month+1, 0).getDate();
        userdictarray.forEach(user =>
            {   user.overtimetotal=0;
                user.numOfLateDays=0;
                for(let i=1;i<lastday+1;i++)
                    {   user.overtimetotal+=user['c'+i];
                        if(user['c'+i]<0)user.numOfLateDays++;
                    }
            });
        //BUILD FULL SQL
        let pieces1 = [], pieces2 = [];
        let count = 0;
        const toinsertgeeratedat = new Date().getTime();
        userdictarray.forEach(user =>
            {   let valuelist = [];
                fields.forEach(field => {
                    if(user.hasOwnProperty(field))
                        valuelist.push(user[field]);
                    else valuelist.push(0);
                });
                pieces1.push("("+valuelist.join(',')+","+dateofreport+","+toinsertgeeratedat+","+user.userid+")")
                count++;
                if(count>=batchsize)
                    {   pieces2.push(prefix+pieces1.join(',')+';');
                        count = 0;
                        pieces1 = [];
                    }
            });
        if(pieces1.length>0)
            pieces2.push(prefix+pieces1.join(',')+';');
        //DELETE PREVIOUS REPORT
        let sql = "DELETE FROM "+tablename+" WHERE date="+dateofreport+";";
        if(subgroupid>-1) {sql="DELETE "+tablename+" FROM "+tablename+" r INNER JOIN Users u ON r.userid=u.id WHERE r.date="+dateofreport+" AND u.sub_group_id="+subgroupid+";";}
        //RUNNING SQLs
        try {   await dbPool.query(sql);
                if(pieces2.length%2==1) pieces2.push("");//rounding to length multiple of 2 to merge batches in half of double sizes
                for(let i=0; i<pieces2.length; i+=2)
                    {   log("GenRep:"+logtag+":"+(i/2+1)+"/"+(pieces2.length/2)+"("+userdictarray.length+" inserts)"+
                            (i+2==pieces2.length?" COMPLETE":""));
                        sql=pieces2[i]+pieces2[i+1];
                        await dbPool.query(sql);
                    }
                if(tablename=='Reports')
                    {   let datepieces=[];
                        let dates=[dateofreport-1,dateofreport-2,dateofreport-3,dateofreport-4];//first 3 is for last months, 4th is for total before
                        for(let i=0;i<4;i++)if(dates[i]%100>13)
                            dates[i]-=88;//remove a year, add 12 months -100+12=-88
                        for(let i=0;i<3;i++)
                            datepieces.push("UPDATE r1 SET r1.overtime"+(i+1)+"last=r2.overtimeapproved FROM Reports r1 INNER JOIN Reports r2 ON r1.userid=r2.userid INNER JOIN Users u ON r1.userid=u.id WHERE r1.date="+
                                            dateofreport+" AND r2.date="+dates[i]+(subgroupid>-1?" AND u.sub_group_id="+subgroupid:"")+";");
                        //calculate balance
                        datepieces.push("UPDATE r1 SET r1.overtimebalance=r1.overtimeapproved+r2.overtimebalance FROM Reports r1 INNER JOIN Reports r2 ON r1.userid=r2.userid INNER JOIN Users u ON r1.userid=u.id WHERE r1.date="+
                            dateofreport+" AND r2.date="+dates[0]+(subgroupid>-1?" AND u.sub_group_id="+subgroupid:"")+";");
                        //set last3m=ballance from 4 monts ago
                        datepieces.push("UPDATE r1 SET r1.overtimebefore3m=r2.overtimebalance FROM Reports r1 INNER JOIN Reports r2 ON r1.userid=r2.userid INNER JOIN Users u ON r1.userid=u.id WHERE r1.date="+
                            dateofreport+" AND r2.date="+dates[3]+(subgroupid>-1?" AND u.sub_group_id="+subgroupid:"")+";");

                        sql=datepieces.join('');
                        await dbPool.query(sql);
                    }
            }
        catch(err)
            {   logerr(err);
                logerr(sql);
                throw err;
            }




            






        // let fields = [],fieldsprint = [];
        // for(let i=1; i<32; i++)
        //     {   if(field1.length+field1db.length>0) {fields.push(field1+i); fieldsprint.push(field1db+i);}
        //         if(field2.length+field2db.length>0) {fields.push(field2+i); fieldsprint.push(field2db+i);}
        //     }
        // const isreport=tablename=="Reports";
        // const cocolumn=isreport?",co,overtimeapproved,overtimetotal":"";
        // const prefix = "INSERT INTO "+tablename+"("+fieldsprint.join(',')+",date,generatedat,userid"+(addtotal?",total,ballance,numOfLateDays":"")+cocolumn+") VALUES";
        // //generating the insert values
        // let pieces1 = []
        // let pieces2 = []
        // let count = 0;
        // const toinsertgeeratedat = new Date().getTime();

        // userdictarray.forEach(user =>
        //     {   let valuelist = [];
        //         let totalovertime = 0;
        //         let numOfLateDays = 0;
        //         fields.forEach(field => {
        //             if(user.hasOwnProperty(field))
        //                 {   valuelist.push(user[field]);
        //                     totalovertime += user[field];
        //                     if(user[field] < 0)
        //                         numOfLateDays++;
        //                 }
        //             else valuelist.push(0);
        //         });

        //         pieces1.push("("+valuelist.join(',')+","+dateofreport+","+toinsertgeeratedat+","+user.userid+(addtotal?","+totalovertime+","+totalovertime+","+numOfLateDays:"")+(isreport?","+user.co+","+user.overtime+","+totalovertime:"")+")")
        //         count++;
        //         if(count>=batchsize)
        //             {   pieces2.push(prefix+pieces1.join(',')+';');
        //                 count = 0;
        //                 pieces1 = [];
        //             }
        //     });
        // if(pieces1.length>0)
        //     {   pieces2.push(prefix+pieces1.join(',')+';');
        //         pieces1 = [];
        //     }

        // let sql = "DELETE FROM "+tablename+" WHERE date="+dateofreport+";";
        // if(subgroupid>-1) {sql="DELETE "+tablename+" FROM "+tablename+" r INNER JOIN Users u ON r.userid=u.id WHERE r.date="+dateofreport+" AND u.sub_group_id="+subgroupid+";";}

        // try {   await dbPool.query(sql);
        //         if(pieces2.length%2==1) pieces2.push("");//rounding to length multiple of 2 to merge batches in half of double sizes
        //         for(let i=0; i<pieces2.length; i+=2)
        //             {   log("GenRep:"+logtag+":"+(i/2+1)+"/"+(pieces2.length/2)+"("+userdictarray.length+" inserts)"+
        //                     (i+2==pieces2.length?" COMPLETE":""));
        //                 await dbPool.query(pieces2[i]+pieces2[i+1]);
        //             }
        //         if(addtotal)
        //             {   let additionaljoin = "";
        //                 let additionalwhere = "";
        //                 if(subgroupid>-1)
        //                     {   additionaljoin = " INNER JOIN Users u ON r1.userid=u.id ";
        //                         additionalwhere = " AND u.sub_group_id="+subgroupid;
        //                     }
        //                 if(Math.floor((dateofreport%100)%3)==0)//for first month of trimester
        //                      sql = "UPDATE r1 SET r1.ballance=r1.total FROM Reports_Meta r1 "+additionaljoin+" WHERE r1.date="+dateofreport+additionalwhere+";";
        //                 else sql = "UPDATE r1 SET r1.ballance=r1.total+r2.ballance FROM Reports_Meta r1 "+additionaljoin+" INNER JOIN Reports_Meta r2 ON r1.userid=r2.userid WHERE r1.date="+dateofreport+" AND r2.date="+(dateofreport%100==0?dateofreport-100+11:dateofreport-1)+additionalwhere+";";
        //                 await dbPool.query(sql);
        //             }

        //     }
        // catch(err)
        //     {   logerr(err);
        //         logerr(sql);
        //         throw err;
        //     }

    }
async function generatereport_updateco(year,month,dbPool,subgroupid)
    {   //IF JANUARY
        if(month!=0)return; 
        try {   //DOWNLOAD ALL CO
                let searchQuery=[];
                searchQuery.push(" (r.date>="+(year*100)+" AND r.date<"+(year*100+12)+")");
                if (subgroupid != -1) searchQuery.push("sg.id="+subgroupid);
                const where = "WHERE "+(searchQuery.join(" AND "));
                let sql="SELECT r.co,r.userid,u.colastyear,u.codays FROM Reports r INNER JOIN Users u ON r.userid = u.id "+
                            "LEFT JOIN SubGroups sg ON u.sub_group_id = sg.id "+where+" ;";
                let users={};
                const result = await dbPool.query(sql);
                //CALCULATE CO SUM FOR LAST YEAR
                result.recordset.forEach(elem => 
                    {   if(users.hasOwnProperty(elem.userid))
                            users[elem.userid].total-=elem.co;
                        else users[elem.userid]={total:elem.colastyear+elem.codays-elem.co,id:elem.userid};
                    });
                //UPLOAD
                let batches=[];
                let values=Object.values(users);
                for(let i=0;i<values.length;i++) 
                    {   batches.push("UPDATE Users SET colastyear="+values[i].total+" WHERE id="+values[i].id+";");
                        if(batches.length>99)
                            {   await dbPool.query(batches.join(''));
                                log("Upd CO last year:"+Math.trunc(i/100)+"/"+Math.trunc(values.length/100)+"("+values.length+" inserts)"+
                                    (i==values.length-1?" COMPLETE":""))
                                batches=[];
                            }
                    }
                if(batches.length>0)
                    {   await dbPool.query(batches.join(''));
                        log("Upd CO last year:"+Math.ceil(values.length/100)+"/"+Math.ceil(values.length/100)+"("+values.length+" inserts)COMPLETE")
                    }
            }
        catch(err)
            {   logerr(err);
                logerr(sql);
                throw err;
            }

    }
function generatereport_processdata(year,month,userdictarray,maxlate1,maxlate2,roundtohour,use15rounding,useadvrounding,morningend,nightstart)//FORMAT  [2:START][2:END][4:PAUZA][2:TOTAL][2:SSM][2:SU][2:SIND][2:RAWTOTAL] la 2 cifre imparte la 2 pt ora iar restul e 1 daca e cu :30 minute,:0 daca restul e 0
    {   const lastday = new Date(year, month+1, 0).getDate();
        let startofdayarray = []
        let endofdayarray = []
        for(let i=0; i<lastday; i++)
            {   startofdayarray.push(new Date(year,month,1+i,0,0,0).getTime());
                endofdayarray.push(new Date(year,month,1+i,24,0,0).getTime());
            }
        const ignorefutureovertime=new Date().getMonth()==month;
        const ignoreovertimedate=new Date().getDate();

        userdictarray.forEach(user=>
            {   for(let dayindex=0; dayindex<lastday; dayindex++)
                    {   let day = user.days[dayindex];
                        let list = day.list;
                        let currentdaystart = startofdayarray[dayindex]+day.data.daystart*60000;//  stampday0start+dayindex*24*3600000+user.daystart*60000,
                            currentdayend = endofdayarray[dayindex]-day.data.dayend*60000;//  stampday0end  +dayindex*24*3600000-user.dayend*60000;
                    //0. calculare intarziere permisa (decalare sfarsit zi cu intarzierea de la prima scanare)
                        if(list.length>0)
                            {   let min=currentdayend;
                                for(let i=0;i<list.length;i++)
                                    if(list[i].isstart && list[i].stamp<min)min=list[i].stamp
                                let late=Math.round((min-currentdaystart)/60000);//in minutes
                                if(late>0)
                                    {   if(late>day.data.allowedlatehours*60)
                                            late=day.data.allowedlatehours*60;
                                        if(late>day.data.dayend*60)
                                            late=day.data.dayend*60;
                                        currentdayend+=late*60000;
                                    }
                            }
                    //0_1. calculare minute suplimentare
                        if(list.length>0)
                            {   let start=endofdayarray[dayindex];//they are reversedfor searching
                                let end=startofdayarray[dayindex];
                                for(let i=0;i<list.length;i++)
                                    if(list[i].isstart && list[i].stamp<start)
                                        start=list[i].stamp
                                    else if(!list[i].isstart && list[i].stamp>end)
                                        end=list[i].stamp
                                if(start!=endofdayarray[dayindex]&&end!=startofdayarray[dayindex])
                                    if(end>start)
                                        day.rawminutes = Math.round((end-start)/60000);
                            }
                    

                    //1. rotunjeste la :00/:30 cu intarziere 10->la 30, intarziere 31->la 60
                        if(use15rounding||useadvrounding)
                        list.forEach(elem =>
                            {   let milisec, minutes;
                                if(day.data.clampstartend&&use15rounding||!useadvrounding)//ROTUNJIRE LA JUMATATE DE ORA
                                    {   milisec = Math.floor(elem.stamp-currentdaystart)%3600000;
                                        minutes = Math.floor(milisec/60000)%60;
                                        elem.stamp -= milisec;
                                        if(minutes>15&&minutes<45) elem.stamp+=30*60000;
                                        else if(minutes>=45) elem.stamp+=60*60000;
                                    }
                                else if(!day.data.clampstartend&&useadvrounding||!use15rounding){//ROTUNJIRE minute peste tura: 10->30, 31->60, simetric la venire
                                        if(elem.isstart){   milisec = Math.floor(elem.stamp-currentdaystart)%3600000;
                                                            minutes = Math.floor(milisec/60000)%60;//minute pana la incepere tura
                                                            elem.stamp -= milisec;
                                                            if(minutes<maxlate1){}
                                                            else if(minutes<maxlate2) {elem.stamp+=30*60000;}
                                                            else if(minutes<60) {elem.stamp+=60*60000;}
                                                        }
                                        else{   milisec = Math.floor(currentdayend-elem.stamp)%3600000;
                                                minutes = Math.floor(milisec/60000)%60;//minute pana la terminare tura
                                                elem.stamp += milisec;

                                                if(minutes<maxlate1) {}
                                                else if(minutes<maxlate2) elem.stamp-=30*60000;
                                                else if(minutes<60) elem.stamp-=60*60000;
                                            }
                                    }
                            });

                    //2. resorteaza
                        list.sort((a,b)=>a.stamp-b.stamp);

                    //3. sterge tot ce e in afara starthour,endhour
                        for(let i=0; i<list.length; i++)
                            if(list[i].stamp<currentdaystart)
                                list[i].stamp = currentdaystart;
                            else if(list[i].stamp>currentdayend)
                                list[i].stamp = currentdayend;

                    //4. sterge dublurile
                        for(let i=0;i<list.length-1;i++)
                            {   if(list[i].isstart&&list[i+1].isstart)
                                    {   list.splice(i+1,1); i--; if(i<0) i=0;  }
                                if(!list[i].isstart&&!list[i+1].isstart)
                                    {   list.splice(i,1);   i--; if(i<0) i=0;  }
                            }

                    //5. pune start si end la zi daca [0] si [length-1] nu sunt start si stop
                        if(list.length>0&&!list[0].isstart)
                            list.splice(0,0,{stamp:currentdaystart,isstart:true});
                        if(list.length>0&&list[list.length-1].isstart)
                            list.push({stamp:currentdayend,isstart:false});
                    //6.calculeaza uptime-ul
                        let morningstamp = startofdayarray[dayindex]+morningend*3600000;
                        let nightstamp = startofdayarray[dayindex]+nightstart*3600000;
                        for(let i=1; i<list.length; i+=2)
                            {   let instamp = list[i-1].stamp;
                                let outstamp = list[i].stamp;
                                day.total += outstamp-instamp;//TOTAL
                                if(i<list.length-2) day.break += list[i+1].stamp-outstamp;//PAUZA
                                //CALCUL ORE SEARA (22-06)
                                if(outstamp<morningstamp)//doar dimineata
                                    day.night += outstamp-instamp;
                                else if(instamp>nightstamp)//doar noaptea
                                    day.night += outstamp-instamp;
                                else if(instamp<morningstamp&&outstamp>nightstamp)//dimineata->noapte
                                    day.night += morningstamp-instamp+outstamp-nightstamp;
                                else if(outstamp>morningstamp&&instamp<morningstamp)//dimineata->pranz
                                    day.night += morningstamp-instamp;
                                else if(outstamp>nightstamp&&instamp<nightstamp)//pranz->noapte
                                    day.night += outstamp-nightstamp;
                            }
                        if(list.length>0)
                            {   day.min = list[0].stamp;
                                day.max = list[list.length-1].stamp;
                    //7. trateaza cazul in care rotunjirile dau ca totalul sa fie negativ
                                if(day.max<day.min) day.max=day.min;
                    //8.aduna totalul
                                if(day.data.includebreaks) day.total += day.break;
                                day.break = Math.round(day.break/60000);
                                

                                if(roundtohour){    day.total = Math.round(day.total/3600000)*2;
                                                    day.night = Math.round(day.night/3600000)*2;
                                               }
                                else{   day.total = Math.round(day.total/1800000);//ca sa obti valoarea hours=val/2  min=30*(val%2)
                                        day.night = Math.round(day.night/1800000);
                                    }
                                day.rawtotal = day.total
                                
                                day.rawminutes+=day.activityadd*60;
                                day.total+=day.activityadd;
                                day.rawtotal+=day.activityadd;

                                if(day.data.clamp)
                                    if(day.total>day.data.maxhours*2)
                                        day.total = day.data.maxhours*2;
                                    if(day.rawtotal>day.data.maxhours*2)
                                        day.rawtotal = day.data.maxhours*2;
                            }
                        delete day.list;
                    }
                //FIRST PASS (passing work from co to adjacent days)
                for(let j=0;j<user.days.length;j++)
                    {   let day = user.days[j];
                        if(day.daytype=="w"||day.daytype=="h"||day.daytype=="v")
                            {   if(day.total>0)
                                    {   if(new Date(day.max).getHours()>12)//next day
                                            {   if(j==user.days.length-1) {continue;}//logwarn("Unable to send to next month, "+user.username+" "+j);
                                                let otherday = user.days[j+1];
                                                otherday.total += day.total;
                                                if(otherday.min==0||otherday.max==0||otherday.min==otherday.max)
                                                    {otherday.min=day.min+24*3600000; otherday.max=day.max+24*3600000;}
                                                if(otherday.data.clamp) if(otherday.total>otherday.data.maxhours*2)otherday.total=otherday.data.maxhours*2;
                                                otherday.night += day.night;
                                                otherday.break += day.break;
                                                otherday.rawtotal += day.rawtotal;
                                                day.activ.forEach(activ => {otherday.activ.push(activ);});
                                            }
                                        else{   if(j==0) {continue;}//logwarn("Unable to send to prev month, "+user.username+" "+j);
                                                let otherday = user.days[j-1];
                                                otherday.total += day.total;
                                                if(otherday.min==0||otherday.max==0||otherday.min==otherday.max)
                                                    {otherday.min=day.min-24*3600000; otherday.max=day.max-24*3600000;}
                                                if(otherday.data.clamp) if(otherday.total>otherday.data.maxhours*2)otherday.total=otherday.data.maxhours*2;
                                                otherday.night += day.night;
                                                otherday.break += day.break;
                                                otherday.rawtotal += day.rawtotal;
                                                day.activ.forEach(activ => {otherday.activ.push(activ);});
                                            }//prev day
                                    }
                            }
                    }
                //SECOND PASS
                for(let j=0; j<user.days.length; j++)//d=day info, a=activityes, c=extrahours
                    {   let day = user.days[j]
                        if(day.daytype=="w")
                            {user["d"+(j+1)]=2; user["c"+(j+1)]=0; user["a"+(j+1)]=0;}
                        else if(day.daytype=="h")
                            {user["d"+(j+1)]=3; user["c"+(j+1)]=0; user["a"+(j+1)]=0;}
                        else if(day.daytype=="v")
                            {user["d"+(j+1)]=day.co; user["c"+(j+1)]=0; user["a"+(j+1)]=0;}
                        else if(day.daytype=="n")//FORMAT  [2:START][2:END][4:PAUZA][2:TOTAL][2:SSM][2:SU][2:SIND][2:RAWTOTAL] la 2 cifre imparte la 2 pt ora iar restul e 1 daca e cu :30 minute,:0 daca restul e 0
                            {   //user["d"+(j+1)]=day.total//user.total+=day.total
                                const startofday = startofdayarray[j];//startofmonth+j*24*3600000;//+day.data.daystart*60000
                                const start = day.data.useprint?day.data.printstart:(roundtohour?Math.floor((day.min-startofday)/3600000)*2:Math.floor((day.min-startofday)/1800000));
                                const end = day.data.useprint?day.data.printend:(roundtohour?Math.floor((day.max-startofday)/3600000)*2:Math.floor((day.max-startofday)/1800000));
                                if(start==end||day.min==0||day.max==0)  {user["d"+(j+1)]=0; user["c"+(j+1)]=-day.data.maxhours*60; user["a"+(j+1)]=0;}
                                else{   const val1 = (day.rawtotal+day.night*100+(day.data.unpaidh*10000+day.data.paidh*1000000)).toString().padStart(8,"0").slice(-8);
                                        const val2 = (day.total+day.break*100+end*1000000+start*100000000).toString().slice(-10);

                                        user["d"+(j+1)] = val2+val1;//day report
                                        user["c"+(j+1)] = day.rawminutes-day.data.maxhours*60;//overtime

                                        let activ = 0;
                                        day.activ.forEach(elem => {
                                            activ = activ*10000+elem;//999bln<2^55
                                        });
                                        user["a"+(j+1)] = activ;//activities
                                    }

                            }
                        else log("!!!!! UNKNOWN FORMAT"+" "+day.daytype)
                    }
                for(let j = user.days.length; j<31; j++) user["d"+(j+1)]=1;
                delete user.days

                if(ignorefutureovertime)
                    for(let dayindex=ignoreovertimedate; dayindex<=lastday; dayindex++)
                        user["c"+dayindex] = 0;
            });
    }

//==========================REPORT PRINTING
function generatehtmlreport(fullmonth, year,month,reportArray, vacationarray,activityarray,subgroupdata,suffixarray,printTitle)
    {   let vacationdict = {};
        vacationarray.forEach(elem => {vacationdict[elem.id]=elem;});
        let activitydict = {};
        activityarray.forEach(elem => {activitydict[elem.slot]=elem;});
        let firstdaytype = new Date(year,month,1,3600000*5,0,0,0).getDay();
        const dayspermonth = fullmonth ? 32 : 16;
        let templatepieces = [];
        try {   templatepieces = getfile(fullmonth ? 'pdf_template.html' : 'pdf_template_avans.html').replace(/(\r\n|\n|\r)/gm, "").split("##########");   }
        catch (error) {   throw error;  }

        const ELEMPERPAGE = parseInt(templatepieces[0]);
        let pagefooter = templatepieces[1];
        let pageheader = templatepieces[2];
        const pagebreak = templatepieces[3];
        const htmlheader = templatepieces[4];
        const htmlfooter = templatepieces[5];
        const template = templatepieces[6];


        pageheader = pageheader.replace("{date}",new Date().toISOString().substring(0,10)).replace("{title}",printTitle)
                            .replace("{subgrkeyref}",subgroupdata.key_ref).replace("{subgrname}",subgroupdata.name).replace("{subgrid}",subgroupdata.id)
        for(let i=0;i<5;i++) pagefooter = pagefooter.replace("{signee"+(i+1)+"}",(suffixarray[i].replace(/(\r\n|\n|\r)/gm, "<br>")));
        let htmlpieces = [];
        htmlpieces.push(htmlheader);
        let pagecount = Math.ceil(reportArray.length/ELEMPERPAGE);
        for (let i = 0; i < reportArray.length; i++)
            {   let elem = reportArray[i];

                let totals={days:0,hours:0,hoursavans:0,ssm:0,su:0,sind:0,vcc:0,recens:0,co:0,cm:0,wend:0,dons:0,ccm:0,s8:0,md:0,vm:0,l8:0,cp:0,cpr:0,zlp:0,zln:0,dsi:0,dse:0,bo:0,bp:0,am:0,m:0,ccc:0,cfp:0,night:0,paidh:0,unpaidh:0,totalnotworked:0,totalpayed:0,coh:0,st:0};
                let toappend=template;
                let totalprint1=[],totalprint2=[],startend1=[],startend2=[];
                if(i%ELEMPERPAGE==0&&i>ELEMPERPAGE-1)htmlpieces.push(pagebreak);//page break;
                if(i%ELEMPERPAGE==0)htmlpieces.push(pageheader.replace('{pageNumber}', 1+Math.round(i/ELEMPERPAGE)+"/"+pagecount));
                for(let j = 1; j < dayspermonth; j++)
                    {   let day=processday(elem["d"+j],elem["a" + j],vacationdict,activitydict,true);
                        if(j<16){   totalprint1.push('<td colspan="2">'+day.print+'</td>');
                                    startend1.push('<td >'+day.start+'</td><td>'+day.end+'</td>');
                                }
                        else{   totalprint2.push('<td colspan="2">'+day.print+'</td>');
                                startend2.push('<td>'+day.start+'</td><td>'+day.end+'</td>');
                            }
                        getmonthtotals(day,firstdaytype,j,totals);
                    }
                getmonthtotalsfinals(totals);
                toappend = toappend.replace('{total1}', totalprint1.join(''));
                toappend = toappend.replace('{total2}', totalprint2.join(''));
                toappend = toappend.replace('{startend1}', startend1.join(''));
                toappend = toappend.replace('{startend2}', startend2.join(''));
                toappend = toappend.replace('{emploeeinfo}', (i+1)+')&nbsp;&nbsp;&nbsp;&nbsp;'+elem.matricol+'&nbsp;&nbsp;&nbsp;&nbsp;'+elem.lastName+" "+elem.firstName);
                toappend = toappend.replace('{daysWorkedTotal}', totals.days);
                toappend = toappend.replace('{hoursWorkedTotal}', totals.hours);
                toappend = toappend.replace('{daysMedicalLeaveMonth}', totals.cm);
                toappend = toappend.replace('{daysRestLeaveMonth}', totals.co);
                toappend = toappend.replace('{hoursWorkingWeekendMonth}', totals.wend!=0?totals.wend:'')
                toappend = toappend.replace('{hoursDonBloodMonth}', totals.dons);
                toappend = toappend.replace('{hoursCCMMonth}', totals.ccm);
                toappend = toappend.replace('{hoursPMMonth}', totals.ssm);
                toappend = toappend.replace('{hoursSUMonth}', totals.su);
                toappend = toappend.replace('{hoursSindMonth}', totals.sind);
                toappend = toappend.replace('{hoursVCCMonth}', totals.vcc);
                toappend = toappend.replace('{hoursRECENSMonth}', totals.recens);
                toappend = toappend.replace('{daysVMMonth}', totals.vm);
                toappend = toappend.replace('{hoursNight}', totals.night).replace('{hoursNight}', totals.night);
                toappend = toappend.replace('{technicalUnemployment}', totals.st);

                htmlpieces.push(toappend);
                if(i%ELEMPERPAGE==ELEMPERPAGE-1&&i>0||i==reportArray.length-1){htmlpieces.push(pagefooter);}//footer
            }
        htmlpieces.push(htmlfooter);
        return htmlpieces.join("\n");
    }
function filtermatricols(users,type,matricols)//returns '' if ok, matricol value if not present in users
    {   if(type=='all') return '';
        if(typeof type!='string'||typeof matricols!='string') return '';
        if(matricols=='') return 'Lipsesc matricolele.';
        let matricoldict = {};
        let matricolarray = matricols.split(';');
        for(let i=0;i<matricolarray.length;i++) matricoldict[parseInt(matricolarray[i])]=true;
        if(type=='white')
            {   let todelete=[];
                for(let i=0;i<users.length;i++) 
                    if(!matricoldict.hasOwnProperty(users[i].matricol))
                        {   users.splice(i,1); 
                            i--;
                        }
                    else todelete.push(users[i].matricol);
                for(let i=0;i<todelete.length;i++)
                    delete matricoldict[todelete[i]];
            }
        if(type=='black')
            {   let todelete=[];
                for(let i=0;i<users.length;i++) if(matricoldict.hasOwnProperty(users[i].matricol))
                    { todelete.push(users[i].matricol); users.splice(i,1);i--; }
                for(let i=0;i<todelete.length;i++)
                    delete matricoldict[todelete[i]];
            }

        let remaining = Object.keys(matricoldict);
        if(remaining.length>0)  return 'Matricolul '+remaining[0]+" nu se gaseste in subgrupa.";
        if(users.length==0)     return "Nu se poate filtra toata subgrupa.";
        return '';
    }
function generatePDFreportFromHTML(html, result)
    {
        wkhtmltopdf.command = '"'+process.cwd()+'\\wkhtmltopdf.exe'+'"';
        const stamp = new Date().getTime();
        const pdfname = 'exportedPDF' + new Date().getTime() + '.pdf';
        wkhtmltopdf(html, {pageSize: 'A4', orientation: 'Landscape', output:pdfname, spawnOptions:{shell: true}},
                (err) => {
                    let params = {};
                    params.time = new Date().getTime() - stamp;
                    if(err != null){
                        params.error = err.message;
                    } else {
                        if(fs.existsSync(pdfname))
                        {
                            params.filebytes = fs.readFileSync(pdfname);
                            setTimeout(() => {
                                fs.unlinkSync(pdfname);
                            }, 1000);
                        } else {
                                params.error= "Eroare generare PDF. Fisierul nu a fost gasit."
                            }
                    }
                    result(params);
                }
            );
}
function generatecsvreport(fullmonth,year,month,dataarray,vacationarray,activityarray,subgroupdata)
    {   let vacationdict = {};
        vacationarray.forEach(elem => {vacationdict[elem.id]=elem;});
        let activitydict = {};
        activityarray.forEach(elem => {activitydict[elem.slot]=elem;});
        let daycount = fullmonth?new Date(year,month+1,0).getDate():15;
        //GEN HEADERS
        let tempstring1 = ""
        for(let i=1; i<daycount+1; i++) tempstring1+=","+i;
        let csvarray = [];
        csvarray.push("MATRICOL,NUME,Total Zile Lucrate,Total Ore Lucrate,Total zile CO,Total zile CM,OreSD,OreDonS,OreCCM,OreSSM,OreSU,OreSind,OreVCC,RECENS"+tempstring1);
        let firstdaytype = new Date(year,month,1,3600000*5,0,0,0).getDay();
        //GEN DATA
        dataarray.forEach(elem => {
            let tempstring2 = "";
            let totals = {days:0,hours:0,hoursavans:0,co:0,cm:0,wend:0,dons:0,ccm:0,ssm:0,su:0,sind:0,s8:0,md:0,vcc:0,recens:0,vm:0,l8:0,cp:0,cpr:0,zlp:0,zln:0,dsi:0,dse:0,bo:0,bp:0,am:0,m:0,ccc:0,cfp:0,night:0,paidh:0,unpaidh:0,totalnotworked:0,totalpayed:0,coh:0,st:0}
            for (let i = 1; i < daycount + 1; i++) {
                let day = processday(elem["d" + i],elem["a" + i], vacationdict,activitydict,true)
                getmonthtotals(day,firstdaytype,i,totals);
                tempstring2 += "," + (day.print);
            }
            getmonthtotalsfinals(totals);
            csvarray.push(elem.matricol + ","
                    + elem.lastName + " " + elem.firstName + ","
                    + totals.days +"," + totals.hours + "," + totals.co + "," + totals.ccm + ","+ totals.wend + ","
                    + totals.dons + ","+ totals.ccm + ","+ totals.ssm + ","+ totals.su + ","+ totals.sind + ","
                    + totals.vcc + "," + totals.recens + ""
                    + tempstring2
                );
        });
        //GEN FOOTER
        csvarray.push("Luna:,"+monthnames[month]+" "+year);
        csvarray.push("Angajati:,"+dataarray.length);
        csvarray.push("Grupa:,"+subgroupdata.code+"-"+subgroupdata.name);
        csvarray.push("Generat:,"+getcurrenttime());
        return csvarray.join("\n");
    }

async function generateClockingFile(year, month, dataArray, vacationArray, activityArray, subgroupData, groupData, unitData, genTime, res, signees, type) {
    const TEMPLATE_FILE = type === "concedii" ? "xcell_concedii.json" 
                        : (type === "prezenta" ? "xcell_condica_prezenta.json" 
                        : (type === "ore suplimentare" ? "xcell_ore_suplimentare.json"
                        : (type === "xlsx" ? "xcelltemplate_original.json"
                        : (type === "grafic" ? "xcell_grafic.json"
                        : undefined))));
    let vacationdict = {};
    vacationArray.forEach(elem => {vacationdict[elem.id]=elem;});
    const VACATION_CODES = new Set();
    vacationArray.forEach(elem => VACATION_CODES.add(elem.code.split('(')[0]));
    let activitydict = {};
    activityArray.forEach(elem => {activitydict[elem.slot]=elem;});
    const dayCount = new Date(year, month + 1, 0).getDate();
    const FIRST_DAY_TYPE = new Date(year,month,1,3600000*5,0,0,0).getDay();
    let userIndex = 1;

    const EMPLOYEE_TOTAL_HOURS_ID = 0;
    const EMPLOYEE_START_HOURS_ID = 1;
    const EMPLOYEE_END_HOURS_ID = 2;
    const EMPLOYEE_BREAK_HOURS_ID = 3;

    const wb = new xl.Workbook();
    const ws = wb.addWorksheet(`Foaie-${type.split(" ")[0]}-${month + 1}-${year}`, {
        pageSetup:{paperSize: "A4_PAPER", orientation: "landscape", fitToWidth: 1, fitToHeight: 0}
    });

    const template = JSON.parse(getfile(TEMPLATE_FILE));

    let mergedVerticalCells = 1;
    const employeesTemplate = [];

    template.sets.forEach(set => {
        if (set.employeeData) {
            employeesTemplate.push(set);
            mergedVerticalCells = (typeof set.lx === "number") ? Math.max(mergedVerticalCells, set.lx) : mergedVerticalCells;
        } else {
            for (let i = 0; i < set.lines.length; i++) {
                try {
                    if (set.linesAreDays && parseInt(set.lines[i]) > dayCount) {
                        continue;
                    }
                } catch {
                    continue;
                }
                const x = set.x + (set.horizontal ? 0 : i) + (typeof set.belowTableMultiplier === "number" 
                                                            ? dataArray.length * set.belowTableMultiplier : 0);
                const y = set.y + (set.horizontal ? i : 0) + (set.addDayCountToY ? dayCount : 0);
                const lx = set.lx ? (x + set.lx - 1) : x;
                const ly = set.ly ? (y + set.ly - 1 + (set.addDayCountToLY ? dayCount - 1 : 0)) : y;
                let toPrint = set.lines[i].toString().replace("{month}",monthnames[month]).replace("{year}",year)
                            .replace("{subgroupname}",subgroupData.name).replace("{subgroupkey_ref}",subgroupData.key_ref)
                            .replace("{groupname}",groupData.name).replace("{groupkey_ref}",groupData.key_ref)
                            .replace("{unitname}",unitData.name).replace("{dntm}");
                for (let i = 0; i < 5; i++) {
                    toPrint = toPrint.replace("{signee" + (i + 1) + "}", signees[i]);
                }
                ws.cell(x, y, lx, ly, set.lx || set.ly).string(toPrint).style(set.style ? set.style : {});
                if(set.height) {
                    ws.row(x).setHeight(set.height);
                }
                if(set.width) {
                    ws.column(y).setWidth(set.width);
                }
            }
        }  
    });
    dataArray.forEach((elem) => {
        let employee = {
            index: userIndex,
            name: elem.lastName + " " + elem.firstName,
            matricol: elem.matricol,
            scheduleInfo: [[], [], [], []], //1st array: total, 2nd: start, 3rd: end, 4th: break
            totalVacationDays: 0,
            totalMonthHours: formathour(elem.total),
            totalTrimestruHours: formathour(elem.ballance),
            lateDays: elem.numOfLateDays,
            days:0, hours:0, hoursavans:0, 
            co:0,cm:0,wend:0,dons:0,ccm:0,ssm:0,su:0,sind:0,s8:0,md:0,vcc:0,recens:0,vm:0,l8:0,cp:0,cpr:0,zlp:0,zln:0,dsi:0,dse:0,bo:0,bp:0,am:0,m:0,ccc:0,cfp:0,night:0,
            paidh:0,unpaidh:0,totalnotworked:0,totalpayed:0,coh:0,st:0
        };

        const total_hours = [];
        const start_hours = [];
        const end_hours = [];
        const break_hours = [];

        for (let i = 1; i <= dayCount; i++) {
            if (type === "ore suplimentare") {
                total_hours.push(elem["a" + i]);
            } else if (type === "prezenta") {
                start_hours.push(elem.start[i - 1]);
                end_hours.push(elem.end[i - 1]);
            } else {
                const day = processday(elem["d" + i], elem["a" + i], vacationdict, activitydict,true);
                getmonthtotals(day, FIRST_DAY_TYPE, i, employee);
                if (day.print === "L") {
                    total_hours.push("L");
                    start_hours.push("L");
                    end_hours.push("L");
                    break_hours.push("L");
                } else if (VACATION_CODES.has(day.print)) {
                    total_hours.push(day.print);
                    start_hours.push(day.print);
                    end_hours.push(day.print);
                    break_hours.push(day.print);
                } else {
                    if (type === "concedii") {
                        total_hours.push("");
                    } else {
                        total_hours.push(day.print === "0" ? "" : day.print.toString());
                    }
                    start_hours.push(day.start === "&nbsp;" ? "" : day.start.toString());
                    end_hours.push(day.end === "&nbsp;" ? "" : day.end.toString());
                    break_hours.push(day.break === 0 ? "" : day.break.toString());
                }
            }
        }
        getmonthtotalsfinals(employee);
        employee.scheduleInfo = [total_hours, start_hours, end_hours, break_hours];
        employee.totalVacationDays = [total_hours.filter((vacation) => VACATION_CODES.has(vacation)).length];

        employeesTemplate.forEach((set) => {
            let toPrint;
            let dayNumber;
            let scheduleInfoID;
            for (let i = 0; i < set.lines.length; i++) {
                const x = set.x + (set.horizontal ? 0 : i) + (typeof set.belowTableMultiplier === "number" ? dataArray.length * set.belowTableMultiplier : 0) 
                        + ((userIndex - 1) * mergedVerticalCells);
                const y = set.y + (set.horizontal ? i : 0) + (set.addDayCountToY ? dayCount : 0);
                const lx = set.lx ? (x + set.lx - 1) : x;
                const ly = set.ly ? (y + set.ly - 1 + (set.addDayCountToLY ? dayCount - 1 : 0)) : y;
                if (!set.lines[i].includes("{")) {
                    if (typeof employee[set.lines[i]] === "undefined") {
                        toPrint = set.lines[i].toString();
                    } else {
                        toPrint = employee[set.lines[i]].toString();
                    }
                } else {
                    try {
                        const SCHEDULE_INFO_FIELD = set.lines[i].split("_")[0].replace("{", "");
                        scheduleInfoID = SCHEDULE_INFO_FIELD === "zi" ? EMPLOYEE_TOTAL_HOURS_ID 
                                        : (SCHEDULE_INFO_FIELD === "start" ? EMPLOYEE_START_HOURS_ID
                                        : (SCHEDULE_INFO_FIELD === "sfarsit" ? EMPLOYEE_END_HOURS_ID 
                                        : (SCHEDULE_INFO_FIELD === "pauza" ? EMPLOYEE_BREAK_HOURS_ID
                                        : undefined)));
                        dayNumber = parseInt(set.lines[i].split("_")[1].replace("}", ""));
                        if (typeof scheduleInfoID !== "number" 
                            || typeof employee.scheduleInfo[scheduleInfoID][dayNumber - 1] === "undefined") {
                                set.lines.splice(i, 1);
                                continue;  
                        }
                        toPrint = employee.scheduleInfo[scheduleInfoID][dayNumber - 1];
                        if(type === "ore suplimentare")
                            toPrint = formathour(toPrint);
                    } catch {
                        set.lines.splice(i, 1);
                        continue;
                    }
                }
                const CELL = ws.cell(x, y, lx, ly, set.lx || set.ly).string(toPrint).style(set.style ? set.style : {});
                if (set.height) {
                    ws.row(x).setHeight(set.height);
                }
                if (set.width) {    //maybe add auto width based on toPrint.length
                    ws.column(y).setWidth(set.width);
                } 
                if (["concedii", "prezenta"].includes(type)) {
                    if (set.RED_FILL && typeof scheduleInfoID === "number" 
                        && employee.scheduleInfo[scheduleInfoID][dayNumber - 1] === "L") {
                        CELL.style(set.RED_FILL);
                    }
                    if (set.YELLOW_FILL && typeof scheduleInfoID === "number" 
                        && VACATION_CODES.has(employee.scheduleInfo[scheduleInfoID][dayNumber - 1])) {
                        CELL.style(set.YELLOW_FILL);
                    }
                }
                else if (type === "ore suplimentare") {
                    if (set.RED_FILL && typeof scheduleInfoID === "number" 
                        && employee.scheduleInfo[scheduleInfoID][dayNumber - 1] < 0) {
                        CELL.style(set.RED_FILL);
                    }
                    if (set.GREEN_FILL && typeof scheduleInfoID === "number" 
                        && employee.scheduleInfo[scheduleInfoID][dayNumber - 1] > 0) {
                        CELL.style(set.GREEN_FILL);
                    }
                }
            }
        })
        
        userIndex++;
    });

    let toreturn=[];
    await wb.writeToBuffer().then(function(buffer) {   
        toreturn = buffer;
    });
    return toreturn;

}

async function generateGraficLucru(year, month, dataArray, shiftsArray, vacationArray, activityArray, subgroupData, groupData, unitData, signees, DNTM) {
    const TEMPLATE_FILE = "xcell_grafic.json";
    let vacationdict = {};
    vacationArray.forEach(elem => {vacationdict[elem.id]=elem;});
    let activitydict = {};
    activityArray.forEach(elem => {activitydict[elem.slot]=elem;});
    const dayCount = new Date(year, month + 1, 0).getDate();
    const FIRST_DAY_TYPE = new Date(year,month,1,3600000*5,0,0,0).getDay();
    let userIndex = 1;

    const STYLE_WRAP_BOLD_CENTERED = {
        "border": {
            "left": { "style": "thin" },
            "right": { "style": "thin" },
            "top": { "style": "thin" },
            "bottom": { "style": "thin" }
        },
        "alignment": { "wrapText": true, "horizontal": "center", "vertical": "center" },
        "font": { "bold": true, "size": 8, "name": "Arial" }
    };
    const STYLE_CENTERED = {
        "border": {
            "left": { "style": "thin" },
            "right": { "style": "thin" },
            "top": { "style": "thin" },
            "bottom": { "style": "thin" }
        },
        "alignment": { "horizontal": "center", "vertical": "center" },
        "font": { "size": 8, "name": "Arial" }
    };

    const wb = new xl.Workbook();
    const ws = wb.addWorksheet(`Foaie-grafic-${month + 1}-${year}`, {
        pageSetup:{paperSize: "A4_PAPER", orientation: "landscape", fitToWidth: 1, fitToHeight: 0}
    });

    const template = JSON.parse(getfile(TEMPLATE_FILE));

    let mergedVerticalCells = 1;
    const employeesTemplate = [];

    template.sets.forEach(set => {
        if (set.employeeData) {
            employeesTemplate.push(set);
            mergedVerticalCells = (typeof set.lx === "number") ? Math.max(mergedVerticalCells, set.lx) : mergedVerticalCells;
        } else {
            for (let i = 0; i < set.lines.length; i++) {
                try {
                    if (set.linesAreDays && parseInt(set.lines[i]) > dayCount) {
                        continue;
                    }
                } catch {
                    continue;
                }
                const x = set.x + (set.horizontal ? 0 : i) + (typeof set.belowTableMultiplier === "number" 
                                                            ? (dataArray.length + shiftsArray.length) * set.belowTableMultiplier : 0);
                const y = set.y + (set.horizontal ? i : 0) + (set.addDayCountToY ? dayCount : 0);
                const lx = set.lx ? (x + set.lx - 1) : x;
                const ly = set.ly ? (y + set.ly - 1 + (set.addDayCountToLY ? dayCount - 1 : 0)) : y;
                let toPrint = set.lines[i].toString().replace("{month}",monthnames[month]).replace("{year}",year)
                            .replace("{subgroupname}",subgroupData.name).replace("{subgroupkey_ref}",subgroupData.key_ref)
                            .replace("{groupname}",groupData.name).replace("{groupkey_ref}",groupData.key_ref)
                            .replace("{unitname}",unitData.name).replace("{dntm}", DNTM.toString());
                for (let i = 0; i < 5; i++) {
                    toPrint = toPrint.replace("{signee" + (i + 1) + "}", signees[i]);
                }
                ws.cell(x, y, lx, ly, set.lx || set.ly).string(toPrint).style(set.style ? set.style : {});
                if(set.height) {
                    ws.row(x).setHeight(set.height);
                }
                if(set.width) {
                    ws.column(y).setWidth(set.width);
                }
            }
        }  
    });

    const usersWithId = {};
    dataArray.forEach(user => {
        usersWithId[user.userid] = user;
    })

    const START_X = 19;
    const START_Y = 1;
    let rows = 0;

    shiftsArray.forEach(shift => {
        ws.cell(START_X + rows, START_Y + 2).string(shift.name).style(STYLE_WRAP_BOLD_CENTERED);
        shift.users.forEach((user) => {
            let workedHours = 0;
            const elem = usersWithId[user.id];
            let employee = {
                index: userIndex,
                name: elem.lastName + " " + elem.firstName,
                matricol: elem.matricol,
                scheduleInfo: [[], [], [], []], //1st array: total, 2nd: start, 3rd: end, 4th: break
                days:0, hours:0, hoursavans:0, 
                co:0,cm:0,wend:0,dons:0,ccm:0,ssm:0,su:0,sind:0,s8:0,md:0,vcc:0,recens:0,vm:0,l8:0,cp:0,cpr:0,zlp:0,zln:0,dsi:0,dse:0,bo:0,bp:0,am:0,m:0,ccc:0,cfp:0,night:0,
                paidh:0,unpaidh:0,totalnotworked:0,totalpayed:0,coh:0,st:0
            };
            
            const total_hours = [];
            const start_hours = [];
            const end_hours = [];
            const break_hours = [];
            
            for (let i = 1; i <= dayCount; i++) {
                const day = processday(elem["d" + i], elem["a" + i], vacationdict, activitydict,true);
                getmonthtotals(day, FIRST_DAY_TYPE, i, employee);
            }
            getmonthtotalsfinals(employee);
            employee.scheduleInfo = [total_hours, start_hours, end_hours, break_hours];

            const x = START_X + rows + shift.users.indexOf(user) + 1;
            ws.cell(x, START_Y).string(employee.index.toString()).style(STYLE_CENTERED);
            ws.cell(x, START_Y + 1).string("").style(STYLE_CENTERED);
            ws.cell(x, START_Y + 2).string(employee.name).style(STYLE_CENTERED);
            ws.cell(x, START_Y + 3).string(employee.matricol.toString()).style(STYLE_CENTERED);

            for (let i = 1; i <= dayCount; i++) {
                workedHours += (typeof user.days[i - 1].total === "string") ? 0 : user.days[i - 1].total;
                const printDay = (user.days[i - 1].total === 0) ? "" : user.days[i - 1].total.toString();
                ws.cell(x, START_Y + 3 + i).string(printDay).style(STYLE_CENTERED);
            }

            ws.cell(x, START_Y + dayCount + 4).string(workedHours.toString()).style(STYLE_CENTERED);
            ws.cell(x, START_Y + dayCount + 5).string(employee.co.toString()).style(STYLE_CENTERED);
            ws.cell(x, START_Y + dayCount + 6).string(employee.cp.toString()).style(STYLE_CENTERED);
            ws.cell(x, START_Y + dayCount + 7).string("").style(STYLE_CENTERED);
            ws.cell(x, START_Y + dayCount + 8).string(employee.unpaidh.toString()).style(STYLE_CENTERED);
            ws.cell(x, START_Y + dayCount + 9).string(employee.bo.toString()).style(STYLE_CENTERED);
            ws.cell(x, START_Y + dayCount + 10).string(employee.zln.toString()).style(STYLE_CENTERED);
            ws.cell(x, START_Y + dayCount + 11).string(employee.st.toString()).style(STYLE_CENTERED);
            ws.cell(x, START_Y + dayCount + 12).string(employee.l8.toString()).style(STYLE_CENTERED);
            ws.cell(x, START_Y + dayCount + 13).string(employee.paidh.toString()).style(STYLE_CENTERED);
            ws.cell(x, START_Y + dayCount + 14).string("").style(STYLE_CENTERED);
            ws.cell(x, START_Y + dayCount + 15).string("").style(STYLE_CENTERED);

            userIndex++;
        });
        rows += shift.users.length + 1;
    })

    ws.cell(START_X - 3, dayCount + 5).string(DNTM.toString()).style(STYLE_WRAP_BOLD_CENTERED);

    let toreturn=[];
    await wb.writeToBuffer().then(function(buffer) {   
        toreturn = buffer;
    });
    return toreturn;
}

async function generateRaportDeszapezire(year, month, dataArray, shiftsArray, vacationArray, activityArray, subgroupData, signees) {
    const TEMPLATE_FILE = "xcell_deszapezire.json";
    let vacationdict = {};
    vacationArray.forEach(elem => {vacationdict[elem.id]=elem;});
    let activitydict = {};
    activityArray.forEach(elem => {activitydict[elem.slot]=elem;});
    const dayCount = new Date(year, month + 1, 0).getDate();
    let userIndex = 1;

    const STYLE_WRAP_BOLD_CENTERED = {
        "border": {
            "left": { "style": "thin" },
            "right": { "style": "thin" },
            "top": { "style": "thin" },
            "bottom": { "style": "thin" }
        },
        "alignment": { "wrapText": true, "horizontal": "center", "vertical": "center" },
        "font": { "bold": true, "size": 8, "name": "Arial" }
    };
    const STYLE_CENTERED = {
        "border": {
            "left": { "style": "thin" },
            "right": { "style": "thin" },
            "top": { "style": "thin" },
            "bottom": { "style": "thin" }
        },
        "alignment": { "horizontal": "center", "vertical": "center" },
        "font": { "size": 8, "name": "Arial" }
    };

    const wb = new xl.Workbook();
    const ws = wb.addWorksheet(`Foaie-deszapezire-${month + 1}-${year}`, {
        pageSetup:{paperSize: "A4_PAPER", orientation: "landscape", fitToWidth: 1, fitToHeight: 0}
    });

    const template = JSON.parse(getfile(TEMPLATE_FILE));

    let mergedVerticalCells = 1;
    const employeesTemplate = [];

    template.sets.forEach(set => {
        if (set.employeeData) {
            employeesTemplate.push(set);
            mergedVerticalCells = (typeof set.lx === "number") ? Math.max(mergedVerticalCells, set.lx) : mergedVerticalCells;
        } else {
            for (let i = 0; i < set.lines.length; i++) {
                try {
                    if (set.linesAreDays && parseInt(set.lines[i]) > dayCount) {
                        continue;
                    }
                    if (set.linesAreZN && i >= dayCount * 2) {
                        continue;
                    }
                } catch {
                    continue;
                }
                const x = set.x + (set.horizontal ? 0 : i) + (typeof set.belowTableMultiplier === "number" 
                                                            ? (dataArray.length + shiftsArray.length) * set.belowTableMultiplier : 0);
                const y = set.y + (set.horizontal ? i * (set.ly ? set.ly : 1) : 0) + (set.addDayCountToY ? dayCount : 0);
                const lx = set.lx ? (x + set.lx - 1) : x;
                const ly = set.ly ? (y + set.ly - 1 + (set.addDayCountToLY ? dayCount - 1 : 0)) : y;
                let toPrint = set.lines[i].toString().replace("{month}",monthnames[month].toUpperCase()).replace("{year}",year).replace("{subgroupCode}",subgroupData.code);
                for (let i = 0; i < 5; i++) {
                    toPrint = toPrint.replace("{signee" + (i + 1) + "}", signees[i]);
                }
                ws.cell(x, y, lx, ly, set.lx || set.ly).string(toPrint).style(set.style ? set.style : {});
                if(set.height) {
                    ws.row(x).setHeight(set.height);
                }
                if(set.width) {
                    ws.column(y).setWidth(set.width);
                }
            }
        }  
    });

    const usersWithId = {};
    dataArray.forEach(user => {
        usersWithId[user.userid] = user;
    })

    const START_X = 15;
    const START_Y = 1;
    let rows = 0;

    shiftsArray.forEach(shift => {
        ws.cell(START_X + rows, START_Y + 1).string(shift.name).style(STYLE_WRAP_BOLD_CENTERED);
        shift.users.forEach((user) => {
            const elem = usersWithId[user.id];
            let employee = {
                index: userIndex,
                name: elem.lastName + " " + elem.firstName,
                matricol: elem.matricol,
                scheduleInfo: [[], [], [], []], //1st array: total, 2nd: start, 3rd: end, 4th: break
            };
            
            const total_hours = [];
            const start_hours = [];
            const end_hours = [];
            const break_hours = [];
            
            for (let i = 1; i <= dayCount; i++) {
                processday(elem["d" + i], elem["a" + i], vacationdict, activitydict,true);
            }
            employee.scheduleInfo = [total_hours, start_hours, end_hours, break_hours];

            const x = START_X + rows + shift.users.indexOf(user) + 1;
            ws.cell(x, START_Y).string(employee.index.toString()).style(STYLE_CENTERED);
            ws.cell(x, START_Y + 1).string(employee.name).style(STYLE_CENTERED);
            ws.cell(x, START_Y + 2).string(employee.matricol.toString()).style(STYLE_CENTERED);

            for (let i = 0; i < dayCount; i++) {
                let zInfo = " ";
                let nInfo = " ";
                const dayInfo = user.days[i].total;
                if (["Z", "Z4"].includes(dayInfo)) {
                    zInfo = dayInfo;
                } else if (dayInfo >= 10) {
                    zInfo = "z";
                }
                if (dayInfo === "N") {
                    nInfo = dayInfo;
                } else if (dayInfo > 3 && dayInfo < 10) {
                    nInfo = "n";
                }
                ws.cell(x, START_Y + 3 + i * 2).string(zInfo).style(STYLE_CENTERED);
                ws.cell(x, START_Y + 3 + i * 2 + 1).string(nInfo).style(STYLE_CENTERED);
            }

            userIndex++;
        });
        rows += shift.users.length + 1;
    })

    let toreturn=[];
    await wb.writeToBuffer().then(function(buffer) {   
        toreturn = buffer;
    });
    return toreturn;

}

async function generateReportCoYear(data,sgname,month,year,res,signees,usermapping,gentime)
    {   //DATA PROCESSING
        let users={};
        let index=1;
        data.forEach(monthdata=>
            {   if(!usermapping.hasOwnProperty(monthdata.userid))
                    {   logwarn("Can't generate report for missing user "+monthdata.userid);
                        return;
                    }
                let user=usermapping[monthdata.userid];
                if(!users.hasOwnProperty(monthdata.userid))
                    users[monthdata.userid]={index:index++,first_name:user.first_name,last_name:user.last_name,matricol:user.matricol,
                                             colastyear:0,coleft:0,codays:user.codays,colastyearleft:0,
                                             m1:0,m2:0,m3:0,m4:0,m5:0,m6:0,m7:0,m8:0,m9:0,m10:0,m11:0,m12:0,
                                             l1:0,l2:0,l3:0,l4:0,l5:0,l6:0,l7:0,l8:0,l9:0,l10:0,l11:0,l12:0,total:0};
                let u=users[monthdata.userid];
                u["l"+(Math.trunc(monthdata.date%100+1))]=monthdata.co;
                
                u.colastyear=monthdata.colastyear;
                u.colastyearleft=monthdata.colastyear;
            });
        let usersarray=Object.values(users).sort((a,b)=>{return a.index>b.index?1:-1;});
        usersarray.forEach(user => {//consumming co days from last year first then from current year
            let colastyear=user.colastyear;
            for(let i=1;i<13;i++)if(user["l"+i]>0)
                if(colastyear<=0){user["m"+i]=user["l"+i];  user["l"+i]=0;}
                else if(user["l"+i]<colastyear){colastyear-=user["l"+i];}
                else {user["m"+i]=user["l"+i]-colastyear;user["l"+i]=colastyear;colastyear=0;}
            user.colastyearleft=colastyear;

            for(let i=1;i<13;i++)if(user["m"+i]>0)
                {   user.total+=user["m"+i];
                }
            user.coleft=user.codays-user.total;
        });
        //BUILDING XCELL MODEL
        const wb = new xl.Workbook();
            
        const ws = wb.addWorksheet('Raport_'+year+'_'+(month+1),{
            "sheetFormat": {"baseColWidth": 8}, 
            pageSetup:{paperSize: "A4_PAPER", orientation: "landscape", fitToWidth: 1, fitToHeight: 0}
        });
        
        let template = JSON.parse(getfile("xcell_co_year.json"));
        let emploeetemplate = [];
        const ROWS_PER_USER=typeof template.rowsperuser=="number"?template.rowsperuser:1;

        template.sets.forEach(set => //x merge in jos, y la dreapta
            {   if(set.isemploee)emploeetemplate.push(set);
                else for(let i=0;i<set.lines.length;i++)
                    {   let x = set.x+(set.horizontal?0:i)+(set.belowtable?dataarray.length*ROWS_PER_USER:0);
                        let y = set.y+(set.horizontal?i:0)+(set.adddaycounttoy?daycount:0);
                        let lx = set.lx?x+set.lx-1:x;
                        let ly = set.ly?y+set.ly-1+(set.adddaycounttoly?daycount:0):y;
                        let toprint = set.lines[i].toString().replace("{year}",year).replace("{subgroupname}",sgname)
                        for(let i=0;i<5;i++) toprint=toprint.replace("{signee"+(i+1)+"}",signees[i]);
                        ws.cell(x, y, lx, ly,(set.lx||set.ly)?true:false).string(toprint).style(set.style?set.style:{});
                        if(set.height) ws.row(x).setHeight(set.height);
                        if(set.width)  ws.column(y).setWidth(set.width);
                    }
            });
        let userindex=1;
        usersarray.forEach(user =>
            {   emploeetemplate.forEach(set =>
                    {   let skip28293031 = 0;
                        for(let i=0;i<set.lines.length;i++)
                            {   let x = set.x+(set.horizontal?0:i)+(userindex-1)*ROWS_PER_USER;
                                let y = set.y+(set.horizontal?i:0)-skip28293031;
                                let lx = (set.lx?x+set.lx-1:x);
                                let ly = (set.ly?y+set.ly-1:y);
                                let value=set.lines[i].length>0?user[set.lines[i]]:"";
                                if(value===0)value=set.hide0?"":"0";
                                else value=""+value;
                                let cell = ws.cell(x, y, lx, ly,(set.lx||set.ly)?true:false).string(value).style(set.style?set.style:{});
                                if(set.height) ws.row(x).setHeight(set.height);
                                if(set.width) ws.column(y).setWidth(set.width);
                            }
                    });
                userindex++;
            });

        let toreturn=[];
        await wb.writeToBuffer().then(function(buffer) {   
            toreturn = buffer;
        });
        return toreturn;
}
async function generate_xlsx_overtime(year,month,dataarray,fullsubgroupdata,signees,filename)
    {   let userindex = 1;

        const wb = new xl.Workbook();
        const ws = wb.addWorksheet('Raport_'+year+'_'+(month+1),{
            "sheetFormat": {"baseColWidth": 2},
            pageSetup:{paperSize: "A4_PAPER", orientation: "landscape", fitToWidth: 1, fitToHeight: 0}
        });

        let template = JSON.parse(getfile(filename));

        let emploeetemplate = [];

        template.sets.forEach(set => //x merge in jos, y la dreapta
            {   if(set.isemploee)emploeetemplate.push(set);
                else for(let i=0;i<set.lines.length;i++)
                    {   let x = set.x+(set.horizontal?0:i)+(set.belowtable?dataarray.length:0);
                        let y = set.y+(set.horizontal?i:0)+(set.adddaycounttoy?daycount:0);
                        let lx = set.lx?x+set.lx-1:x;
                        let ly = set.ly?y+set.ly-1+(set.adddaycounttoly?daycount:0):y;
                        let toprint = set.lines[i].toString().replace("{month}",monthnames[month]).replace("{year}",year)
                            .replace("{subgroupname}",fullsubgroupdata.sgname).replace("{subgroupkey_ref}",fullsubgroupdata.sgkeyref)
                            .replace("{groupname}",fullsubgroupdata.gname).replace("{groupkey_ref}",fullsubgroupdata.gkeyref)
                            .replace("{unitname}",fullsubgroupdata.uname).replace("{month1last}",monthnames[(month+11)%12])
                            .replace("{month2last}",monthnames[(month+10)%12]).replace("{month3last}",monthnames[(month+9)%12]);
                        for(let i=0;i<5;i++) toprint=toprint.replace("{signee"+(i+1)+"}",signees[i]);
                        ws.cell(x, y, lx, ly,(set.lx||set.ly)?true:false).string(toprint).style(set.style?set.style:{});
                        if(set.height) ws.row(x).setHeight(set.height);
                        if(set.width)  ws.column(y).setWidth(set.width);
                    }
            });
        dataarray.forEach(elem =>
            {   elem.index=userindex;
                emploeetemplate.forEach(set =>
                    {   for(let i=0;i<set.lines.length;i++)
                            {   let x = set.x+(set.horizontal?0:i)+(set.belowtable?dataarray.length:0)+userindex-1;
                                let y = set.y+(set.horizontal?i:0);
                                let lx = (set.lx?x+set.lx-1:x);
                                let ly = (set.ly?y+set.ly-1:y);
                                ws.cell(x, y, lx, ly,(set.lx||set.ly)?true:false).string(""+elem[set.lines[i]]).style(set.style?set.style:{});
                                if(set.height) ws.row(x).setHeight(set.height);
                                if(set.width) ws.column(y).setWidth(set.width);
                            }
                    });
                userindex++;
            });

        let toreturn=[];
        await wb.writeToBuffer().then(function(buffer) {   
            toreturn = buffer;
        });
        return toreturn;
    }
//UNIT TESTING:con sole.log(generateCSVFromReport(2022,4,[{matricol:123,firstName:"Andrei",lastName:"Popescu",d1:123415110000}],[],[{name:"AAA",code:"123"}],true));
async function generatexlsxreport(year,month,dataarray,vacationarray,activityarray,subgroupdata,groupdata,unitdata,signees, DNTM, unfinishedReport,filename,isfullmonth)
    {   let vacationdict = {};
        vacationarray.forEach(elem => {vacationdict[elem.id]=elem;});
        let activitydict = {};
        activityarray.forEach(elem => {activitydict[elem.slot]=elem;});
        let daycount = new Date(year,month+1,0).getDate();

        let firstdaytype = new Date(year,month,1,3600000*5,0,0,0).getDay();
        let userindex = 1;

        const wb = new xl.Workbook();
        const ws = wb.addWorksheet('Raport_'+year+'_'+(month+1),{
            "sheetFormat": {"baseColWidth": 2},
            pageSetup:{paperSize: "A4_PAPER", orientation: "landscape", fitToWidth: 1, fitToHeight: 0}
        });

        let template = JSON.parse(getfile(filename));

        let emploeetemplate = [];

        template.sets.forEach(set => //x merge in jos, y la dreapta
            {   if(set.isemploee)emploeetemplate.push(set);
                else for(let i=0;i<set.lines.length;i++)
                    {   let x = set.x+(set.horizontal?0:i)+(set.belowtable?dataarray.length:0);
                        let y = set.y+(set.horizontal?i:0)+(set.adddaycounttoy?daycount:0);
                        let lx = set.lx?x+set.lx-1:x;
                        let ly = set.ly?y+set.ly-1+(set.adddaycounttoly?daycount:0):y;
                        let toprint = set.lines[i].toString().replace("{month}",monthnames[month]).replace("{year}",year)
                            .replace("{subgroupname}",subgroupdata.name).replace("{subgroupkey_ref}",subgroupdata.key_ref)
                            .replace("{groupname}",groupdata.name).replace("{groupkey_ref}",groupdata.key_ref)
                            .replace("{unitname}",unitdata.name).replace("{dntm}", DNTM.toString())
                            .replace("{unfinishedReport}", unfinishedReport).replace("{reporttype}", isfullmonth?"LICHIDARE":"AVANS");
                        for(let i=0;i<5;i++) toprint=toprint.replace("{signee"+(i+1)+"}",signees[i]);
                        ws.cell(x, y, lx, ly,(set.lx||set.ly)?true:false).string(toprint).style(set.style?set.style:{});
                        if(set.height) ws.row(x).setHeight(set.height);
                        if(set.width)  ws.column(y).setWidth(set.width);
                    }
            });
        dataarray.forEach(elem =>
            {   let totals={unkn:"!",index:userindex,name:elem.lastName+" "+elem.firstName,matricol:elem.matricol,days:0,hours:0,hoursavans:0,co:0,cm:0,wend:0,dons:0,ccm:0,ssm:0,su:0,sind:0,s8:0,md:0,vcc:0,recens:0,vm:0,l8:0,cp:0,cpr:0,zlp:0,zln:0,dsi:0,dse:0,bo:0,bp:0,am:0,m:0,ccc:0,cfp:0,night:0,paidh:0,unpaidh:0,totalnotworked:0,totalpayed:0,coh:0,st:0}
                for (let i = 1; i < daycount + 1; i++)
                    {   let day = processday(elem["d" + i],elem["a" + i], vacationdict,activitydict,template.showSeparateActivities)
                        if(isfullmonth||i<16)
                            {   getmonthtotals(day,firstdaytype,i,totals);
                                totals[i] = day.print;
                            }
                        else totals[i] = "";
                    }
                getmonthtotalsfinals(totals);
                emploeetemplate.forEach(set =>
                    {   let skip28293031 = 0;
                        // for (let i = 1; i <= daycount; i++ ) {
                        //     if (!/\d/.test(totals[i])) {  //Daca e Weekend/Concediu skip (nu contine cifre)
                        //         continue;
                        //     }
                        //     if (!set.showSeparateActivities) {
                        //         const printTempArray = totals[i].replace(/[a-z]/gi, '').split("+");
                        //         let printTemp = 0;
                        //         printTempArray.forEach(number => printTemp += parseFloat(number));
                        //         totals[i] = printTemp.toString();
                        //     }
                        // }
                        for(let i=0;i<set.lines.length;i++)
                            {   let x = set.x+(set.horizontal?0:i)+(set.belowtable?dataarray.length:0)+userindex-1;
                                let y = set.y+(set.horizontal?i:0)-skip28293031;
                                let lx = (set.lx?x+set.lx-1:x);
                                let ly = (set.ly?y+set.ly-1:y);
                                if(set.lines[i]>daycount) {skip28293031++;continue}
                                let cell = ws.cell(x, y, lx, ly,(set.lx||set.ly)?true:false).string(""+totals[set.lines[i]]).style(set.style?set.style:{});
                                if(set.height) ws.row(x).setHeight(set.height);
                                if(set.width) ws.column(y).setWidth(set.width);
                                if(set.styleweekend) if(totals[set.lines[i]]=="L") cell.style(set.styleweekend)
                            }
                    });
                userindex++;
            });
        

        let toreturn=[];
        await wb.writeToBuffer().then(function(buffer) {   
            toreturn = buffer;
        });
        return toreturn;
    }
function convertExcelToPdf(buffer) {
    if(!fs.existsSync(process.cwd()+"/temp_reports/"))
        fs.mkdirSync(process.cwd()+"/temp_reports/", { recursive: true});//no callback

    let fileName="Report_"+new Date().getTime()
    setTimeout(() => {
        if(fs.existsSync(process.cwd()+"/temp_reports/"+fileName+".xlsx"))
            fs.unlinkSync(process.cwd()+"/temp_reports/"+fileName+".xlsx");
        if(fs.existsSync(process.cwd()+"/temp_reports/"+fileName+".pdf"))
            fs.unlinkSync(process.cwd()+"/temp_reports/"+fileName+".pdf");
    }, 8000);

    fs.writeFileSync(process.cwd()+"/temp_reports/"+fileName+".xlsx", buffer);
    execSync(`cscript.exe //nologo excel_to_pdf.js temp_reports/${fileName}.xlsx`);//execSync has no callback
    return fs.readFileSync(process.cwd()+`/temp_reports/${fileName}.pdf`);
}

function getfile(filename) {
    const FOLDER_NAME = "/templates/";
    if(fs.existsSync(process.cwd() + FOLDER_NAME + filename))   // langa exe (custom)
        return fs.readFileSync(process.cwd() + FOLDER_NAME + filename, 'utf8').toString()
    if(fs.existsSync(process.cwd() + `${FOLDER_NAME}default_` + filename)) // langa exe (implicit)
        return fs.readFileSync(process.cwd() + `${FOLDER_NAME}default_` + filename, 'utf8').toString()
    let folder = (__dirname.includes('\\snapshot\\') ? 'dist': 'public') + FOLDER_NAME;
    if(fs.existsSync(__dirname + '/' + folder + filename))    // in exe (implicit)
        return fs.readFileSync(__dirname + '/' + folder + filename, 'utf8').toString()
    throw new Error('Nu s-a gasit template-ul fisierului dorit.('+filename+")");
}
function getCustomFile(filename) {
    const FOLDER_NAME = "/templates/";
    if(fs.existsSync(process.cwd() + FOLDER_NAME + filename))
        return fs.readFileSync(process.cwd() + FOLDER_NAME + filename, 'utf8').toString();
    throw new Error('Nu s-a gasit template-ul fisierului dorit.');
}
function getDefaultFile(filename) {
    const FOLDER_NAME = "/templates/";
    if(fs.existsSync(process.cwd() + `${FOLDER_NAME}default_` + filename))
        return fs.readFileSync(process.cwd() + `${FOLDER_NAME}default_` + filename, 'utf8').toString()
    let folder = (__dirname.includes('\\snapshot\\') ? 'dist': 'public') + FOLDER_NAME;
    if(fs.existsSync(__dirname + '/' + folder + filename))
        return fs.readFileSync(__dirname + '/' + folder + filename, 'utf8').toString()
    throw new Error('Nu s-a gasit template-ul fisierului dorit.');
}

function processXLSX(result,res) {
    if(result.length == 0) {
        res.send({data: result, error: "Nu exista elemente pentru aceste filtre."})
    } else {
        const ws = XLSX.utils.json_to_sheet(result);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'output');
        let buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
        res.send({error:"",data:buffer.toString('base64'), result})
    }
}
function processCSV(result,res) {
    if(result.length == 0) {
        res.send({data: result, error: "Nu exista elemente pentru aceste filtre."})
    } else {
    let csv = ''
    let header = Object.keys(result[0]).join(',');
        result.forEach((elem) => {
                                let keys = Object.keys(result[0])
                                keys.forEach((key) => {
                                    if(typeof elem[key] == 'string') {elem[key] = elem[key].replace(new RegExp(",", "g"), '.')}
                                })
                            })
        let values = result.map(o => Object.values(o).join(',')).join('\n');
        csv += header + '\n' + values;
        res.send({error:"",data:csv, result})
    }
}

//==========================DAY PROCESSING
function getmonthtotals(day,firstdaytype,j,totals)
    {   totals.hours += day.total;
        totals.night += day.night;
        totals.paidh += day.paidh;
        totals.unpaidh += day.unpaidh;//TODO!!!!!  FINISH WHEN CNAB GIVES ANSWERS!!!!!!!
        //totals.totalnotworked+=.unpaidh

        if(j<16) totals.hoursavans+=day.total;
        for(let i=0; i<day.activ.length; i++)
            if(day.activ[i].type=='SSM' )       totals.ssm+=day.activ[i].time;
            else if(day.activ[i].type=='SU')    totals.su+=day.activ[i].time;
            else if(day.activ[i].type=='SIND')  totals.sind+=day.activ[i].time;
            else if(day.activ[i].type=='S8')    totals.s8+=day.activ[i].time;
            else if(day.activ[i].type=='MD')    totals.md+=day.activ[i].time;
            else if(day.activ[i].type=='DSI')   totals.dsi+=day.activ[i].time;
            else if(day.activ[i].type=='DSE')   totals.dse+=day.activ[i].time;
        if(day.total>0||day.activ.length>0)     totals.days++;
        if(day.print==='CO')    {totals.co++; totals.coh+=day.cohours;}
        else if(day.print==='CM')   totals.cm++;
        else if(day.print==='DONS') totals.dons +=day.cohours;
        else if(day.print==='CCM')  totals.ccm += day.cohours;
        else if(day.print==='VCC')  {totals.vcc+=day.cohours; totals.days++;}
        else if(day.print==='VM')   {totals.vm+=day.cohour; totals.days++;}
        else if(day.print==='RECENS'){totals.recens+=day.cohours; totals.days++;}
        else if(day.print==='L/8')  totals.l8 += day.cohours;
        else if(day.print==='CP')   totals.cp += day.cohours;
        else if(day.print==='CPR')  totals.cp += day.cohours;//cp and cpr merged columns
        else if(day.print==='ZLP')  totals.zlp += day.cohours;
        else if(day.print==='ZLN')  totals.zln += day.cohours;
        else if(day.print=='ST')    totals.st+=day.cohours;
        else if(day.print==='BO')   totals.bo += day.cohours;
        else if(day.print==='BP')   totals.bp += day.cohours;
        else if(day.print==='AM')   totals.bp += day.cohours;//am and bp merged column
        else if(day.print==='M')    totals.m += day.cohours;
        else if(day.print==='CCC')  totals.ccc += day.cohours;
        else if(day.print==='CFP')  totals.cfp += day.cohours;

        else if(((firstdaytype+6+j)%7)>4) totals.wend += day.total;

    }
function getmonthtotalsfinals(totals)
    {   totals.totalnotworked+=totals.coh+totals.unpaidh+totals.cp+totals.cpr+totals.zlp+totals.zln+totals.dsi+totals.dse+totals.bo+totals.bp+totals.am+totals.m+totals.ccc+totals.cfp+totals.st;
        totals.totalpayed+=+totals.md+totals.l8+totals.paidh+totals.hours;
    }
function processday(val,valactiv,vacationdict,activitydict,showactivities)
    {   if(typeof val!=='string') logerr("Valoare invalida, trebuie string, e "+typeof val+" "+val);
        if(val.startsWith("-"))//VACATION
            {   val =-parseInt(val);

                let cotype = val, time = 8;//compatibility with old system
                if(val>=1000)
                    {   cotype = Math.trunc(val/1000);
                        time = (val%1000)/2;
                    }
                let vname="C?";
                let hours=0;
                if(vacationdict.hasOwnProperty(cotype))
                    {   let type=vacationdict[cotype];
                        vname=type.code.split('(')[0];
                        hours=type.hours+(type.hours>0?(type.hourshashalf/2):(-1*type.hourshashalf/2));
                    }

                //const vname = vacationdict.hasOwnProperty(cotype)?vacationdict[cotype]:"C?";
                return {print:vname,start:"&nbsp;",end:"&nbsp;",total:hours,break:0,activ:[],wend:false,cohours:hours,night:0,paidh:0,unpaidh:0};
            }
        if(val=="0")return {print:"0",start:"&nbsp;",end:"&nbsp;",total:0,break:0,activ:[],wend:false,cohours:0,night:0,paidh:0,unpaidh:0};//WORKED 0 HOURS IN THAT DAY
        if(val=="2")return {print:"L",start:"&nbsp;",end:"&nbsp;",total:0,break:0,activ:[],wend:true,cohours:0,night:0,paidh:0,unpaidh:0};//WEEKEND
        if(val=="3")return {print:"L",start:"&nbsp;",end:"&nbsp;",total:0,break:0,activ:[],wend:false,cohours:0,night:0,paidh:0,unpaidh:0};//HOLIDAY
        if(val.length>1)
            {   //FORMAT  [2:START][2:END][4:PAUZA][2:TOTAL][2:SSM][2:SU][2:SIND][2:RAWTOTAL] la 2 cifre imparte la 2 pt ora iar restul e 1 daca e cu :30 minute,:0 daca restul e 0
                // let start=Math.floor((val%1000000000000000000)/10000000000000000);
                // let end=Math.floor((val%10000000000000000)/100000000000000);
                // let total=Math.floor((val%10000000000)/100000000);

                // let ssm= Math.floor((val%10000)/100)/2;
                // let su=  Math.floor((val%1000000)/10000)/2;
                // let sind=Math.floor((val%100000000)/1000000)/2;

                let val1 = parseInt(val.slice(-8));   if(typeof val1!="number") val1 = 0;
                let val2 = parseInt(val.slice(0,-8)); if(typeof val2!="number") val2 = 0;


                let start = Math.floor((val2%10000000000)/100000000);
                let end = Math.floor((val2%100000000)/1000000);
                let total = Math.floor((val2%100));
                let break1 = Math.floor((val2%1000000)/100);


                let rawtotal = (val1%100)/2;
                let night = Math.floor((val1%10000)/100)/2;
                const extraunpaidhours = Math.floor((val1%1000000)/10000);
                const extrapaidhours = Math.floor((val1%100000000)/1000000);


                let addtoprinttotal = "";
                let activities = [];
                let activtotalhours = 0;
                valactiv = parseInt(valactiv);
                for(let i=0; i<100&&valactiv>90; i++)
                    {   let time = (valactiv%100)/2;  valactiv = Math.floor(valactiv/100);
                        let type = valactiv%100;      valactiv = Math.floor(valactiv/100);
                        let typeprint="?";
                        let ispositive=true;
                        if(activitydict.hasOwnProperty(type))
                            {   typeprint = activitydict[type].code;
                                ispositive=activitydict[type].isremove==0;
                            }
                        activities.push({type:typeprint,time:time})
                        addtoprinttotal +=(ispositive?"+":"-")+time+""+typeprint;
                        activtotalhours += ispositive?time:(-1*time);
                    }
                let _total=Math.max(total/2,0);
                return {print:showactivities?(Math.max(total/2-activtotalhours,0)+addtoprinttotal):_total,
                        total:_total,
                        start:("0" + Math.floor(start/2)+(start%2==1?":30":":00")).slice(-5),
                        end:("0" + Math.floor(end/2)+(end%2==1?":30":":00")).slice(-5),
                        break: break1,
                        activ:activities,
                        wend:false,
                        cohours:0,
                        night:night,  paidh:extrapaidhours, unpaidh:extraunpaidhours};
            }

        return {print:"",start:"&nbsp;",end:"&nbsp;",total:0,break:0,activ:[],cohours:0,wend:false,night:0,paidh:0,unpaidh:0};//ssm:0,su:0,sind:0,for 29,30,31 days should be empty, not unknown
    }
function getcurrenttime()
    {   const now = new Date();
        let printdate = (new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString());
        printdate = printdate.split(".")[0].replace("T"," ")
        return printdate;
    }
function formattime(stamp)
    {   const d = new Date(stamp);
        return d.getFullYear()+"-"+(("0"+(d.getMonth()+1)).slice(-2))+"-"+(("0"+d.getDate()).slice(-2))+" "+
                (("0"+d.getHours()).slice(-2))+":"+(("0"+d.getMinutes()).slice(-2))+":"+(("0"+d.getSeconds()).slice(-2));
    }
function formathour(minutes)
    {   return (Math.trunc(minutes/60))+(minutes%60!=0?":"+("0"+(Math.abs(minutes)%60)).slice(-2):"");
    }

async function calculateDNTM(year, month, dbPool) {
    const HOURS_IN_MILLISECONDS = 60 * 60 * 1000;
    const LAST_DAY = new Date(year, month + 1, 0).getDate();

    const START_STAMP = new Date(year,month,1).getTime();
    const END_STAMP = new Date(year,month, LAST_DAY + 1).getTime();
    const sql = `SELECT * from Holidays WHERE stamp>${START_STAMP} AND stamp<${END_STAMP};`;

    let result;
    try {
        result = await dbPool.query(sql);
    } catch(err) {   
        logerr(err);
        logerr(sql);
        throw err;
    }
    const holidays = result.recordsets[0];

    const weekendHolidays = [];
    {   
        let day = new Date(year,month,1).getDay();
            for(let i = 0; i < LAST_DAY; i++) {	
                if(((day + 6) % 7 > 4)) {
                    weekendHolidays.push("w");
                } else {
                    weekendHolidays.push("n");
                }
                day++;
            }
    }
    holidays.forEach(elem => weekendHolidays[new Date(parseInt(elem.stamp) + 5 * HOURS_IN_MILLISECONDS).getDate() - 1] = "h");
    
    return (weekendHolidays.filter(day => day === "n").length) * 8;
}

//==========================IMPORTING
async function processimportuserscsv(csvcontent, settings, usermapping, subGroupMapping, shiftsMapping, dbPool)
    {   if (typeof csvcontent != 'string' || csvcontent === '')
            return {error: "Nu exista fisier pentru importarea angajatilor",addedusers:0, updatedusers:0};

        let lines = csvcontent.replace("\n\r","\n").split("\n");
        let headers = lines[0].replace("ï»¿","").trim().toLowerCase().split(";");
        let expectedcolumns = {"unitate":-1,"grupa":-1,"subgrupa":-1,"nume":-1,"prenume":-1,"marca":-1,"serie card":-1, "nume tura": -1};

        //CHECKING HEADERS
        for(let i=0;i<headers.length;i++)
            {   if(expectedcolumns.hasOwnProperty(headers[i]))
                    expectedcolumns[headers[i]] = i;
                //else return {error: "Coloana invalida: "+headers[i],addedusers:0, updatedusers:0};
            }
        let columnarray = Object.keys(expectedcolumns);
        for(let i=0; i<columnarray.length; i++)
            {   if(expectedcolumns[columnarray[i]]==-1)
                    return {error: "Nu exista coloana: "+columnarray[i],addedusers:0, updatedusers:0};
            }

        let toadd = [];
        let toupdate = [];

        let existingShifts = Object.values(shiftsMapping);
        let nameShiftsMapping = {};
        existingShifts.forEach((existingShift) => {
            nameShiftsMapping[existingShift.name] = existingShift;
        });

        for (let i = 1; i < lines.length; i++)if(lines[i].trim().length>0)
            {   let sublines = lines[i].split(";");
                if(sublines.length!=headers.length)
                    return {error: "Linie invalida:'"+lines[i]+"' trebuie sa fie "+headers.length+" elemente",addedusers:0, updatedusers:0};

                //CREATINV USER
                let user = {matricol: sublines[expectedcolumns["marca"]].trim(),
                            firstName: sublines[expectedcolumns["prenume"]].trim(),
                            lastName: sublines[expectedcolumns["nume"]].trim(),
                            cardId: sublines[expectedcolumns["serie card"]].trim(),
                            subGroupKeyRef: (sublines[expectedcolumns["subgrupa"]].trim())+"-"+
                                            (sublines[expectedcolumns["grupa"]].trim())+"-"+
                                            (sublines[expectedcolumns["unitate"]].trim()),
                            shiftName: sublines[expectedcolumns["nume tura"]].trim()
                };
                user.name = user.lastName+" "+user.firstName;

                //CHECK
                if(user.matricol=="")   return {error: "Coloana matricol este invalida pentru linia "+i+" "+user.name,addedusers:0, updatedusers:0};
                if(user.firstName=="")  return {error: "Coloana prenume este invalida pentru linia "+i+" "+user.name,addedusers:0, updatedusers:0};
                if(user.lastName=="")   return {error: "Coloana nume este invalida pentru linia "+i+" "+user.name,addedusers:0, updatedusers:0};
                if(user.cardId=="")     return {error: "Coloana serie card este invalida pentru linia "+i+" "+user.name,addedusers:0, updatedusers:0};
                if(!subGroupMapping.keyRef.hasOwnProperty(user.subGroupKeyRef))
                    return {error: "Nume grupa/unitate/subgrupa invalide:"+user.subGroupKeyRef+" "+user.name,addedusers:0, updatedusers:0};
                if(usermapping.cardid.hasOwnProperty(user.cardId) && usermapping.cardid[user.cardId].matricol != user.matricol )
                    return {error: "Cardul "+user.cardId+"("+user.name+") deja a fost alocat pentru:"+usermapping.cardid[user.cardId].name,addedusers:0, updatedusers:0};

                user.shiftID = -1;
                if(user.shiftName !== "") {
                    if(nameShiftsMapping.hasOwnProperty(user.shiftName)) {
                        user.shiftID = nameShiftsMapping[user.shiftName].id;
                    }
                    else {
                        return {error: "Coloana nume tura este invalida pentru linia "+i+" "+user.name,addedusers:0, updatedusers:0};
                    }
                }


                //ADDING USER
                user.subGroupId = subGroupMapping.keyRef[user.subGroupKeyRef].id
                if(usermapping.matricol.hasOwnProperty(user.matricol))//update
                    {   const user1 = usermapping.matricol[user.matricol];
                        if(user1.name!=user.name||user1.last_name!=user.lastName||user1.first_name!=user.firstName||
                            user1.sub_group_id!=user.subGroupId||user1.cardid1!=user.cardId || user1.shift != user.shiftID)
                                toupdate.push(user);
                    }
                else toadd.push(user);//add
        }
        if(toadd.length==0&&toupdate.length==0)
            return {error: "Nu exista informatii noi in fisier.",addedusers:0, updatedusers:0};

            if(toadd.length>0)
                {   try {   let pieces1 = []
                            let pieces2 = []
                            let count = 0;
                            for(let i=0; i<toadd.length; i++)
                                {   pieces1.push("("+toadd[i].matricol+",'"+toadd[i].name+"','"+toadd[i].lastName+"','"+toadd[i].firstName+"','"+toadd[i].cardId+"','"+toadd[i].subGroupId+ "'," +toadd[i].shiftID+ ")")//name,matricol,cardid, location, job
                                    count++;
                                    if(count>=settings.rowsperinsert)
                                        {   pieces2.push("INSERT INTO Users(matricol,name,last_name,first_name,cardid1,sub_group_id, shift) VALUES"+pieces1.join(',')+';');
                                            count = 0;
                                            pieces1 = [];
                                        }
                                }
                            if(pieces1.length>0)
                                pieces2.push("INSERT INTO Users(matricol,name,last_name,first_name,cardid1,sub_group_id, shift) VALUES"+pieces1.join(',')+';');

                            await dbPool.query(pieces2.join('\n')+
                                "UPDATE Settings SET data="+(new Date().getTime())+" WHERE name='syncusersstamp';");
                        }
                    catch(err)
                        {   logerr(err)
                            return {error:"Eroare SQL(INSERT): "+err.message,addedusers:0,updatedusers:0}
                        }
                }
            if(toupdate.length>0)
                {   try {   let pieces1 = []
                            let count = 0;
                            for(let i=0; i<toupdate.length; i++)
                                {   pieces1.push("UPDATE Users set name='"+toupdate[i].name+"', last_name='"+toupdate[i].lastName+"', first_name='"+toupdate[i].firstName+"', cardid1='"+toupdate[i].cardId+"', sub_group_id='"+toupdate[i].subGroupId+"', shift=" + toupdate[i].shiftID + ", require_update = 1 WHERE matricol="+toupdate[i].matricol+";");
                                    count++;
                                    if(count>=settings.rowsperinsert)
                                        {   await dbPool.query(pieces1.join('\n'));
                                            log('[WEB]Updated '+count+' users.');
                                            count=0;
                                            pieces1=[];
                                        }
                                }
                            if(pieces1.length>0)
                                {   await dbPool.query(pieces1.join('\n'));
                                }
                            await dbPool.query("UPDATE Settings SET data="+(new Date().getTime())+" WHERE name='syncusersstamp';");
                        }
                    catch(err)
                        {   logerr(err)
                            return {error:"Eroare SQL(UPDATE): "+err.message,addedusers:0,updatedusers:0}
                        }
                }
            return {error:"",addedusers:toadd.length,updatedusers:toupdate.length}

    }
async function processImportSubgroupsCSV(csvcontent, subgroupsMapping, groupsMapping, unitsMapping, usersMapping, dbPool) {
        if (typeof csvcontent != 'string' || csvcontent === '') {
            return {error: "Nu exista fisier pentru importarea subgrupelor, grupelor, departamentelor", subgroups:0, groups:0, departments: 0, sgRepresentatives: 0};
        }

        let lines = csvcontent.replace("\n\r","\n").split("\n");
        let headers = lines[0].replace("ï»¿","").trim().toLowerCase().split(";");

        let expectedcolumns = {"nume_subgrupa": -1, "cod_subgrupa": -1, "nume_grupa":-1, "cod_grupa": -1, "nume_departament": -1, "reprezentanti_subgrupa": -1};

        //CHECKING HEADERS
        for(let i=0;i<headers.length;i++) {
            if(expectedcolumns.hasOwnProperty(headers[i])) {
                expectedcolumns[headers[i]] = i;
            }
            // else {
            //     return {error: "Coloana invalida: " + headers[i], subgroups:0, groups:0, departments: 0, sgRepresentatives: 0};
            // }
        }

        let columnarray = Object.keys(expectedcolumns);
        for(let i = 0; i < columnarray.length; i++) {
            if(expectedcolumns[columnarray[i]] == -1) {
                return {error: "Nu exista coloana: " + columnarray[i], subgroups:0, groups:0, departments: 0, sgRepresentatives: 0};
            }
        }

        let toAddUnits = [];
        let toAddGroups = [];
        let toAddSubgroups = [];
        let toAddSGRepresentatives = [];

        let existingDepts = Object.values(unitsMapping);
        let nameUnitsMapping = {};
        existingDepts.forEach((existingDept) => {
            nameUnitsMapping[existingDept.name] = existingDept;
        });

        let existingGroups = Object.values(groupsMapping);
        let keyRefGroupsMapping = {};
        existingGroups.forEach((existingGroup) => {
            keyRefGroupsMapping[existingGroup.key_ref] = existingGroup;
        });

        let keyRefSubgroupsMapping = subgroupsMapping.keyRef;

        let matricolUsersMapping = usersMapping.matricol;

        for (let i = 1; i < lines.length; i++)if(lines[i].trim().length>0)
        {
            let values = lines[i].split(";");

            if(values.length != headers.length) {
                return {error: "Linie invalida:'" + lines[i] + "' trebuie sa fie " + headers.length + " elemente", subgroups:0, groups:0, departments:0, sgRepresentatives: 0};
            }

            //CREATING DEPARTMENT
            let dept = {
                name: values[expectedcolumns["nume_departament"]].trim()
            };

            if(dept.name === "") {
                return {error: "Coloana nume_departament este invalida pentru linia "+ i, subgroups: 0, groups: 0, departments: 0, sgRepresentatives: 0};
            }

            if (!nameUnitsMapping.hasOwnProperty(dept.name)) {
                let sql = "INSERT INTO Units (name) VALUES ('" + dept.name + "');";
                toAddUnits.push(sql);
                nameUnitsMapping[dept.name] = dept;
            }

            //CREATING GROUP
            let group = {
                name: values[expectedcolumns["nume_grupa"]].trim(),
                deptID: -1,
                code: values[expectedcolumns["cod_grupa"]].trim(),
                keyRef: ""
            };
            group.keyRef = group.code + "-" + dept.name;

            if(group.name === "") {
                return {error: "Coloana nume_grupa este invalida pentru linia "+ i, subgroups: 0, groups: 0, departments: 0, sgRepresentatives: 0};
            }
            if(group.code === "") {
                return {error: "Coloana cod_grupa este invalida pentru linia "+ i, subgroups: 0, groups: 0, departments: 0, sgRepresentatives: 0};
            }

            if (!keyRefGroupsMapping.hasOwnProperty(group.keyRef)) {
                let sql = "INSERT INTO Groups (name, unit_id, code, key_ref) VALUES ('" + group.name +
                         "', (SELECT u.id FROM Units u WHERE u.name = '" + dept.name + "'), '" + group.code + "', '" + group.keyRef + "');";
                toAddGroups.push(sql);
                keyRefGroupsMapping[group.keyRef] = group;
            }

            //CREATING SUBGROUP
            let subgroup = {
                name: values[expectedcolumns["nume_subgrupa"]].trim(),
                groupID: -1,
                code: values[expectedcolumns["cod_subgrupa"]].trim(),
                keyRef: ""
            };
            subgroup.keyRef = subgroup.code + "-" + group.keyRef;

            if(subgroup.name === "") {
                return {error: "Coloana nume_subgrupa este invalida pentru linia "+ i, subgroups: 0, groups: 0, departments: 0, sgRepresentatives: 0};
            }
            if(subgroup.code === "") {
                return {error: "Coloana cod_subgrupa este invalida pentru linia "+ i, subgroups: 0, groups: 0, departments: 0, sgRepresentatives: 0};
            }

            if (!keyRefSubgroupsMapping.hasOwnProperty(subgroup.keyRef)) {
                let sql = "INSERT INTO SubGroups (name, group_id, code, key_ref) VALUES ('" + subgroup.name +
                         "', (SELECT g.id FROM Groups g WHERE g.key_ref = '" + group.keyRef + "'), '" + subgroup.code + "', '" + subgroup.keyRef + "');";
                toAddSubgroups.push(sql);
                keyRefSubgroupsMapping[subgroup.keyRef] = subgroup;
            }
            else {
                return {error: "Subgrupa " + subgroup.name + " de la linia " + i + " exista deja in baza de date.", subgroups: 0, groups: 0, departments: 0, sgRepresentatives: 0};
            }

            //CREATING SUBGROUP REPRESENTATIVES
            let usersMatricol = [...new Set(values[expectedcolumns["reprezentanti_subgrupa"]].split(",").map(Number))]; // removes the duplicated user values
            for(let matricol of usersMatricol) {
                if(matricolUsersMapping.hasOwnProperty(matricol)) {
                    let sql = "INSERT INTO SubGroupRepresentatives (sub_group_id, user_id) VALUES " +
                            "((SELECT sg.id FROM SubGroups sg WHERE sg.key_ref = '" + subgroup.keyRef + "'), " + matricolUsersMapping[matricol].id + ");";
                    toAddSGRepresentatives.push(sql);
                }
            }
        }

        //INSERT QUERY
        let queryUnits = "";
        let queryGroups = "";
        let querySubgroups = "";
        let querySGRepresentatives = "";

        if (toAddUnits.length > 0) {
            queryUnits = toAddUnits.join("");
        }
        if (toAddGroups.length > 0) {
            queryGroups = toAddGroups.join("");
        }
        if (toAddSubgroups.length > 0) {
            querySubgroups = toAddSubgroups.join("");
        }
        if (toAddSGRepresentatives.length > 0) {
            querySGRepresentatives = toAddSGRepresentatives.join("");
        }

        let query = queryUnits + queryGroups + querySubgroups + querySGRepresentatives;
        if(query !== "") {
            try{
                await dbPool.query(query);
            }
            catch(error) {
                logerr(error);
                return {error:"Eroare SQL(INSERT): " + error.message, subgroups:0, groups: 0, departments: 0, sgRepresentatives: 0};
            }
        }

        return {error:"", subgroups: toAddSubgroups.length, groups: toAddGroups.length, departments: toAddUnits.length, sgRepresentatives: toAddSGRepresentatives.length};

    }


//==========================FILTERING
function filterData(result, field, name) {
        let tableValues = ['stamp', 'datestart', 'dateend', 'generatedat', 'data', 'refdate']
            let fieldArray = field.split(',')
            const nameArray = name.split(',')
            let replaceKeys = (obj) => {
                for(let i = 0; i < nameArray.length; i++ ){
                    if(fieldArray[i] == 'hashalfhour') { fieldArray.splice(i, 1) }
                    obj[nameArray[i]] = obj[fieldArray[i]];
                    delete obj[fieldArray[i]];
                };
             };
            result.forEach((elem) => {
                const keys = Object.keys(elem)
                keys.forEach((key) => {
                    if(key == 'hashalfhour') {
                        if(typeof elem.hours == 'string' && elem.hours.includes(':')) { delete elem[key]; return }
                        elem[key]==1? elem.hours += ':30':elem.hours += ':00'
                        delete elem[key]
                    }
                    if(tableValues.some(el => key.includes(el))) {
                            if(elem[key] > 1500000000000){
                                elem[key] = formattime(parseInt(elem[key]))
                            }
                        }
                    if(key.includes('date')) {
                        if(elem[key] < 1500000000000){
                            let arrOfDigits = Array.from(String(elem[key]), Number)
                            arrOfDigits.splice(4, 0, '-')
                            arrOfDigits = arrOfDigits.join('')
                            elem[key] = arrOfDigits
                        }
                    }
                    if(key == 'hash') {
                        elem[key] = ''
                    }
                    if(!fieldArray.includes(key)) {
                        delete elem[key]
                    }
                })
                replaceKeys(elem);
            })
    }

//==========================BENCHMARKING
function benchmarksql()
    {   //BENCHMARK SQL CONNECTION: result max 20.000 queries
        setTimeout(() => {(async ()=>{
                        try {   let sql = "SELECT TOP 1 * FROM Scans WHERE userid=18 ORDER BY id DESC;"
                                let sqls = [];
                                for(let i=0;i<20000;i++) sqls.push(sql);
                                log("Benchmark:start");
                                await newDBPool.query(sqls.join(""));
                                log("Benchmark:End");
                            }
                        catch (error) { logerr(error);  }
                })()    }, 2000);
    }



exports.log = log;
exports.logwarn = logwarn;
exports.logerr = logerr;
exports.isparamvalidint = isparamvalidint;
exports.isparamvalidstring = isparamvalidstring;
exports.isparamvalidstringnolen = isparamvalidstringnolen;
exports.buildwhere = buildwhere;
exports.getAuth = getAuth;
exports.buildtoken = buildtoken;
exports.setAudit = setAudit;
exports.gethash = gethash;
exports.createDBPool = createDBPool;
exports.processShifts = processShifts;
exports.processCondicaScans = processCondicaScans;
exports.getEditReportPermission = getEditReportPermission;
exports.generatereport = generatereport;
exports.generatePDFreportFromHTML = generatePDFreportFromHTML;
exports.generatehtmlreport = generatehtmlreport;
exports.filtermatricols = filtermatricols;
exports.generatecsvreport = generatecsvreport;
exports.generateClockingFile = generateClockingFile;
exports.generateGraficLucru = generateGraficLucru;
exports.generateRaportDeszapezire = generateRaportDeszapezire;
exports.calculateDNTM = calculateDNTM;
exports.monthnames = monthnames;
exports.processimportuserscsv = processimportuserscsv;
exports.processImportSubgroupsCSV = processImportSubgroupsCSV;
exports.procesclockingdata = procesclockingdata;
exports.generatexlsxreport = generatexlsxreport;
exports.generateReportCoYear=generateReportCoYear;
exports.convertExcelToPdf = convertExcelToPdf;
exports.processXLSX = processXLSX;
exports.processCSV = processCSV;
exports.filterData = filterData;
exports.getCustomFile = getCustomFile;
exports.getDefaultFile = getDefaultFile;
exports.formattime = formattime;
exports.formathour = formathour;
exports.processhiftdata=processhiftdata;
exports.updateshifts=updateshifts;
exports.generate_xlsx_overtime=generate_xlsx_overtime;
