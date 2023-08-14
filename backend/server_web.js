const cors = require("cors");
const path = require("path");
const https = require("https")
const http = require("http")
const express = require("express");
const fs = require("fs");
const archiver=require('archiver');
const bodyparser = require('body-parser');//getEditReportPermission
const {createDBPool, convertExcelToPdf, deleteTemporaryReports, generatecsvreport,generateClockingFile,generateGraficLucru, generateRaportDeszapezire, generatehtmlreport,filtermatricols,generatePDFreportFromHTML,
       generatexlsxreport,generate_xlsx_overtime,generatereport,processShifts,processCondicaScans, calculateDNTM, monthnames,gethash,setAudit,buildtoken,getAuth,log,logerr,formathour,
       isparamvalidstring,isparamvalidstringnolen,isparamvalidint,buildwhere, logwarn, processimportuserscsv, processImportSubgroupsCSV,
       processhiftdata,procesclockingdata,processXLSX, processCSV, getCustomFile, getDefaultFile,filterData,formattime,generateReportCoYear,updateshifts}=require('./server_utils');
const server_api_crud = require('./server_web_crud');
const apiPermissions = require('./server_api_permissions_mapping');

const ASSAABLOY=1,UROVO=2,ANDROIDIOS=3,WEB=4,PONTARESEF=5,ADAUGAREMANUALA=6
const scantypes = ["","Cititor card","Terminal mobil","Android/IOS","Web","Sef Echipa","Adaugare Manuala"];
function getscantypename(type) {return type>-1&&type<scantypes.length?scantypes[type]:"??";}
function getinoroutname(type) {return type==2?"Iesire":(type==1?"Intrare":"??");}

let config = JSON.parse(fs.readFileSync('config.json'));
if(typeof config.webporthttp!=='number') config.webporthttp = 80;
if(!Array.isArray(config.departHeaderSg) || config.departHeaderSg.length < 3) config.departHeaderSg = ['Subgrupa', 'Grupa', 'Departament'];
if(!Array.isArray(config.departHeaderPl) || config.departHeaderPl.length < 3) config.departHeaderPl = ['Subgrupe', 'Grupe', 'Departamente'];


const newDBPool = createDBPool(config.db);
//=======================================================================
//=======================================================================CACHES
//=======================================================================
//====================SYNC SETTINGS
let settingslastsync = 0;
let settings ={
                tokenlifetimehours:48,
                syncusersstamp:-1,
                rowsperinsert:100,
                monthmiddledate:15,
                runscanssync:0,
                runuserssync:0,
                extendedlogging:0,
                createdevuser:1,
                syncscansinterval:1,
                syncusersinterval:1,
                lastdaytogenreport:0,
                singlescanner:0,
                finalizeascsv:1,
                lockonfinalize:0,
                allowfindaysbefore:1
              }
setInterval(() => {     syncsettings(); }, 7000);
setTimeout(() => {      syncsettings(); }, 500);
async function syncsettings()
    {   try {	const result = await newDBPool.query("SELECT data,name from Settings;");
                settingslastsync = new Date().getTime();

                result.recordset.forEach(elem => {
                    if(typeof elem.data=='string') elem.data = parseInt(elem.data);
                    if(elem.name=="tokenlifetimehours") settings.tokenlifetimehours = elem.data;
                    else if(elem.name=="rowsperinsert") settings.rowsperinsert = elem.data;
                    else if(elem.name=="monthmiddledate") settings.monthmiddledate = elem.data;
                    else if(elem.name=="runuserssync") settings.runuserssync = elem.data;
                    else if(elem.name=="runscanssync") settings.runscanssync = elem.data;
                    else if(elem.name=="syncusersstamp"&&settings.syncusersstamp<elem.data) {syncusers(elem.data);}//
                    else if(elem.name=="extendedlogging") settings.extendedlogging = elem.data;
                    else if(elem.name=="createdevuser") settings.createdevuser = elem.data;
                    else if(elem.name=="syncscansinterval") settings.syncscansinterval = elem.data;
                    else if(elem.name=="syncusersinterval") settings.syncusersinterval = elem.data;
                    else if(elem.name=="lastdaytogenreport") settings.lastdaytogenreport = elem.data;
                    else if(elem.name=="singlescanner") settings.singlescanner = elem.data;
                    else if(elem.name=="finalizeascsv") settings.finalizeascsv = elem.data;
                    else if(elem.name=="lockonfinalize") settings.lockonfinalize = elem.data;
                    else if(elem.name=="allowfindaysbefore") settings.allowfindaysbefore = elem.data;
                });
			}
		catch(err)
			{   logerr(err);
		    }
    }
//====================SYNC USERS
const usermapping=
    {   username:{},
        id:{},
        cardid:{},
        matricol:{},
        name:{},//for adding vacations get id from name
    }
async function syncusers(newstamp)
    {   try {   let result = await newDBPool.query("SELECT * from Users WHERE deactivated=0;")
                usermapping.username = {}
                usermapping.name = {}
                usermapping.id = {}
                usermapping.cardid = {}
                usermapping.matricol = {}

                result.recordset.forEach(user =>
                    {   if(typeof user.username ==='string'&&user.username.length>0) usermapping.username[user.username.toLowerCase()] = user;
                        usermapping.id[user.id] = user;
                        if(user.cardid1&&user.cardid1.length>0) usermapping.cardid[user.cardid1] = user;
                        if(user.cardid2&&user.cardid2.length>0) usermapping.cardid[user.cardid2] = user;
                        usermapping.matricol[user.matricol] = user
                        usermapping.name[user.name] = user
                    });
                settings.syncusersstamp = newstamp;
                log("[WEB]Synced users");
            }
        catch(error){ logerr(error);}
    }
//====================SYNC PERMISSION CACHE
let permissionMapping = {};
setInterval(() => { syncPermissions()   }, 10000);
setTimeout(() => {  syncPermissions()   }, 200);
async function syncPermissions()
    {   try {   let result =  await newDBPool.query("SELECT * from Permissions WHERE deactivated=0;")
                permissionMapping = {}
                result.recordset.forEach(permission => {permissionMapping[permission.id] = permission;});
            }
        catch (error) { logerr(error);  }
    }
//====================SYNC SUBGROUPS CACHE
const subGroupMapping =
    {   keyRef: {},
        id:{}
    };
setInterval(() => { syncSubGroups()}, 10000);
setTimeout(() => {  syncSubGroups()}, 2000);
async function syncSubGroups()
    {   try {   let {recordset} = await newDBPool.query("SELECT * from SubGroups");
                subGroupMapping.id = {};
                subGroupMapping.keyRef = {}
                recordset.forEach(subGroup =>
                    {   subGroupMapping.id[subGroup.id] = subGroup;
                        if(typeof subGroup.key_ref=='string'&&subGroup.key_ref.length > 5)
                            subGroupMapping.keyRef[subGroup.key_ref] = subGroup;
                    })
            }
        catch (error) { logerr(error);  }
}
//====================SYNC GROUPS CACHE
let groupsMapping = {};
setInterval(() => { syncGroups();    }, 6000);
setTimeout(() => {  syncGroups();    }, 2000);
async function syncGroups()
    {   try {   let {recordset} = await newDBPool.query("SELECT * from Groups");
                groupsMapping={};
                recordset.forEach(group => {    groupsMapping[group.id] = group;    })
            }
        catch (error) { logerr(error);  }
    }

//=================================SYNC UNITS CACHE
setInterval(() => { syncUnits();    }, 6000);
setTimeout(() => {  syncUnits();    }, 2000);
let unitsMapping = {};
async function syncUnits()
    {   try {   let {recordset} = await newDBPool.query("SELECT * from Units");
                unitsMapping = {}
                recordset.forEach(unit =>
                    {   unitsMapping[unit.id] = unit;    })
            }
        catch (error)
            {   logerr(error);
            }
    }

//====================SYNC SHIFTS CACHE
let shiftmapping = {};
setInterval(() => { syncshifts();    }, 6000);
setTimeout(() => {  syncshifts();    }, 2000);
async function syncshifts()
    {   try {   let result = await newDBPool.query("SELECT * from Shifts;")
                shiftmapping = {}
                result.recordset.forEach(elem => {  shiftmapping[elem.id] = elem;});
            }
        catch (error) { logerr(error);  }
    }

//====================SYNC VACATIONS TYPE CACHE
let vacationsTypeMapping = {};
setInterval(() => { syncVacationsTypes();    }, 6000);
setTimeout(() => {  syncVacationsTypes();    }, 2000);
async function syncVacationsTypes()
    {   try {   let result = await newDBPool.query("SELECT * from Vacationtypes;")
                vacationsTypeMapping = {}
                result.recordset.forEach(elem => {  vacationsTypeMapping[elem.id] = elem;   });
            }
        catch (error) { logerr(error);  }
}
//====================TRANSFER SUBGROUP ID
let transfersubgroupid = -1;
setInterval(() => { synctransfersubgroupid();    }, 3600000);
setTimeout(() => {  synctransfersubgroupid();    }, 2000);
async function synctransfersubgroupid()
    {   try {   let result = await newDBPool.query("SELECT * from SubGroups WHERE name='Transferare';")
                if (result.recordset.length < 1) logerr("[WEB]Could not find transfer subgroup");
                else transfersubgroupid = result.recordset[0].id;
            }
        catch (error) { logerr(error); }
}


//=======================================================================
//=======================================================================WEBSERVER
//=======================================================================
const certifcates =
    {   key: fs.readFileSync(process.cwd()+'/'+config.certificates.key),
        cert: fs.readFileSync(process.cwd()+'/'+config.certificates.cert),
        passphrase: config.certificates.passphrase,
        tls: {
            rejectUnauthorized: true
        }
    };

let app = {};
createServer()
function createServer()
    {   app = express()
        app.use(cors())

        //REDIRECT HTTP TO HTTPS
        http.createServer(function (req, res) {
            res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
            res.end();
        }).listen(config.webporthttp);

        //REDIRECTING HTTP TO HTTPS
        app.use(function(request, response, next)
            {   if (!request.secure)return response.redirect("https://" + request.headers.host + request.url);
                else next();
            })

        //SERVER SETUP
        let publicfolder = 'public';
        if(__dirname.includes('\\snapshot\\'))
            {   publicfolder = 'dist';
                log("[WEB]Prod env detected, using dist path.")
            }

        let webserver = https.createServer(certifcates, app).listen(config.webport,(err)=>
            {   if(err)logerr(err.message)
                else log("[WEB]>WEBSERVER UP: "+webserver.address().address+":"+config.webport)
            });
        app.use(bodyparser.json({ limit: '50mb'}));
        app.use(bodyparser.urlencoded({ extended: true }))

        function checkPermissions(req, res, next) {
            let auth = getAuth(usermapping, req);
            req.auth = auth;
            req.auth.accesstoallusers = false;

            if (!apiPermissions.has(req.path)) {   next(); return;  }
            if (!auth.auth) {   next(); return;}

            if (!permissionMapping.hasOwnProperty(auth.userref.permission_id))
                {   res.send({ error: "Rolul utilizatorului nu a fost gasit in cache" });
                    return;
                }

            let allowedApiPermissions = apiPermissions.get(req.path)
            let userPermissions = permissionMapping[auth.userref.permission_id]
            req.auth.accesstoallusers = userPermissions.p_access_all_users===1;
            req.auth.candownloadrawreports = userPermissions.p_editReports===1;

            if (allowedApiPermissions.some(permission => userPermissions[permission] == 1))
                {   next()
                    return;
                }
            res.send({ error: "Nu aveți permisuni pentru a accesa această resursă" });
        }

        app.use(checkPermissions)

        //=================FILES
        app.get('/',(req, res) =>{             res.send(fs.readFileSync(path.join(__dirname, publicfolder+"/"+(req.auth.auth?'index.html':'login.html')),'utf8'));})
        app.get('/login.html',(req, res) =>{   res.send(fs.readFileSync(path.join(__dirname, publicfolder+"/"+(req.auth.auth?'index.html':'login.html')),'utf8'));})
        app.get('/index.html',(req, res) =>{   res.send(fs.readFileSync(path.join(__dirname, publicfolder+"/"+(req.auth.auth?'index.html':'login.html')),'utf8'));})
        app.get('/manual.pdf',(req, res) =>
            {   let filePath = path.join(process.cwd(), "/manual.pdf")
                if (!fs.existsSync(filePath))
                    {   res.send("Fisier lipsa: manual.pdf")
                        return;
                    }
                let data = fs.readFileSync(filePath);
                res.contentType("application/pdf");
                res.send(data);
            })
        app.get('/customer.png', (req, res) =>
            {   let filePath = path.join(process.cwd(), "/logo.png")
                res.contentType("image/png");
                if (fs.existsSync(filePath)) res.send(fs.readFileSync(filePath));
                else res.send(fs.readFileSync(path.join(__dirname,publicfolder,"customer.png")));
            })
        app.post('/import_manual', (req, res) => api_import_manual(req, res))
        app.use(express.static(path.join(__dirname,publicfolder)))

        //=================AUTH
        app.get('/login',           (req,res)=> api_login(req,res,usermapping,settings.tokenlifetimehours));
        app.get('/logout',          (req,res)=> api_logout(req,res));
        app.use( (req,res,next) => { if(!req.auth.auth){ res.send({error:"login: Utilizatorul nu este autentificat"});return;} else next()})

        app.get('/changepass',      (req,res)=> api_changepass(req,res,usermapping));
        app.get('/changeaccount',      (req,res)=> api_changeaccount(req,res,usermapping));

        app.get('/getuserdata',     (req,res)=> api_getuserdata(req,res,usermapping));

        //================FILES
        app.post('/import_file', (req, res) => api_import_file(req, res));
        app.get("/download_report_template", (req, res) => api_download_report_template(req, res));
        app.delete("/delete_file", (req, res) => api_delete_file(req, res));

        //================DASHBOARD
        app.get('/getdashdata2',     (req,res)=> api_getdashdata2(req,res,usermapping,settings,settingslastsync));
        app.get('/getdashdata3',     (req,res)=> api_getdashdata3(req,res,usermapping));
        //================CLOCKING EDIT
        app.get('/get_clocking_data',  (req,res)=>api_getclockingdata(req,res));
        app.get('/edit_clocking',  (req,res)=>api_edit_clocking(req,res));

        //==============ONLINE CLOCKING
        app.get('/clocking_get_details', (req,res)=> api_clock_getDetails(req,res,usermapping));
        app.get('/clocking_start',       (req,res)=> api_clock_start(req,res,usermapping));
        app.get('/clocking_end',         (req,res)=> api_clock_end(req,res,usermapping));

        //================REPORTS
        app.get('/reports_get',           (req,res)=> api_reports_get(req,res,usermapping,settings));
        app.get('/reports_generate',      (req,res)=> api_reports_generate_all(req,res,usermapping,settings));
        app.get('/report_genforsubgroup', (req,res)=> api_reports_generate_subgroup(req,res,usermapping,settings));
        app.get('/report_export_local',       (req,res)=> api_finalize_month(req,res,usermapping,settings));
        app.get('/download_pdf_report',       (req,res)=> api_download_pdf_report(req,res));
        app.get('/status_report_get_details', (req,res)=> api_get_finalize_status(req,res,newDBPool));
        app.get('/download_local_csv_report', (req,res)=> api_get_finalized_report(req,res,newDBPool));
        app.get('/reportsmeta_get',           (req,res)=> api_reportsmeta_get(req,res,usermapping,settings));

        //==============SCANS
        app.get('/scans_get',     (req,res)=> server_api_crud.api_crud_get_join(req,res,newDBPool," AND "," stamp DESC ","s.id",injectscandata,
                                                " s.id id , s.stamp stamp, u2.name username,u2.id userid, u2.matricol matricol, l.name location, s.[type] type_print , s.inorout inorout_print ",
                                                " FROM Scans s LEFT JOIN Users u2 on u2.id = s.userid LEFT JOIN Locations l on l.id = s.location ",
                                                req.auth.accesstoallusers?"":"s.userid IN ((SELECT u.id from Users u WHERE u.sub_group_id IN (SELECT sgr.sub_group_id FROM SubGroupRepresentatives sgr WHERE sgr.user_id = "+req.auth.id+")))",
                                                [{n:"userid",r:"u2.id",t:'nr'},{n:"username",r:"u2.name",t:'str'},{n:"matricol",r:"u2.matricol",t:'nr'},
                                                {n:"locationid",r:"l.id",t:'nr'},{n:"location",r:"l.name",t:'str'},{n:"stamp",r:"s.stamp",t:'date'}]));
        app.get('/scans_get_id',  (req,res)=> server_api_crud.api_crud_get(req,res,newDBPool,'Scans',usermapping,
            {   useequalinsteadoflike:true,whereprefix:"s.",
                customsql:"SELECT s.*, audit.modification as changereason, er.reason as reason FROM Scans AS s LEFT JOIN CLockingchangesaudit as audit ON (s.changeid=audit.id) LEFT JOIN Editreason as er ON er.id=audit.reasonid {{WHERE}} {{ORDERBY}} {{PAGINATION}};"+
                "SELECT COUNT(s.id) as count FROM  Scans s {{WHERE}};"
            },scandatainjection));
        app.get('/unknownscans_get',      (req,res)=> server_api_crud.api_crud_get_join(req,res,newDBPool," AND "," stamp DESC ","s.id",injectscandata,
                                                            " s.id id , s.card_id card_id, s.stamp stamp, l.name location, s.[type] type_print , s.inorout inorout_print , s.matricol matricol, s.username username ",
                                                            " FROM UnknownScans s LEFT JOIN Locations l on l.id = s.location ","",
                                                            [{n:"location",r:"l.name",t:"str"},{n:"locationid",r:"l.id",t:"nr"},{n:"matricol",r:"s.matricol",t:"nr"},{n:"username",r:"s.username",t:"str"},{n:"card_id",r:"s.card_id",t:"str"},{n:"stamp",r:"s.stamp",t:'date'}]));
        app.get('/untransferedCards_get', (req,res)=> api_getUntransferedCards(req,res,usermapping));
        app.get('/transferUnknownScans',  (req,res)=> api_transferUnknownScans(req,res,usermapping));
        app.get('/webscans_get',          (req,res)=> server_api_crud.api_crud_get_join(req,res,newDBPool," AND "," stamp DESC ","s.id",injectscandata,
                                                            " s.id id , s.stamp stamp, s.inorout inorout_print , u.matricol matricol, sip.ip ip, u.name username ",
                                                            " FROM Scans s LEFT JOIN Scanips sip on sip.scanid = s.id LEFT JOIN Users u on u.id = s.userid ",
                                                            "type="+WEB+ (req.auth.accesstoallusers?"":" AND s.userid IN ((SELECT u.id from Users u WHERE u.sub_group_id IN (SELECT sgr.sub_group_id FROM SubGroupRepresentatives sgr WHERE sgr.user_id = "+req.auth.id+")))"),
                                                            [{n:"userid",r:"u.id",t:'nr'},{n:"username",r:"u.name",t:'str'},{n:"matricol",r:"u.matricol",t:'nr'},{n:"stamp",r:"s.stamp",t:'date'}]));

        //================USERS
        app.get('/users_get',            (req,res)=> server_api_crud.api_crud_get_join(req,res,newDBPool,req.query.useor=='1'?" OR ":" AND "," u.matricol ASC ","u.id",injectuserdata,
                                            " u.*,CONCAT(sg.name, '/', sg.key_ref)  depart_name ",
                                            " FROM Users u LEFT JOIN SubGroups sg on u.sub_group_id = sg.id ",
                                            "u.deactivated=0"+(req.auth.accesstoallusers?"":" AND (u.sub_group_id IN (SELECT sgr.sub_group_id FROM SubGroupRepresentatives sgr WHERE sgr.user_id = "+req.auth.id+"))"),
                                            [{n:"cardid1",r:"u.cardid1",t:"str"},{n:"details",r:"u.details",t:"str"},{n:"matricol",r:"u.matricol",t:"nr"},{n:"userid",r:"u.id",t:'nr'},{n:"searchmatricol",r:"u.matricol",t:"str"},{n:"first_name",r:"u.first_name",t:"str"},{n:"id",r:"u.id",t:"nr"},{n:"depart_name",r:"sg.name",t:"str"},
                                            {n:"last_name",r:"u.last_name",t:"str"},{n:"name",r:"u.name",t:"str"},{n:"searchdepartment",r:"sg.name",t:"str"},{n:"username",r:"u.username",t:"str"},{n:"sub_group_id",r:"sg.name",t:"str"},{n:"sub_group_id2",r:"sg.id",t:"nr"}]));
        app.get('/users_get_transfer',   (req,res)=> server_api_crud.api_crud_get_join(req,res,newDBPool,req.query.useor=='1'?" OR ":" AND "," u.matricol ASC ","u.id",injectuserdata,
                                            " u.*,CONCAT(sg.name, '/', sg.key_ref)  depart_name "," FROM Users u LEFT JOIN SubGroups sg on u.sub_group_id = sg.id ",
                                            "u.deactivated=0"+(/*req.auth.accesstoallusers*/true?"":" AND (u.sub_group_id IN (SELECT sgr.sub_group_id FROM SubGroupRepresentatives sgr WHERE sgr.user_id = "+req.auth.id+"))")+
                                            " AND (u.sub_group_id="+transfersubgroupid+")",
                                            [{n:"cardid1",r:"u.cardid1",t:"str"},{n:"matricol",r:"u.matricol",t:"nr"},{n:"searchmatricol",r:"u.matricol",t:"str"},{n:"first_name",r:"u.first_name",t:"str"},
                                            {n:"last_name",r:"u.last_name",t:"str"},{n:"name",r:"u.name",t:"str"},{n:"searchdepartment",r:"sg.name",t:"str"},{n:"username",r:"u.username",t:"str"},{n:"sub_group_id",r:"sg.name",t:"str"}]));
        app.get('/users_get_deactivated',(req,res)=> server_api_crud.api_crud_get(req,res,newDBPool,'Users',usermapping,{filter: {deactivated: 1}}));
        app.get('/users_add',            (req,res)=>  api_users_add(req,res,usermapping,settings));
        app.get('/users_edit',           (req,res)=>  api_users_edit(req,res,usermapping,settings));//upd _updated
        app.all('/users_import',         (req,res)=> api_users_import(req,res,usermapping,settings));//????
        app.get('/users_reactivate',     (req,res)=> server_api_crud.api_crud_reactivate(req, res, newDBPool, "Users", usermapping,
            {additionalquery: "UPDATE Users SET require_add=1,require_update=0,require_delete=0 WHERE id={$id};"+
                "UPDATE Settings SET data=" + (new Date().getTime()) + " WHERE name='syncusersstamp';"}));
        app.get('/users_deactivate',     (req,res)=> server_api_crud.api_crud_deactivate(req,res,newDBPool,'users',usermapping,
            {additionalquery:"UPDATE Users SET require_delete=1 WHERE id={$id};UPDATE Settings SET data=" + (new Date().getTime()) + " WHERE name='syncusersstamp';"}));//api_users_deactivate
        app.get('/users_remove',     (req,res)=> server_api_crud.api_crud_remove(req,res,newDBPool,'Users',usermapping));
        app.get("/users_change_subgroup_all", (req, res) => api_users_changeSubGroupForAll(req, res));
        app.get('/late_get', (req, res) => server_api_crud.api_crud_get(req,res,newDBPool,'Users',usermapping,{filter: {islate: 1},additionalwhere:(req.auth.accesstoallusers?null:" sub_group_id IN (SELECT sgr.sub_group_id FROM SubGroupRepresentatives sgr WHERE sgr.user_id = "+req.auth.id+")")},processlatehours))
        app.get('/overtime_get', (req, res) => server_api_crud.api_crud_get(req,res,newDBPool,'Users',usermapping,{filter: {isovertime: 1},additionalwhere:(req.auth.accesstoallusers?null:" sub_group_id IN (SELECT sgr.sub_group_id FROM SubGroupRepresentatives sgr WHERE sgr.user_id = "+req.auth.id+")")},processlatehours))

        //==============VACATIONS
        app.get('/vacations_add',   async(req, res) =>  {
            const result = await api_vac_add(req,res);
            if(result == '') {server_api_crud.api_crud_add(req, res, newDBPool, 'Vacations', usermapping,
                                        {   iselemvalid:checkvacationadd,invalidresponse:"Nu se pot adauga concedii pentru o luna terminata.",
                                            procesitembeforeinsert: function (newitem) {    newitem.daycount = (newitem.dateend - newitem.datestart) / (1000 * 3600 * 24)}})}
            else {res.send({data: [], error: result})}
        });
        app.get('/vacations_edit',  async (req, res) => {
            const result1 = await api_vac_edit(req,res);
            if(result1 == '') { server_api_crud.api_crud_edit(req, res, newDBPool, 'Vacations', usermapping,
                                    { additionalquery: "UPDATE Vacations SET daycount=CEILING((dateend-datestart)/(1000 * 3600 * 24.0)) WHERE id={$id};",
                                      iselemvalid:checkvacationedit,invalidresponse:"Nu se pot edita concedii pentru o luna terminata."});
                              }
            else {res.send({data: [], error: result1})}
        });
        app.get('/vacations_delete',     (req, res) => server_api_crud.api_crud_remove(req,res,newDBPool,'Vacations',usermapping,{iselemvalid:checkvacationremove,invalidresponse:"Nu se pot sterge concedii pentru o luna terminata."}));
        app.get('/vacations_get',    (req,res)=> server_api_crud.api_crud_get_join(req,res,newDBPool," AND "," v.datestart DESC ","v.id",null,
                            " t.vacationtype typename, t.ispure, v.*, u.name, u.matricol ",
                            " FROM Vacations v INNER JOIN Users u ON v.userid=u.id LEFT JOIN Vacationtypes t ON v.type=t.id ",
                            req.auth.accesstoallusers?"":"v.userid  IN ((SELECT u2.id from Users u2 WHERE u2.sub_group_id IN (SELECT sgr.sub_group_id FROM SubGroupRepresentatives sgr WHERE sgr.user_id = "+req.auth.id+")))",
                            [{n:"name",r:"u.name",t:'str'},{n:"matricol",r:"u.matricol",t:'nr'},{n:"typename", r:"t.vacationtype", t:'str'},{n:"typeid", r:"t.id", t:'nr'},
                            {n:"id",r:"v.id",t:'nr'},{n:"userid",r:"u.id",t:'nr'},{n:"datestart",r:"v.datestart",t:'date'},{n:"dateend",r:"v.dateend",t:'date'},{n:"ispure",r:"t.ispure",t:'nr'}]));


        app.get('/vacationtype_get',        (req,res) => server_api_crud.api_crud_get(req,res,newDBPool,'Vacationtypes',usermapping,{filter: {deactivated: 0}}));
        app.get('/vacationtype_get_pure',        (req,res) => server_api_crud.api_crud_get(req,res,newDBPool,'Vacationtypes',usermapping,{filter: {deactivated: 0,ispure:1}}));
        app.get('/vacationtype_get_inpure',        (req,res) => server_api_crud.api_crud_get(req,res,newDBPool,'Vacationtypes',usermapping,{filter: {deactivated: 0,ispure:0}}));
        app.get("/vacationtype_get_deactivated",    (req, res) => server_api_crud.api_crud_get(req, res, newDBPool, "Vacationtypes", usermapping, {filter: {deactivated: 1}}));
        app.get('/vacationtype_add',        (req,res) => server_api_crud.api_crud_add(req,res,newDBPool,'Vacationtypes',usermapping));
        app.get('/vacationtype_edit',       (req,res) => server_api_crud.api_crud_edit(req,res,newDBPool,'Vacationtypes',usermapping));
        app.get('/vacationtype_remove',     (req,res) => server_api_crud.api_crud_remove(req,res,newDBPool,'Vacationtypes',usermapping));
        app.get('/vacationtype_deactivate', (req,res) => server_api_crud.api_crud_deactivate(req,res,newDBPool,'Vacationtypes',usermapping));
        app.get("/vacationtype_reactivate",  (req, res) => server_api_crud.api_crud_reactivate(req, res, newDBPool, "Vacationtypes", usermapping));

        //==============ACTIVITIES
        app.get('/activities_get',        (req,res)=> server_api_crud.api_crud_get_join(req,res,newDBPool," AND "," a.stamp DESC ","a.id", (list)=>{list.forEach(elem => elem.hours);},
                        " a.*, t.name as activityname, u.name, u.matricol ",
                        " FROM Activities a LEFT JOIN Activitytypes t ON a.type=t.slot INNER JOIN Users u ON a.userid=u.id ",
                        req.auth.accesstoallusers?"":"a.userid IN ((SELECT u2.id from Users u2 WHERE u2.sub_group_id IN (SELECT sgr.sub_group_id FROM SubGroupRepresentatives sgr WHERE sgr.user_id = "+req.auth.id+")))",
                        [{n:"name",r:"u.name",t:'str'},{n:"userid",r:"u.id",t:'nr'},{n:"matricol",r:"u.matricol",t:'nr'},{n:"type",r:"t.name",t:'str'},{n:"activityname", r:"t.name", t:'str'},
                        {n:"activitiesid",r:"a.id",t:'nr'},{n:"id",r:"a.id",t:'nr'},{n:"idtype",r:"t.slot",t:'nr'},{n:"stamp",r:"a.stamp",t:'date'}]));//filtering with autocomplete(id->name)
        app.get('/activities_add',        (req,res)=> server_api_crud.api_crud_add(req,res,newDBPool,'Activities',usermapping,{iselemvalid:checkactivityadd,invalidresponse:"Nu se pot adauga activitati pentru o luna terminata."}));
        app.get('/activities_edit',       (req,res)=> server_api_crud.api_crud_edit(req,res,newDBPool,'Activities',usermapping,{iselemvalid:checkactivityedit,invalidresponse:"Nu se pot edita activitati pentru o luna terminata."}));
        app.get('/activities_remove',     (req,res)=> server_api_crud.api_crud_remove(req,res,newDBPool,'Activities',usermapping,{iselemvalid:checkactivityremove,invalidresponse:"Nu se pot sterge activitati pentru o luna terminata."}));
        app.get('/activities_for_sg_add', (req,res)=> api_activities_for_sg_add(req,res,usermapping));
        app.get('/activitytype_get',      (req,res)=> server_api_crud.api_crud_get(req,res,newDBPool,'Activitytypes',usermapping));
        app.get('/activitytype_edit',     (req,res)=> server_api_crud.api_crud_edit(req,res,newDBPool,'Activitytypes',usermapping));

        //==============EDIT OVERTIME
        app.get('/editovertime_get', (req,res)=>{   let date=new Date();let reportdate=date.getFullYear()*100+(date.getMonth()==0?-87:(date.getMonth()-1));
                                                    server_api_crud.api_crud_get_join(req,res,newDBPool," AND "," u.name ASC ","r.id", (list)=>{list.forEach(elem => elem.overtimebalance=Math.trunc(elem.overtimebalance/60));},
                                                        " u.name, u.matricol, r.id, r.overtimebalance "," FROM Reports r INNER JOIN Users u ON r.userid=u.id ",
                                                        "r.date="+reportdate+(req.auth.accesstoallusers?" ":" AND r.userid IN ((SELECT u2.id from Users u2 WHERE u2.sub_group_id IN (SELECT sgr.sub_group_id FROM SubGroupRepresentatives sgr WHERE sgr.user_id = "+req.auth.id+")))"),
                                                            [{n:"name",r:"u.name",t:'str'},{n:"matricol",r:"u.matricol",t:'nr'}])
                                                });
        app.get('/editovertime_edit',(req,res)=> server_api_crud.api_crud_edit(req,res,newDBPool,'Reports',usermapping,{processvalue:(q)=>{q.value*=60}}));
        
        

        //==============DEPARTMENTS
        app.get('/units_get',      (req,res)=> server_api_crud.api_crud_get_join(req,res,newDBPool," AND "," id DESC ","un.id",null,"*"," FROM Units un ",
                                                req.auth.accesstoallusers?"":"un.id IN (SELECT ur.unit_id FROM UnitsRepresentatives ur WHERE ur.user_id = "+ req.auth.id +")",
                                                [{n:"name",r:"un.name",t:'str'},{n:"id",r:"un.id",t:'nr'}]));
        app.get('/units_edit',     (req,res)=> server_api_crud.api_crud_edit(req,res,newDBPool,'Units',usermapping));
        app.get('/units_remove',     (req, res) => server_api_crud.api_crud_remove(req,res,newDBPool,'Units',usermapping));
        app.get('/units_add',  (req, res) => server_api_crud.api_crud_add(req,res,newDBPool,'Units',usermapping));


        app.get('/groups_get',     (req,res)=> server_api_crud.api_crud_get_join(req,res,newDBPool," AND "," id DESC ","g.id",null,"g.*,u.name as unitname"," FROM Groups g LEFT JOIN Units u ON g.unit_id = u.id",
                                                req.auth.accesstoallusers?"":"g.id IN (SELECT gr.group_id FROM GroupRepresentatives gr WHERE gr.user_id = "+ req.auth.id +")",
                                                [{n:"name",r:"g.name",t:'str'},{n:"code",r:"g.code",t:'str'},{n:"key_ref",r:"g.key_ref",t:'str'},{n:"id",r:"g.id",t:'nr'},{n:"group_id",r:"g.id",t:'nr'},{n:"unitname",r:"u.name",t:'str'},{n:'unit_id',r:'g.unit_id',t:'nrpos'}]));
        app.get('/groups_edit',    (req,res)=> server_api_crud.api_crud_edit(req,res,newDBPool,'Groups',usermapping,{additionalquery:"UPDATE g SET key_ref=CONCAT(g.code,'-',(SELECT TOP 1 u.name FROM Units u WHERE u.id=g.unit_id)) FROM Groups g WHERE g.id={$id};      UPDATE s SET key_ref=CONCAT(s.code,'-',(SELECT TOP 1 g.key_ref FROM Groups g WHERE g.id=s.group_id)) FROM SubGroups s WHERE s.group_id={$id};"}));
        app.get('/groups_remove',     (req, res) => server_api_crud.api_crud_remove(req,res,newDBPool,'Groups',usermapping));
        app.get('/groups_add',  (req, res) => server_api_crud.api_crud_add(req,res,newDBPool,'Groups',usermapping,{},processGroupsKeyRef));

        app.all('/subgroups_import',         (req,res)=> api_subgroups_import(req,res,usermapping,settings));//????
        app.get('/subgroups_get',  (req,res)=> server_api_crud.api_crud_get_join(req,res,newDBPool,req.query.useor=='1'?" OR ":" AND "," sb.name ASC ","sb.id",null,
                                                    " DISTINCT sb.*, g.name groupName, g.id group_id, SUBSTRING((SELECT ',' + CAST(u.matricol as nvarchar(10)) AS [text()] "+
                                                        "FROM SubGroupRepresentatives sgr JOIN Users u ON u.id = sgr.user_id "+
                                                        "WHERE sgr.sub_group_id = sb.id FOR XML PATH(''), TYPE).value('text()[1]','nvarchar(max)'),2,1000) [representatives_ids] ",
                                                    " FROM SubGroups sb LEFT JOIN Groups g ON sb.group_id = g.id  ",
                                                    req.auth.accesstoallusers?"":("(sb.id IN (SELECT sgr.sub_group_id FROM SubGroupRepresentatives sgr WHERE sgr.user_id = "+req.auth.id+") )"),
                                                    [{n:"name",r:"sb.name",t:"str"},{n:"code",r:"sb.code",t:"str"},{n:"group_id", r:"g.name",t:"str"}, {n:"groupName", r:"g.name",t:"str"},
                                                    {n:"group_id",r:"sb.group_id",t:"nrpos"},{n:"sub_group_id",r:"sb.id",t:"nr"},{n:"key_ref",r:"sb.key_ref",t:"str"},{n:"id",r:"sb.id",t:"nr"},
                                                    {n:"representatives_ids",r:"SUBSTRING( (SELECT ',' + CAST(u.matricol as nvarchar(10)) AS [text()] FROM SubGroupRepresentatives sgr "+
                                                        " JOIN Users u ON u.id = sgr.user_id WHERE sgr.sub_group_id = sb.id FOR XML PATH(''), TYPE).value('text()[1]','nvarchar(max)'),2,1000)",t:"str"}]));
        app.get('/subgroups_add',  (req, res) => server_api_crud.api_crud_add(req,res,newDBPool,'SubGroups',usermapping,{},processSubGroupKeyRef));
        app.get('/subgroups_edit', (req,res)=> server_api_crud.api_crud_edit(req,res,newDBPool,'SubGroups',usermapping,{additionalquery:"UPDATE s SET key_ref=CONCAT(s.code,'-',(SELECT TOP 1 g.key_ref FROM Groups g WHERE g.id=s.group_id)) FROM SubGroups s WHERE s.id={$id};"}));
        app.get('/subgroups_remove',     (req, res) => server_api_crud.api_crud_remove(req,res,newDBPool,'SubGroups',usermapping));
        app.get('/subgroups_get_with_transfer',  (req,res)=> server_api_crud.api_crud_get_join(req,res,newDBPool,req.query.useor=='1'?" OR ":" AND "," sb.name ASC ","sb.id",null,
                                                        " DISTINCT sb.*, g.name groupName, g.id group_id, SUBSTRING((SELECT ',' + CAST(u.matricol as nvarchar(10)) AS [text()] "+
                                                            "FROM SubGroupRepresentatives sgr JOIN Users u ON u.id = sgr.user_id "+
                                                            "WHERE sgr.sub_group_id = sb.id FOR XML PATH(''), TYPE).value('text()[1]','nvarchar(max)'),2,1000) [representatives_ids] ",
                                                        " FROM SubGroups sb LEFT JOIN Groups g ON sb.group_id = g.id ",
                                                        req.auth.accesstoallusers?"":("(sb.id IN (SELECT sgr.sub_group_id FROM SubGroupRepresentatives sgr WHERE sgr.user_id = "+req.auth.id+")  OR sb.name='Transferare')"),
                                                        [{n:"name",r:"sb.name",t:"str"},{n:"code",r:"sb.code",t:"str"},{n:"group_id", r:"g.name",t:"str"},{n:"depart_name",r:"g.name",t:"str"},
                                                        {n:"group_id",r:"sb.group_id",t:"nrpos"},{n:"key_ref",r:"sb.key_ref",t:"str"},{n:"id",r:"sb.id",t:"str"},
                                                        {n:"representatives_ids",r:"SUBSTRING( (SELECT ',' + CAST(u.matricol as nvarchar(10)) AS [text()] FROM SubGroupRepresentatives sgr "+
                                                            " JOIN Users u ON u.id = sgr.user_id WHERE sgr.sub_group_id = sb.id FOR XML PATH(''), TYPE).value('text()[1]','nvarchar(max)'),2,1000)",t:"str"}]));
        app.get('/subgroups_reps_get',     (req,res)=> server_api_crud.api_crud_get_join(req,res,newDBPool," AND "," u.matricol ASC ","sgr.id",null,
                                                        "sgr.id id, u.matricol, u.first_name firstName, u.last_name lastName",
                                                        " FROM SubGroupRepresentatives sgr JOIN Users u ON sgr.user_id = u.id  ","",
                                                        [{n:"selectedSubGroupId",r:"sgr.sub_group_id",t:'nrpos'}]));
        app.get('/subgroups_reps_add',     (req,res)=> api_subGroupsRepresentatives_add(req,res,usermapping));
        app.get('/subgroups_reps_remove',  (req,res)=> server_api_crud.api_crud_remove(req,res,newDBPool,'SubGroupRepresentatives',usermapping));
        //==============HISTORY
        app.get('/history_users_get',    (req,res)=> api_history_users(req,res));
        app.get('/history_reports_get',   (req,res)=> api_history_reports(req,res));
        app.get('/history_reports_download',   (req,res)=> api_history_reports_download(req,res));
        app.get('/history_scans_get',     (req,res)=> api_history_scans(req,res));
        app.get('/history_vacations_get',  (req,res)=> api_history_vac(req,res));
        app.get('/history_activities_get',  (req,res)=> api_history_activ(req,res));
        app.get('/history_subgr_get',(req,res)=> api_history_subgr(req,res));
        //==============TERMINALS
        app.get('/terminals_get',        (req,res)=> server_api_crud.api_crud_get(req,res,newDBPool,'Terminals as t',usermapping,{filter: {'t.deactivated': 0},
            replacewhere:{locationid:"l.name",name:"t.name"},
            orderbyprefix:"t.",
            customsql:"SELECT t.*, l.name as locationname FROM Terminals AS t LEFT JOIN locations as l ON (t.locationid=l.id) {{WHERE}} AND t.deactivated=0 {{ORDERBY}} {{PAGINATION}};"+
                      "SELECT COUNT(t.id) as count FROM  Terminals t LEFT JOIN Locations l ON (t.locationid=l.id) {{WHERE}} AND t.deactivated=0;"}));

        app.get("/terminals_get_deactivated", (req, res) => server_api_crud.api_crud_get(req, res, newDBPool, "Terminals", usermapping, {filter: {deactivated: 1}}));
        app.get('/terminals_add',        (req,res)=> server_api_crud.api_crud_add(req,res,newDBPool,'Terminals',usermapping));
        app.get('/terminals_edit',       (req,res)=> server_api_crud.api_crud_edit(req,res,newDBPool,'Terminals',usermapping));
        app.get('/terminals_remove',     (req,res)=> server_api_crud.api_crud_remove(req,res,newDBPool,'Terminals',usermapping));
        app.get('/terminals_reactivate',     (req,res)=> server_api_crud.api_crud_reactivate(req,res, newDBPool, "Terminals", usermapping));
        app.get('/terminals_deactivate', (req,res)=> server_api_crud.api_crud_deactivate(req,res,newDBPool,'Terminals',usermapping));

        //==============LOCATIONS
        app.get('/locations_get_deactivated', (req,res)=> server_api_crud.api_crud_get(req,res,newDBPool,'Locations',usermapping,{filter: {deactivated: 1}}));
        app.get('/locations_get',        (req,res)=> server_api_crud.api_crud_get(req,res,newDBPool,'Locations',usermapping,{filter: {deactivated: 0}}));
        app.get('/locations_add',        (req,res)=> server_api_crud.api_crud_add(req,res,newDBPool,'Locations',usermapping));
        app.get('/locations_edit',       (req,res)=> server_api_crud.api_crud_edit(req,res,newDBPool,'Locations',usermapping));
        app.get('/locations_remove',     (req,res)=> server_api_crud.api_crud_remove(req,res,newDBPool,'Locations',usermapping));
        app.get('/locations_reactivate',     (req,res)=> server_api_crud.api_crud_reactivate(req, res, newDBPool, "Locations", usermapping));
        app.get('/locations_deactivate', (req,res)=> server_api_crud.api_crud_deactivate(req,res,newDBPool,'Locations',usermapping));

        //===============HOLIDAYS
        app.get('/holidays_get',     (req,res)=> server_api_crud.api_crud_get(req,res,newDBPool,'Holidays',usermapping));
        app.get('/holidays_add',     (req,res)=> server_api_crud.api_crud_add(req,res,newDBPool,'Holidays',usermapping));
        app.get('/holidays_edit',    (req,res)=> server_api_crud.api_crud_edit(req,res,newDBPool,'Holidays',usermapping));
        app.get('/holidays_remove',  (req,res)=> server_api_crud.api_crud_remove(req,res,newDBPool,'Holidays',usermapping));

        //==============REASONS
        app.get('/editreasons_get',        (req,res)=> server_api_crud.api_crud_get(req,res,newDBPool,'Editreason',usermapping,{filter: {deactivated: 0}}));
        app.get('/editreasons_get_deactivated',        (req,res)=> server_api_crud.api_crud_get(req,res,newDBPool,'Editreason',usermapping,{filter: {deactivated: 1}}));
        app.get('/editreasons_deactivate', (req,res)=> server_api_crud.api_crud_deactivate(req,res,newDBPool,'Editreason',usermapping));
        app.get("/editreasons_reactivate", (req, res) => server_api_crud.api_crud_reactivate(req, res, newDBPool, "Editreason", usermapping));
        app.get("/editreasons_remove", (req, res) => server_api_crud.api_crud_remove(req, res, newDBPool, "Editreason", usermapping));
        app.get('/editreasons_edit',       (req,res)=> server_api_crud.api_crud_edit(req,res,newDBPool,'Editreason',usermapping));
        app.get('/editreasons_add',        (req,res)=> server_api_crud.api_crud_add(req,res,newDBPool,'Editreason',usermapping));

        //==============SHIFTS
        app.get('/shifts_get',        (req,res)=> server_api_crud.api_crud_get(req,res,newDBPool,'Shifts',usermapping,{},processlatestdate));//,{filter: {deactivated: 0}}
        app.get('/shifts_add',        (req,res)=> server_api_crud.api_crud_add(req,res,newDBPool,'Shifts',usermapping));
        app.get('/shifts_edit',       (req,res)=> server_api_crud.api_crud_edit(req,res,newDBPool,'Shifts',usermapping));
        app.get('/shifts_remove',     (req,res)=> server_api_crud.api_crud_remove(req,res,newDBPool,'Shifts',usermapping, {checkFKQuery: "SELECT COUNT(*) as count FROM Users WHERE shift = {$id};"}));
        app.get('/shiftschedule_get',       (req,res)=> server_api_crud.api_crud_get(req,res,newDBPool,'Shiftschedule',usermapping));
        app.get('/shiftschedule_get_id',    (req,res)=> {server_api_crud.api_crud_get(req,res,newDBPool,'Shiftschedule',usermapping,
            {   useequalinsteadoflike:true,whereprefix:"sch.", customsql:"SELECT sch.*,s.name FROM Shiftschedule AS sch LEFT JOIN Shifts AS s ON sch.shiftid=s.id {{WHERE}} {{ORDERBY}};"+
                "SELECT COUNT(sch.id) as count FROM  Shiftschedule sch {{WHERE}};"},scandatainjection);});
        app.get('/shiftschedule_edit',async (req,res)=> {   const userid=await getuseridfromschedule(req.query)
                                                            await server_api_crud.api_crud_edit(req,res,newDBPool,'Shiftschedule',usermapping)
                                                            updateshifts(newDBPool,userid);});
        app.get('/shiftschedule_delete',async(req,res)=> {  const userid=await getuseridfromschedule(req.query)
                                                            await server_api_crud.api_crud_remove(req,res,newDBPool,'Shiftschedule',usermapping);
                                                            updateshifts(newDBPool,userid);});
        app.get('/shiftschedule_add',async  (req,res)=> {   const userid=await getuseridfromschedule(req.query)
                                                            await server_api_crud.api_crud_add(req,res,newDBPool,'Shiftschedule',usermapping);
                                                            updateshifts(newDBPool,userid);});
        app.get('/shifts_get_unused',       (req,res)=> server_api_crud.api_crud_query(req,res,newDBPool,"SELECT s.name FROM Shifts s LEFT JOIN Users u ON u.shift=s.id LEFT JOIN Shiftschedule ss ON ss.shiftid=s.id WHERE u.id IS NULL AND ss.id IS NULL;"));
        app.get('/shifts_get_names',        (req,res)=> server_api_crud.api_crud_get(req,res,newDBPool,'Shifts',usermapping,{columns:"id,name"}));
        app.get('/shifts_get_program',      (req,res)=> api_getshiftprogramm(req,res));


        //==============ADMIN
        app.get('/admin_reset_resp_accounts',(req,res)=> api_admin_reset_resp_accounts(req,res,usermapping));
        app.get('/settings_get',             (req,res)=> server_api_crud.api_crud_get(req,res,newDBPool,'Settings',usermapping));
        app.get('/settings_edit',            (req,res)=> server_api_crud.api_crud_edit(req,res,newDBPool,'Settings',usermapping));
        app.get('/cfsoveoiuh',               (req,res)=> diff_import_incedo(req,res,usermapping));//hidden link...     https://localhost/cfsoveoiuh?year=2022&month=2&day=16
        app.get('/getallfinalizedstatus',    (req,res)=> api_getallfinalizedstatus(req,res));
        app.get('/lockmonth',                (req,res)=> api_lockmonth(req,res));
        app.get('/unlockmonth',              (req,res)=> api_unlockmonth(req,res));
        app.get('/downloadfinalizedarchive', (req,res)=> {  api_downloadfinalizedarchive(req,res).catch(err=>res.send({error: "Eroare la generare arhiva:"+err.message}));});
        

        //==============PERMISSIONS
        app.get('/permissions_get',        (req,res)=> server_api_crud.api_crud_get(req,res,newDBPool,'Permissions',usermapping,{filter: {deactivated: 0}}));
        app.get('/permissions_add',        (req,res)=> server_api_crud.api_crud_add(req,res,newDBPool,'Permissions',usermapping));
        app.get('/permissions_edit',       (req,res)=> server_api_crud.api_crud_edit(req,res,newDBPool,'Permissions',usermapping));
        app.get('/permissions_remove',     (req,res)=> server_api_crud.api_crud_remove(req,res,newDBPool,'Permissions',usermapping, {checkFKQuery: "SELECT COUNT(*) as count FROM Users WHERE permission_id = {$id};"}));

        //==============AUDIT
        app.get('/audit_get', (req,res)=> server_api_crud.api_crud_get_join(req,res,newDBPool," AND "," stamp DESC ","a.id",null,
                                            " a.id, a.stamp, a.val, a.userid, u.first_name firstName, u.last_name lastName, u.matricol matricol ",
                                            " FROM Audit a LEFT JOIN Users u ON a.userid=u.id ","",
                                            [{n:"firstName",r:"u.first_name",t:'str'},{n:"id",r:"a.id",t:'nr'},{n:"userid",r:"a.userid",t:'nr'},{n:"matricol",r:"u.matricol",t:'nr'},
                                            {n:"lastName",r:"u.last_name",t:'str'},{n:"val",r:"a.val",t:'str'},{n:"stamp",r:"a.stamp",t:'date'}]));
        app.get('/clockingchanges_get',        (req,res)=> server_api_crud.api_crud_get_join(req,res,newDBPool," AND "," stamp DESC ","c.id",injectscandata,
                                            " c.*, l.name location, er.reason reason, c.[scantype] type_print , c.scaninorout inorout_print, u.name name, u2.name scanname, u.matricol matricol, u2.matricol scanmatricol, sg.name subgroup",
                                            " FROM Clockingchangesaudit c  LEFT JOIN Locations l on l.id = c.scanlocation LEFT JOIN Editreason er on er.id = c.reasonid LEFT JOIN Users u on u.id = c.userid LEFT JOIN Users u2 on u2.id = c.scanuserid LEFT JOIN SubGroups sg on u2.sub_group_id = sg.id","",
                                            [{n:"type",r:"c.type",t:'str'},{n:"name",r:"u.name",t:'str'},{n:"reason",r:"er.reason",t:'str'},
                                            {n:"modification",r:"c.modification",t:'str'},{n:"scanid",r:"c.scanid",t:'nr'},{n:"scanname",r:"u2.name",t:'str'},
                                            {n:"location",r:"l.name",t:'str'},{n:"matricol",r:"u.matricol",t:'nr'},{n:"scanmatricol",r:"u2.matricol",t:'nr'},
                                            {n:"userid",r:"u.id",t:'nr'},{n:"scanuserid",r:"u2.id",t:'nr'},{n:"locationid",r:"l.id",t:'nr'},{n:"reasonid",r:"er.id",t:'nr'},
                                            {n:"stamp",r:"c.stamp",t:'date'},{n:"scanstamp",r:"c.scanstamp",t:'date'},{n:"scaninorout",r:"c.scaninorout",t:'nr'},
                                            {n:"subgroup",r:"sg.name",t:'str'}, {n:"sub_group_id",r:"sg.id",t:'nr'}]));

        app.get('/restricted_clockingchanges_get',        (req,res)=> server_api_crud.api_crud_get_join(req,res,newDBPool," AND "," stamp DESC ","c.id",injectscandata,
                                            " c.*, l.name location, er.reason reason, c.[scantype] type_print , c.scaninorout inorout_print, u.name name, u2.name scanname, u.matricol matricol, u2.matricol scanmatricol, sg.name subgroup",
                                            " FROM Clockingchangesaudit c  LEFT JOIN Locations l on l.id = c.scanlocation LEFT JOIN Editreason er on er.id = c.reasonid LEFT JOIN Users u on u.id = c.userid LEFT JOIN Users u2 on u2.id = c.scanuserid LEFT JOIN SubGroups sg on u2.sub_group_id = sg.id",
                                            req.auth.accesstoallusers?"":("(sg.id IN (SELECT sgr.sub_group_id FROM SubGroupRepresentatives sgr WHERE sgr.user_id = "+req.auth.id+") )"),
                                            [{n:"type",r:"c.type",t:'str'},{n:"name",r:"u.name",t:'str'},{n:"reason",r:"er.reason",t:'str'},
                                            {n:"modification",r:"c.modification",t:'str'},{n:"scanid",r:"c.scanid",t:'nr'},{n:"scanname",r:"u2.name",t:'str'},
                                            {n:"location",r:"l.name",t:'str'},{n:"matricol",r:"u.matricol",t:'nr'},{n:"scanmatricol", r:"u2.matricol",t:'nr'},
                                            {n:"userid",r:"u.id",t:'nr'},{n:"scanuserid",r:"u2.id",t:'nr'},{n:"locationid",r:"l.id",t:'nr'},{n:"reasonid",r:"er.id",t:'nr'},
                                            {n:"stamp",r:"c.stamp",t:'date'},{n:"scanstamp",r:"c.scanstamp",t:'date'},{n:"scaninorout",r:"c.scaninorout",t:'nr'},
                                            {n:"subgroup",r:"sg.name",t:'str'}, {n:"sub_group_id",r:"sg.id",t:'nr'}]));
        app.get('/clockingchanges_add',        (req,res)=> server_api_crud.api_crud_add(req,res,newDBPool,'Clockingchangesaudit',usermapping,{returnid:true},injectuserclockingchange));
        app.get('/clockingchanges_edit',       (req,res)=> server_api_crud.api_crud_edit(req,res,newDBPool,'Clockingchangesaudit',usermapping));
        app.get('/clockinginvacation_get',     (req,res)=> api_clockinginvacation_add(req,res,newDBPool,usermapping));
        app.get('/utils_get_inout',         (req,res)=> api_utils_inout(req,res,usermapping));
        app.get('/log_file_get',                     (req,res)=> api_log_file_get(req,res));
        app.get('/errors_get',                       (req,res)=> {  if(fs.existsSync(process.cwd()+'/logs/errors.log'))res.send({data:  Buffer.from(fs.readFileSync(process.cwd()+'/logs/errors.log')).toString(), error: ""});
                                                else res.send({data: [], error: "Fisier lipsa(Nu exista erori)."});});
        app.get('/tablenames',  (req, res) => api_get_tablenames(req, res));
        app.get('/advancedtablequery',  (req, res) => api_advancedtablequery(req, res));
        //==============UTILS
        app.get('/departmentnames', (req, res) => api_get_departmentnames(req, res))

}
function processSubGroupKeyRef (uesrs,newitem,auth) {
    try {
        if (groupsMapping.hasOwnProperty(newitem.group_id)) {
            let groupKeyRef = groupsMapping[newitem.group_id].key_ref
            newitem.key_ref = `${newitem.code}-${groupKeyRef}`
        }
    } catch (error) {
        logerr(error)
    }
}

function processGroupsKeyRef(users,newitem,auth)
    {   try {   if(unitsMapping.hasOwnProperty(newitem.unit_id))
                    newitem.key_ref = newitem.code+"-"+unitsMapping[newitem.unit_id].name;
            }
        catch (error)
            {   logerr(error)
            }
    }

function processlatestdate(users,values)
    {   let now = new Date();
        now.setHours(10); now.setMinutes(0); now.setSeconds(0); now.setMilliseconds(0);
        now = now.getTime();
        values.forEach(elem =>
            {   const stamp = parseInt(elem.refdate);
                if(stamp>now)//future
                    {   const daysbetween = Math.round((stamp-now)/(24*3600000));
                        const offset = Math.floor(daysbetween/elem.period)*elem.period;
                        elem.refdate = new Date(stamp-offset*24*3600000).getTime()+"";
                    }
                else{   const daysbetween = Math.round((now-stamp)/(24*3600000));//past
                        const offset = Math.floor(daysbetween/elem.period)*elem.period;
                        elem.refdate = new Date(stamp+offset*24*3600000).getTime()+"";
                    }
            });
    }
function injectuserclockingchange(users,obj,auth)
    {   obj.userid = auth.id
    }
function injectscandata(array)
    {   for (const row of array)
            {   row.type_print = getscantypename(row.type_print);
                row.inorout_print = getinoroutname(row.inorout_print);
            }
    }
function scandatainjection(users,array)
    {   array.forEach(elem => {
            elem.userid = users.id.hasOwnProperty(elem.userid)?users.id[elem.userid].name:"Utilizator sters (id="+elem.userid+")"
            elem.inorout_print = getinoroutname(elem.inorout);
            elem.type_print = getscantypename(elem.type);
        });
    }
function injectuserdata(array)
    {   array.forEach((elem)=>
            {   elem.shiftname = shiftmapping.hasOwnProperty(elem.shift)?shiftmapping[elem.shift].name:'Tura implicita';
                elem.permissionname = permissionMapping.hasOwnProperty(elem.permission_id)?permissionMapping[elem.permission_id].name:'Fara';
                elem.hash = "";//DON'T SEND PASSWORD HASH!!!!!
            })
    }
async function checkactivityadd(item) {
    if(!usermapping.id.hasOwnProperty(item.userid))return false;
    return isStampValidForActivityEdit(usermapping.id[item.userid].sub_group_id,item.stamp);
}
async function checkactivityedit(query) {
    let result;
    try {   result=await newDBPool.query("SELECT * FROM Activities WHERE id="+query.id+";");
    } catch (error) {
        logerr(error);
        return false;
    }
    if(result.recordset.length==0)return false;
    let activity=result.recordset[0];
    if(!usermapping.id.hasOwnProperty(activity.userid))return false;

    let subgroupid=usermapping.id[activity.userid].sub_group_id;

    if(query.field === 'stamp')
        if(!isStampValidForActivityEdit(subgroupid,parseInt(query.value)))return false;

    return isStampValidForActivityEdit(subgroupid,parseInt(activity.stamp));
}
async function checkactivityremove(id) {
    let result;
    try {   result=await newDBPool.query("SELECT * FROM Activities WHERE id="+id+";");
    } catch (error) {
        logerr(error);
        return false;
    }
    if(result.recordset.length==0)return false;
    let activity=result.recordset[0];
    if(!usermapping.id.hasOwnProperty(activity.userid))return false;

    let subgroupid=usermapping.id[activity.userid].sub_group_id;

    return isStampValidForActivityEdit(subgroupid,parseInt(activity.stamp));
}
async function checkvacationadd(item) {
    if(!usermapping.id.hasOwnProperty(item.userid))return false;
    let subgroupid=usermapping.id[item.userid].sub_group_id;
    return isStampValidForVacationEdit(subgroupid,parseInt(item.dateend)) &&
           isStampValidForVacationEdit(subgroupid,parseInt(item.datestart));
}
async function checkvacationedit(query) {
    let result;
    try {   result=await newDBPool.query("SELECT * FROM Vacations WHERE id="+query.id+";");
    } catch (error) {
        logerr(error);
        return false;
    }
    if(result.recordset.length==0)return false;
    let vacation=result.recordset[0];
    if(!usermapping.id.hasOwnProperty(vacation.userid))return false;

    let subgroupid=usermapping.id[vacation.userid].sub_group_id;

    if(query.field === 'datestart' || query.field === 'dateend')
        if(!isStampValidForActivityEdit(subgroupid,parseInt(query.value)))return false;

    return  isStampValidForVacationEdit(subgroupid,parseInt(vacation.dateend)) &&
            isStampValidForVacationEdit(subgroupid,parseInt(vacation.datestart));
}

async function checkvacationremove(id) {
    let result;
    try {   result=await newDBPool.query("SELECT * FROM Vacations WHERE id="+id+";");
    } catch (error) {
        logerr(error);
        return false;
    }
    if(result.recordset.length==0)return false;
    let vacation=result.recordset[0];
    if(!usermapping.id.hasOwnProperty(vacation.userid))return false;

    let subgroupid=usermapping.id[vacation.userid].sub_group_id;

    return  isStampValidForVacationEdit(subgroupid,parseInt(vacation.dateend)) &&
            isStampValidForVacationEdit(subgroupid,parseInt(vacation.datestart));
}



async function fixscanparity_addedit(id,_settings) {
    try {   if(_settings.singlescanner!=1)return;
            let result=await newDBPool.query("SELECT TOP 1 * FROM Scans WHERE id="+id+";");
            if(result.recordset.length==0)return;
            let mainscan=result.recordset[0];
            let isin=mainscan.inorout==1;//1 in, 2 out
            result=await newDBPool.query("SELECT id,inorout FROM Scans WHERE stamp>"+mainscan.stamp+" AND userid="+mainscan.userid+" ORDER BY stamp ASC;");
            let toupdate=[];
            result.recordset.forEach((scan)=>
                {   isin=!isin;
                    if(toupdate.length>1000)return;//don't do anything if to many changes have to be done, they will be covered by the next method call
                    if((scan.inorout==1)!=isin)
                        toupdate.push("UPDATE Scans SET inorout="+(isin?1:2)+" WHERE id="+scan.id+";");
                })
            await newDBPool.query(toupdate.join(''));
        } 
    catch (error) 
        {   logerr(error);
            return false;
        }
}
async function fixscanparity_delete(timestamp,userid,_settings) {
    try {   if(_settings.singlescanner!=1)return;
            let result=await newDBPool.query("SELECT TOP 1 id FROM Scans WHERE userid="+userid+" AND stamp<"+timestamp+" ORDER BY stamp DESC;");
            if(result.recordset.length==0)
                result=await newDBPool.query("SELECT TOP 1 id FROM Scans WHERE userid="+userid+" AND stamp>"+timestamp+" ORDER BY stamp ASC;");
            if(result.recordset.length==0)return;
            await fixscanparity_addedit(result.recordset[0].id,_settings);
        }
    catch (error) 
        {   logerr(error);
            return false;
        }
}
async function getuseridfromschedule(q) 
    {   if(q.hasOwnProperty('newitem'))
            {   try {   let user=JSON.parse(q.newitem);
                        if(user.hasOwnProperty('userid'))
                        return user.userid;
                    } catch (err) {logerr(err);}
            }
        if(!q.hasOwnProperty('id'))return -1;
        try {   let result=await newDBPool.query("SELECT TOP 1 userid FROM ShiftSchedule WHERE id="+q.id+";");
                if(result.recordset.length==0)return -1;
                return result.recordset[0].userid;   
            }
        catch (error) 
            {   logerr(error);
                return -1;
            }
        return -1;
    }
function processlatehours(users,values)
    {   values.forEach(user => {
            user.shiftstart=(user.shiftstart<20?"0":"")+Math.trunc(user.shiftstart/2)+(user.shiftstart%2==1?":30":":00");
            user.shiftend=(user.shiftend<20?"0":"")+Math.trunc(user.shiftend/2)+(user.shiftend%2==1?":30":":00");
        });
    }

//=======================================================================
//=======================================================================CUSTOM API
//=======================================================================
function api_login(req,res,users,tokenlifetimehours)
    {   const username = req.query.username;
        const password = req.query.password;

        if(typeof username !== 'string' || typeof password !== 'string' || username.length==0|| password.length==0)
            {   res.send({success:false,error:"Lipsesc parametri de autentificare."})
                return;
            }
        if(!users.username.hasOwnProperty(username.toLowerCase()))
            {   res.send({success:false,error:"Utilizatorul nu are cont web."});
                return;
            }
        const user = users.username[username.toLowerCase()];
        if(gethash(password)!==user.hash)
            {   res.send({success:false,error:"Parola gresita."});
                return;
            }
        res.cookie('jwt',buildtoken(user.username.toLowerCase(),user.id,tokenlifetimehours),
            { maxAge: 900000000,httpOnly:false,secure:true});
        res.send({success:true,error:""});
    }
function api_logout(req,res)
    {   res.cookie('jwt',"", { maxAge: 0,httpOnly:false,secure:true});//not really used, browserdeletes  jwt
        res.send({success:true,error:""});
    }
async function api_changepass(req, res, users)
    {   const newpass = req.query.pass;
        if (!isparamvalidstring(newpass)) { res.send({ error: "Parola este incorecta" }); return; }
        try {   await newDBPool.query("UPDATE Users SET hash='" + gethash(newpass) + "' WHERE id=" + req.auth.id + ";" +
                            "UPDATE Settings SET data=" + (new Date().getTime()) + " WHERE name='syncusersstamp';")
                res.send({ error: "" });
                setAudit(req.auth.id, req.auth.name, "Utilizatorul "+req.auth.id+" si-a schimbat parola.", newDBPool);
            }
        catch (err)
            {   res.send({ error: err.message });
                logerr(err);
            }
    }
async function api_changeaccount(req, res, users)
    {   const newaccount = req.query.account.toLowerCase();
        if (!isparamvalidstring(newaccount) || typeof newaccount!='string' || newaccount.length<2) 
            {   res.send({ error: "Nume de cont invalid." }); return;     }
        try {   if((await newDBPool.query("SELECT id FROM Users Where username='"+newaccount+"';")).recordset.length>0)
                    {   res.send({ error: "Contul este deja folosit de altcineva." });
                        return;
                    }
                await newDBPool.query("UPDATE Users SET username='" + newaccount + "' WHERE id=" + req.auth.id + ";" +
                            "UPDATE Settings SET data=" + (new Date().getTime()) + " WHERE name='syncusersstamp';")
                res.send({ error: "" });
                setAudit(req.auth.id, req.auth.name, "Utilizatorul "+req.auth.id+" si-a schimbat contul.", newDBPool);
            }
        catch (err)
            {   res.send({ error: err.message });
                logerr(err);
            }
    }

function api_getuserdata(req,res,users)
    {   let permission = {
            p_dashboard: 1,
            p_clocking: 0,
            p_reports: 0,
            p_scans: 0,
            p_editclocking: 0,
            p_emploees: 0,
            p_vacations: 0,
            p_departments: 0,
            p_terminals: 0,
            p_configs: 0,
            p_admin: 0,
            p_audit: 0,
            p_access_all_users: 0,
            p_advanced_users_edit: 0,
            p_regenerate_report: 0,
          }
        if (permissionMapping.hasOwnProperty(req.auth.userref.permission_id)) {
            permission = permissionMapping[req.auth.userref.permission_id]
        }
        res.send({username:req.auth.name,userid:req.auth.id,permission,error:""})
    }
async function api_utils_inout(req,res,users)
    {   let array = [{name:"Intrare",id:1},{name:"Iesire",id:2}];
        let q = req.query;
        if(isparamvalidstring(q.filter))
            {   try {   const filter = JSON.parse(q.filter)
                        if(filter.hasOwnProperty('name')) array = array.filter((elem)=>elem.name.toLowerCase().includes(filter.name.toLowerCase()))
                    }
                catch (error) {   logerr(error);
                                    res.send({data:array,count:array.length,error:""});
                                    return;
                              }
            }
        res.send({data:array,count:array.length,error:""});
    }
//=======================================================================
//=======================================================================DASHBOARD API
//=======================================================================
async function api_getdashdata2(req,res,users,settings,settingslastsync)
    {   res.send({statusbackend:true,statustasks:true,statusdb:(new Date().getTime()-settingslastsync)<10000,error:""});
    }
async function api_getdashdata3(req,res,users)
    {   let start = new Date(); start.setHours(0,0,0,0);
        start = start.getTime();
        const end = start+24*3600*1000;

        try {   const sql = "SELECT * from Metascans WHERE stamp>"+start+" AND stamp<"+end+" ORDER BY stamp ASC;";
                const result = await newDBPool.query(sql);

                res.send({data:result.recordset,start:start,end:end,error:""});
                return;
            }
        catch(err)
            {   res.send({error:err.message})
                logerr(err);
                return;
            }
    }
//=======================================================================
//=======================================================================WEB CLOCKING API
//=======================================================================
async function api_clock_start(req,res,users)
    {   let dateclocking = new Date().getTime()
        let query = "INSERT INTO SCANS(stamp,userid,location,type,inorout) VALUES("+dateclocking+","+req.auth.id+",-1,"+WEB+",1)";
        query += "UPDATE Users SET ispresent=1,waspresent=1 WHERE id="+req.auth.id+";";
        query += "SELECT TOP 1 id FROM SCANS WHERE stamp="+ dateclocking + " ORDER BY id DESC";

        try {   let result = await newDBPool.query(query);
                await newDBPool.query(`INSERT INTO Scanips(ip,scanid) VALUES('${ req.ip.split(':').pop()}',${result.recordset[0].id});`);
                res.send({data:'A inceput tura!',error:''});
            }
        catch (error)
            {   logerr(error)
                res.send({data:'',error:error.message});
            }
    }
async function api_clock_end(req,res,users)
    {   let dateclocking = new Date().getTime()
        let query = "INSERT INTO SCANS(stamp,userid,location,type,inorout) VALUES("+dateclocking+","+req.auth.id+",-1,"+WEB+",2)";
        query += "UPDATE Users SET ispresent=0 WHERE id="+req.auth.id+";";
        query += "SELECT TOP 1 id FROM SCANS WHERE stamp="+ dateclocking + " ORDER BY id DESC";

        try {   let result = await newDBPool.query(query)
                await newDBPool.query(`INSERT INTO Scanips(ip,scanid) VALUES('${ req.ip.split(':').pop()}',${result.recordset[0].id});`)
                res.send({data:'S-a incheiat tura!',error:''});
            }
        catch (error)
            {   logerr(error)
                res.send({data:'',error:error.message});
            }
    }
async function api_clock_getDetails(req, res, users) {
    try {   let result =  await newDBPool.query("SELECT TOP(1) * FROM SCANS WHERE userid="+req.auth.id+" AND stamp <"+(new Date().getTime()+1000*3600)+"ORDER BY stamp DESC;");
            if (typeof result.recordset.length == 0)
                {   res.send({ data: '', error: 'Scanare trecuta inexistenta' });
                    return;
                }
            res.send({ data: result.recordset[0], error: '' });
        }
    catch (err)
        {   res.send({ data: '', error: err.message });
            logerr(err);
        }
    }
async function api_clockinginvacation_add(req,res,newDBPool,users)//mandatory: query:id,field,value,type
    {   let q = req.query;
        if(!isparamvalidint(q.userid)){ res.send({error:"Userid invalid"});return;}
        if(!isparamvalidint(q.stamp)){ res.send({error:"Data invalida"});return;}

        try {   let okclockingsql = "SELECT TOP 1 id FROM Vacations WHERE userid="+q.userid +" AND datestart-1000*3600*10-1 < "+ q.stamp +" AND dateend+1000*3600*14 > "+ q.stamp +" ORDER BY dateend DESC;";
                let {recordset} = await newDBPool.query(okclockingsql);

                if (recordset.length > 0) {
                    res.send({error:"Nu se poate adauga/modifica scanarea. In acea data este inregistrat un concediu"});
                    return
                }
                res.send({data:'',error:''})
            }
        catch (err)
            {   res.send({error:err.message});
                logerr(err);
            }
    }
//=======================================================================
//=======================================================================CLOCKING EDIT API
//=======================================================================
async function api_getclockingdata(req,res)
    {   let q = req.query;
        if(!isparamvalidint(q.month))   { res.send({error:"Parametrul month este incorect:"+q.month}); return;}
        if(!isparamvalidint(q.year))    { res.send({error:"Parametrul year este incorect:"+q.year}); return;}
        if(!isparamvalidint(q.userid))  { res.send({error:"Parametrul userid este incorect:"+q.userid}); return;}
        let userid = parseInt(q.userid);
        if(!usermapping.id.hasOwnProperty(userid)) { res.send({error:"Utilizatorul nu a fost gasit:"+userid}); return;}
        let year = parseInt(q.year),month = parseInt(q.month);
        let stampstart = new Date(year,month,1).getTime();
        let stampend = new Date(year,month+1,1).getTime();
        let sql = "";
        sql += "SELECT er.reason as reason,ca.modification,s.userid,s.stamp,s.inorout,s.id from Scans s LEFT JOIN Clockingchangesaudit ca ON ca.id=s.changeid LEFT JOIN Editreason er on er.id = ca.reasonid WHERE s.userid="+userid+" AND s.stamp>"+stampstart+" AND s.stamp<"+stampend+" ORDER BY s.stamp ASC;\n";
        sql += "SELECT * from Holidays WHERE stamp>"+stampstart+" AND stamp<"+stampend+";\n";
        sql += "SELECT v.* from Vacations v WHERE userid="+userid+" AND v.datestart-100<"+stampend+" AND v.dateend+100>"+stampstart+";\n";
        sql += "SELECT a.*, at.name, at.code from Activities a LEFT JOIN Activitytypes at ON at.slot = a.type WHERE userid="+userid+" AND  a.stamp>"+stampstart+" AND a.stamp<"+stampend+";\n";
        sql += "SELECT * from Vacationtypes;\n"
        sql += "SELECT s.* from ShiftSchedule s WHERE userid="+userid+" AND  s.datestart-100<"+stampend+" AND s.dateend+100>"+stampstart+";\n";
        sql += "SELECT TOP 1 * from SubGroupRepresentatives WHERE sub_group_id="+usermapping.id[userid].sub_group_id+" AND user_id="+req.auth.id+";\n";
        sql += "SELECT * from Shifts;\n";
        try {   let result = await newDBPool.query(sql);
                if(!req.auth.accesstoallusers&&result.recordsets[6].length==0)
                    {   res.send({error:"Nu aveti acces la acest utilizator."});
                        return;
                    }
                delete result.recordsets[6]
                res.send({data:procesclockingdata(year,month,result.recordsets,usermapping.id[userid].shift),error:""})
            }
        catch(err)
            {   logerr(err);logerr(sql);
                res.send({error:err.message});
            }
    }
async function api_edit_clocking(req,res)
    {   let q = req.query;
        //add:    mode,userid,reasonid,       stamp,inorout
        //delete: mode,userid,reasonid,scanid
        //edit:   mode,userid,reasonid,scanid,stamp,inorout
        q.inorout = q.inorout=='i' ? 1 : 2;
        let sql = '';
        let auditheader = "INSERT INTO Clockingchangesaudit(type,userid,reasonid,stamp,modification,scanid,scanstamp,scanuserid,scanlocation,scantype,scaninorout) VALUES";
        try {   if(q.mode=='delete')
                    {   //CHECK CAN DELETE
                        let result = await newDBPool.query("SELECT s.*,u.sub_group_id as subgroupid from Scans s INNER JOIN Users u ON u.id=s.userid WHERE s.id="+q.scanid+";");
                        if(result.recordset.length==0)
                            {   res.send({error:"Scanarea nu a fost gasita."});
                                return;
                            }
                        let scan = result.recordset[0];
                        if(!isStampValidForScanEdit(scan.subgroupid,parseInt(scan.stamp)))
                            {   res.send({error:"Nu se pot modifica scanari pentru o luna inchisa."});
                                return;
                            }
                        //DELETE
                        await newDBPool.query("DELETE FROM Scans WHERE id="+q.scanid+";");
                        sql = auditheader+"('Stergere',"+req.auth.id+","+q.reasonid+","+(new Date().getTime())+
                                ",'Stergere',"+scan.id+","+scan.stamp+","+scan.userid+","+scan.location+","+scan.type+","+scan.inorout+");"
                        await newDBPool.query(sql);
                        setAudit(req.auth.id,req.auth.name,"Stergere Scanare "+q.scanid,newDBPool);
                        await fixscanparity_delete(parseInt(scan.stamp),scan.userid,settings);
                        res.send({error:""});
                        return;
                    }
                if(q.mode=='add')
                    {   if(!usermapping.id.hasOwnProperty(q.userid))
                            {   res.send({error:"Utilizatorul "+q.userid+" nu exista."});
                                return;
                            }
                        if(!isStampValidForScanEdit(usermapping.id[q.userid].sub_group_id,parseInt(q.stamp)))
                            {   res.send({error:"Nu se pot modifica scanari pentru o luna inchisa."});
                                return;
                            }
                        let result = await newDBPool.query("INSERT INTO Scans(stamp,userid,location,type,inorout,changeid,incedo_id) VALUES("+q.stamp+","+q.userid+",-1,6,"+q.inorout+",-1,-1); SELECT TOP 1 * FROM Scans ORDER BY id DESC;");
                        let scan = result.recordset[0];
                        sql = auditheader+"('Adaugare',"+req.auth.id+","+q.reasonid+","+(new Date().getTime())+
                                ",'Adaugare',"+scan.id+","+scan.stamp+","+scan.userid+","+scan.location+","+scan.type+","+scan.inorout+");"+
                                "SELECT TOP 1 * FROM Clockingchangesaudit ORDER BY id DESC;"
                        result = await newDBPool.query(sql);
                        if(result.recordset.length==0)
                            {   res.send({error:"Modificarea nu a putut fi inregistrata in audit."});
                                return;
                            }
                        await newDBPool.query("UPDATE Scans SET changeid="+result.recordset[0].id+" WHERE id="+scan.id+";");
                        setAudit(req.auth.id,req.auth.name,"Adaugare Scanare "+scan.id,newDBPool);
                        await fixscanparity_addedit(scan.id,settings)
                        res.send({error:""});
                        return;
                    }
                if(q.mode=='edit')
                    {   let result = await newDBPool.query("SELECT * from Scans WHERE id="+q.scanid+";");
                        if(result.recordset.length==0)
                            {   res.send({error:"Scanarea nu a fost gasita."});
                                return;
                            }
                        let scan = result.recordset[0];
                        if(!usermapping.id.hasOwnProperty(scan.userid))
                            {   res.send({error:"Utilizatorul "+scan.userid+" nu exista."});
                                return;
                            }
                        let subgr=usermapping.id[scan.userid].sub_group_id;
                        if(!isStampValidForScanEdit(subgr,parseInt(scan.stamp)))//for old value
                            {   res.send({error:"Nu se pot modifica scanari pentru o luna inchisa."});
                                return;
                            }
                        if(!isStampValidForScanEdit(subgr,parseInt(q.stamp)))//for new value
                            {   res.send({error:"Nu se pot modifica scanari pentru o luna inchisa."});
                                return;
                            }

                        if(q.inorout!=scan.inorout)
                            {   await newDBPool.query("UPDATE Scans SET inorout="+q.inorout+" WHERE id="+q.scanid);
                                sql = auditheader+"('Editare',"+req.auth.id+","+q.reasonid+","+(new Date().getTime())+
                                    ",'Editare "+(q.inorout==1?"Iesire => Intrare":"Intrare => Iesire")+"',"+scan.id+","+scan.stamp+","+scan.userid+","+scan.location+","+scan.type+","+scan.inorout+");"+
                                    "SELECT TOP 1 * FROM Clockingchangesaudit ORDER BY id DESC;";
                                result = await newDBPool.query(sql);
                                if(result.recordset.length==0)
                                    {   res.send({error:"Modificarea nu a putut fi inregistrata in audit."});
                                        return;
                                    }
                                await newDBPool.query("UPDATE Scans SET changeid="+result.recordset[0].id+" WHERE id="+scan.id+";");
                                setAudit(req.auth.id,req.auth.name,"Editare Scanare "+scan.id,newDBPool);
                            }
                        if(scan.stamp!=q.stamp)
                            {   let date1 = new Date(parseInt(scan.stamp));
                                let date2 = new Date(parseInt(q.stamp));
                                date1 = new Date(date1.getTime()-date1.getTimezoneOffset()*60000);
                                date2 = new Date(date2.getTime()-date2.getTimezoneOffset()*60000);
                                let modif = "Editare "+(date1.getFullYear()!=date2.getFullYear()||date1.getMonth()!=date2.getMonth()||date1.getDate()!=date2.getDate()?
                                            ("data "+((date1.toISOString().split('.')[0].slice(0,-3)).replace('T',' '))+" => "+((date2.toISOString().split('.')[0].slice(0,-3)).replace('T',' '))):
                                            ("ora "+((date1.toISOString().split('.')[0].slice(0,-3)).split('T')[1])+" => "+((date2.toISOString().split('.')[0].slice(0,-3)).split('T')[1])));
                                await newDBPool.query("UPDATE Scans SET stamp="+q.stamp+" WHERE id="+q.scanid);
                                sql = auditheader+"('Editare',"+req.auth.id+","+q.reasonid+","+(new Date().getTime())+
                                    ",'"+modif+"',"+scan.id+","+scan.stamp+","+scan.userid+","+scan.location+","+scan.type+","+scan.inorout+");"+
                                    "SELECT TOP 1 * FROM Clockingchangesaudit ORDER BY id DESC;";
                                result = await newDBPool.query(sql);
                                if(result.recordset.length==0)
                                    {   res.send({error:"Modificarea nu a putut fi inregistrata in audit."});
                                        return;
                                    }
                                await newDBPool.query("UPDATE Scans SET changeid="+result.recordset[0].id+" WHERE id="+scan.id+";");
                                setAudit(req.auth.id,req.auth.name,"Editare Scanare "+scan.id,newDBPool);
                            }
                        await fixscanparity_addedit(parseInt(q.scanid),settings)
                        res.send({error:""});
                        return;
                    }
            }
        catch (error)
            {   res.send({error:error.message});
                logerr(error);
                logerr(sql);
                return;
            }
        res.send({error:"Eroare de procesare."});
    }
//=======================================================================
//=======================================================================USERS API
//=======================================================================
async function api_users_edit(req,res,users,settings)
    {   let field = req.query.field, value = req.query.value, id = req.query.id;

        if(typeof id=="undefined"||id==="undefined"||isNaN(parseInt(id)))
            { res.send({data:[],error:"Parametrul id este incorect:"+id});return;}
        if(typeof field=="undefined"||field==="undefined"||field.length<1)
            { res.send({data:[],error:"Parametrul field este incorect:"+field});return;}
        
        // if(typeof value=="undefined"||value==="undefined"||value.length<1&&(field==="first_name"||field==="last_name"||field==="hash"))
        //     { res.send({data:[],error:"Parametrul value este incorect:"+value});return;}
        if(!isparamvalidstringnolen(value)){ res.send({error:"Parametrul value contine caracter invalid:"+value});return;}
        if((field == "cardid1" || field == "cardid2")){
            if (value.startsWith('0')) {
                res.send({data:[],error:"Numarul cardului nu poate sa inceapa cu cifra zero"});return;
            }
            if((typeof usermapping.cardid[value] != "undefined") && (value == usermapping.cardid[value].cardid1 || value == usermapping.cardid[value].cardid2) )
                {   res.send({data:[],error:"Acest card (" + value + ") aparține deja angajatului "+usermapping.cardid[value].name});return;}
        }
        if(field === "username") value=value.toLowerCase();
        if(field === "username" && users.username.hasOwnProperty(value)) {
            return res.send({error:"Username deja existent!"});
        }
        const recalculatename = req.query.field.includes('name')&&!req.query.field.includes('username')

        if(field=='extrahours'||field=='vacationdays'||field=='deactivated'||field=='codays'||field=='colastyear'||field=='shift')
            {   if(isNaN(parseInt(value)))
                    { res.send({data:[],error:"Parametrul value trebuie sa fie un numar:"+value});return;}
            }
        else if(field=='hash')
            {
                value="'"+gethash(value)+"'";
            }
        else value="'"+value+"'";
        
        try {
            if(field==='details')
                if(value.toLowerCase().includes("card:"))
                    {   let cardnr = parseInt((value.toLowerCase().split('card:')[1].trim()).split(' ')[0]);// asd card: 60100 sdfsdf=>60100
                        if(isNaN(cardnr) || cardnr<60000 || cardnr>65000)
                            {   res.send({data:[],error:"Seria cardului incorecta(60000-65000):"+cardnr});
                                return;
                            }
                        await newDBPool.query("UPDATE Users SET cardid1='"+(cardnr+Math.pow(2, 16))+"'  WHERE id="+id+";");
                        setAudit(req.auth.id,req.auth.name,"Actualizare card pentru utilizator "+id+".",newDBPool);
                    }
            let sqlclearcache=field=="codays"||field=="colastyear"?"":("UPDATE Settings SET data="+(new Date().getTime())+" WHERE name='syncusersstamp';");

            let result =  await newDBPool.query("UPDATE Users SET "+field+"="+value+",require_update=1  WHERE id="+id+";"+
                "SELECT * FROM Users WHERE id="+id+";"+
                (recalculatename?"UPDATE Users SET name=CONCAT(last_name,' ',first_name)  WHERE id="+id+";":"")+
                sqlclearcache);

            res.send({data:result.recordsets[1],error:""});
            setAudit(req.auth.id,req.auth.name,"Actualizare utilizator "+id+" ("+field+")",newDBPool);
            if(field=='shift')updateshifts(newDBPool,id);

        } catch (err) {
            res.send({data:[],error:err.message});
            logerr(err);

        }
    }
async function api_users_add(req,res,users,settings)
    {   let q = {};
        try {   q = JSON.parse(req.query.newitem);
            }
        catch (error)
            {   logerr(error);
                res.send({data:[],error:"Format invalid adaugare utilizator:"+req.query.newitem});return;
            }
        if(!isparamvalidint(q.matricol))        return res.send({error:"Matricol invalid:"+q.matricol});
        if(!isparamvalidstring(q.last_name))    return res.send({error:"Last_name invalid:"+q.last_name});
        if(!isparamvalidstring(q.first_name))   return res.send({error:"First_name invalid:"+q.first_name});
        if(!isparamvalidint(q.sub_group_id))    return res.send({error:"Subgrupa invalida:"+q.sub_group_id});

        let cardid="";
        let details = "";
        try {
            if(!q.hasOwnProperty('details')&&q.hasOwnProperty('cardid1'))
                {   details="Card:"+(parseInt(q.cardid1) - Math.pow(2, 16));
                    cardid="";
                }
            else if(q.hasOwnProperty('details')&&!q.hasOwnProperty('cardid1'))
                {   details=q.details;
                    if(q.details.toLowerCase().includes('card:'))
                        {   cardid=""+(parseInt(q.details.toLowerCase().split('card:')[1].trim().split(' ')[0])+Math.pow(2, 16));
                            if(!isparamvalidint(cardid))
                                return res.send({error:"card invalid:"+cardid});
                        }
                    else cardid="";
                }
            else if(q.hasOwnProperty('details')&&q.hasOwnProperty('cardid1'))
                {   
                    if(q.details.toLowerCase().includes('card:'))
                        {   details=q.details;
                            cardid=""+(parseInt(q.details.toLowerCase().split('card:')[1].trim().split(' ')[0])+Math.pow(2, 16));
                        }
                    else{   details="Card:"+(parseInt(q.cardid1) - Math.pow(2, 16))+" "+q.details;
                            cardid=q.cardid1;
                        }
                    if(!isparamvalidint(cardid))
                        return res.send({error:"card invalid:"+cardid});
                }
        } catch (error) {
            return res.send({error:"Format incorect:nr card si detalii:"+q.details+" "+q.cardid1+" "+error.message});
        }
        if (cardid.startsWith('0'))
            {   res.send({data:[],error:"Numarul cardului nu poate sa inceapa cu cifra zero"});
                return;
            }
        if(cardid.length>0 && usermapping.cardid.hasOwnProperty(cardid))
            {   res.send({data:[],error:"Acest card (" + cardid + ") aparține deja angajatului "+usermapping.cardid[cardid].name});
                return;
            }
        
        

        if(!isparamvalidint(q.permission_id))q.permission_id="-1";
        if(!isparamvalidint(q.shift))q.shift="-1";

        const query = "INSERT INTO Users(matricol,name,last_name,first_name,cardid1,details,sub_group_id,permission_id,shift) "+
                    "VALUES("+q.matricol+",'"+(q.last_name+' '+q.first_name)+"','"+q.last_name+"','"+q.first_name+"','"+cardid+"','"+details+"','"+q.sub_group_id+"',"+q.permission_id+","+q.shift+");"+
                    "UPDATE Settings SET data="+(new Date().getTime())+" WHERE name='syncusersstamp';"+
                    "SELECT TOP 1 * FROM Users ORDER BY id DESC;";
        try {   let result = await newDBPool.query(query);
                log("[WEB]Registered user:["+q.last_name+" "+q.first_name+"]");
                res.send({data:result.recordsets[0][0],error:""});
                updateshifts(newDBPool,result.recordsets[0][0].id);
                setAudit(req.auth.id,req.auth.name,"Adaugare utilizator "+result.recordsets[0][0].id,newDBPool);
                syncsettings();
            }
        catch (err)
            {   res.send({data:[],error:err.message});
                logerr(err);
            }
    }
async function api_users_import(req,res,users,settings)
    {   let csvcontent = req.body.data;
        if(csvcontent.length<1)
            {   res.send({error:"Nu exista fisier pentru importarea angajatilor"});
                return;
            }
        await syncSubGroups()
        await syncsettings()
        await syncshifts();
        let result =  await processimportuserscsv(csvcontent, settings, users, subGroupMapping, shiftmapping, newDBPool)
        if (result.error.length > 0)
            {   res.send({error:result.error});
                return
            }
        log('[WEB]Inserted '+result.addedusers+' users.');
        log('[WEB]Updated '+result.updatedusers+' users.');
        setAudit(req.auth.id,req.auth.name,"Importare utilizatori: adaugati:"+result.addedusers+", actualizati:"+result.updatedusers,newDBPool);
        updateshifts(newDBPool,-1);
        res.send({added:result.addedusers,updated:result.updatedusers,error:""});
    }

async function api_users_changeSubGroupForAll(req,res) {
        let q = req.query;

        if(!isparamvalidint(q.sub_group_id)) {
            res.send({data:[],error:"Lipseste id-ul subgrupei("+q.sub_group_id+")."});
            return;
        }

        const sql = "UPDATE Users SET sub_group_id = " + q.new_sub_group_id + " WHERE sub_group_id = "+ q.sub_group_id +";"+
                "UPDATE Settings SET data=" + (new Date().getTime()) + " WHERE name='syncusersstamp';";

        try {
            await newDBPool.query(sql);
            setAudit(req.auth.id,req.auth.name,"Transfer toti angajatii din subgrupa "+ q.sub_group_id + " in " + q.new_sub_group_id,newDBPool);
            res.send({error:""});
        }
        catch (err) {
            res.send({error:err.message});
            logerr(err);
        }
    }

//=======================================================================
//=======================================================================VACATIONS API
//=======================================================================

async function api_vac_add(req,res){
    try {
        const item = JSON.parse(req.query.newitem);
        let type = item.type;
        const userid = item.userid;
        const stampstart = item.datestart;
        const stampend = item.dateend;
        let okclockingsql=`SELECT TOP 1 id FROM Vacations WHERE userid= ${userid} AND
            ((datestart-1000*3600*10-1 < ${stampstart} AND dateend+1000*3600*14 > ${stampstart}) OR
            (datestart-1000*3600*10-1 < ${stampend} AND dateend+1000*3600*14 > ${stampend}) OR
            (datestart-1000*3600*10-1 > ${stampstart} AND dateend+1000*3600*14 < ${stampend}))
            ORDER BY dateend DESC;`;
        if(typeof (type) != "number"){
            type = parseInt(type);
        }
        if (vacationsTypeMapping[type].code.split('(')[0] == 'CM') {
            let dateStartVac;
            let dateEndVac;
            if ((typeof (item.datestart) != "number") && (typeof (item.dateend) != "number")) {
                dateStartVac = new Date(parseInt(item.datestart)).getMonth();
                dateEndVac = new Date(parseInt(item.dateend)).getMonth();
            } else {
                dateStartVac = new Date(item.datestart).getMonth();
                 dateEndVac = new Date(item.dateend).getMonth();
            }
            if (dateStartVac == dateEndVac) {
                if (item.datestart <= item.dateend) {
                    let {recordset}=await newDBPool.query(okclockingsql);
                    if (recordset.length > 0) {
                        return 'Nu se poate adauga concediul. Acest concediu se suprapune cu altul.';
                    }
                    return '';
                } else {
                    return 'Data de început trebuie sa fie inainte de data de sfârșit';
                }
            } else {
                return 'CM trebuie sa aibă datele de început/sfârșit în aceeași lună';
            }
        } else if (item.datestart <= item.dateend) {
            let {recordset} = await newDBPool.query(okclockingsql);
            if (recordset.length > 0) {
                return 'Nu se poate adauga concediul. Acest concediu se suprapune cu altul.';
            }
            return '';
        } else {
            return 'Data de început trebuie sa fie inainte de data de sfârșit';
        }
    } catch (error) {
        logerr(error)
        return error.message;
    }
}
async function api_vac_edit(req, res) {
    try {
        const item = req.query;
        let vacationsToBeEdited = {};
        try {
            const queryResult = await newDBPool.query("SELECT * from Vacations WHERE id=" + item.id + ";");
            queryResult.recordset.forEach(elem => {
                vacationsToBeEdited = elem;
            })
        } catch (error) {
            logerr(error)
           return error.message;
        }

        let userid = vacationsToBeEdited.userid
        let vacid = vacationsToBeEdited.id
        let okclockingdatestartsql=`SELECT TOP 1 id FROM Vacations WHERE userid= ${userid} AND id != ${vacid} AND
            ((datestart-1000*3600*10-1 < ${item.value} AND dateend+1000*3600*14 > ${item.value}) OR
            (datestart-1000*3600*10-1 < ${vacationsToBeEdited.dateend} AND dateend+1000*3600*14 > ${vacationsToBeEdited.dateend}) OR
            (datestart-1000*3600*10-1 > ${item.value} AND dateend+1000*3600*14 < ${vacationsToBeEdited.dateend}))
            ORDER BY dateend DESC;`;
        let okclockingdateendtsql=`SELECT TOP 1 id FROM Vacations WHERE userid= ${userid} AND id != ${vacid} AND
            ((datestart-1000*3600*10-1 < ${vacationsToBeEdited.datestart} AND dateend+1000*3600*14 > ${vacationsToBeEdited.datestart}) OR
            (datestart-1000*3600*10-1 < ${item.value} AND dateend+1000*3600*14 > ${item.value}) OR
            (datestart-1000*3600*10-1 > ${vacationsToBeEdited.datestart} AND dateend+1000*3600*14 < ${item.value}))
            ORDER BY dateend DESC;`;

        if (item.field == 'type') {
            if (vacationsTypeMapping[item.value].code.split('(')[0] == 'CM') {
                let dateStartVac;
                let dateEndVac;
                if ((typeof (vacationsToBeEdited.datestart) != "number") && (typeof (vacationsToBeEdited.dateend) != "number")) {
                    dateStartVac = new Date(parseInt(vacationsToBeEdited.datestart)).getMonth();
                    dateEndVac = new Date(parseInt(vacationsToBeEdited.dateend)).getMonth();
                } else {
                    dateStartVac = new Date(vacationsToBeEdited.datestart).getMonth();
                    dateEndVac = new Date(vacationsToBeEdited.dateend).getMonth();
                }
                if (vacationsToBeEdited.datestart <= vacationsToBeEdited.dateend && dateStartVac == dateEndVac) {
                    return '';
                } else {
                    return 'CM trebuie sa aibă datele de început/sfârșit în aceeași lună';
                }
            } else {
                return '';
            }
        } else if (vacationsTypeMapping[vacationsToBeEdited.type].code.split('(')[0] == 'CM') {
            let dateStartVac, dateEndVac;
            if ((typeof (item.value) != "number") && (typeof (vacationsToBeEdited.dateend) != "number")) {
                dateStartVac = new Date(parseInt(item.value)).getMonth();
                dateEndVac = new Date(parseInt(vacationsToBeEdited.dateend)).getMonth();
            } else {
                dateStartVac = new Date(item.value).getMonth();
                dateEndVac = new Date(vacationsToBeEdited.dateend).getMonth();
            }
            if (item.field == 'datestart') {
                if (dateStartVac == dateEndVac) {
                    if (item.value <= vacationsToBeEdited.dateend) {
                        let {recordset} = await newDBPool.query(okclockingdatestartsql);
                            if (recordset.length > 0) {
                                return 'Nu se poate edita concediul. Acest concediu se suprapune cu altul.';
                            }
                        return '';
                    } else {
                        return 'Data de început trebuie sa fie inainte de data de sfârșit';
                    }
                } else {
                    return 'CM trebuie sa aibă datele de început/sfârșit în aceeași lună';
                }
            } else {
                if ((typeof (item.value) != "number") && (typeof (vacationsToBeEdited.dateend) != "number")) {
                    dateStartVac = new Date(parseInt(item.value)).getMonth();
                    dateEndVac = new Date(parseInt(vacationsToBeEdited.dateend)).getMonth();
                } else {
                    dateStartVac = new Date(item.value).getMonth();
                    dateEndVac = new Date(vacationsToBeEdited.dateend).getMonth();
                }
                if (dateStartVac == dateEndVac) {
                    if (vacationsToBeEdited.datestart <= item.value) {
                        let {recordset} = await newDBPool.query(okclockingdateendtsql);
                            if (recordset.length > 0) {
                                return 'Nu se poate edita concediul. Acest concediu se suprapune cu altul.';
                            }
                        return '';
                    } else {
                        return 'Data de început trebuie sa fie inainte de data de sfârșit';
                    }
                } else {
                    return 'CM trebuie sa aibă datele de început/sfârșit în aceeași lună';
                }
            }
        } else if (item.field == 'datestart' && item.value <= vacationsToBeEdited.dateend) {
            let {recordset} = await newDBPool.query(okclockingdatestartsql);
                if (recordset.length > 0) {
                    return 'Nu se poate edita concediul. Acest concediu se suprapune cu altul.';
                }
            return '';
        } else if (item.field == 'dateend' && vacationsToBeEdited.datestart <= item.value) {
            let {recordset} = await newDBPool.query(okclockingdateendtsql);
                if (recordset.length > 0) {
                    return 'Nu se poate edita concediul. Acest concediu se suprapune cu altul.';
                }
            return '';
        } else {
            return 'Data de început trebuie sa fie inainte de data de sfârșit';
        }
    } catch (error) {
        logerr(error)
        return error.message;
    }
}
//=======================================================================
//=======================================================================ACTIVITIES API
//=======================================================================
async function api_activities_for_sg_add(req,res,users)
    {   let q  = req.query;
        if (!isparamvalidint(q.sgID)) { res.send({error: "Subgrupa selectata nu este valida" });    return; }
        if (!isparamvalidint(q.date)) {   res.send({error: "Data selectata nu este valida"}); return; }
        if (!isparamvalidint(q.activityID)) { res.send({error: "Activitatea selectata nu este valida"});  return; }
        if (!isparamvalidint(q.nrOfHours)) {  res.send({error: "Numarul de ore selectat nu este valid"}); return; }
        if (!isparamvalidint(q.halfHour)) { res.send({error: "Parametrul 'jumatate de ora' selectat nu este valid"});   return; }
        let sgID = parseInt(q.sgID);

        if(!isStampValidForActivityEdit(sgID,parseInt(q.date))) {
            res.send({error: "Nu se pot adauga activitati pentru o luna inchisa." });
            return;
        }

        let pieces = [];
        Object.values(users.id).forEach(user =>
            {   if (user.sub_group_id === sgID)
                    pieces.push("("+user.id+","+q.nrOfHours+","+q.halfHour+","+q.activityID+","+q.date+")")
            });
        let sql = "INSERT INTO Activities (userid,hours,hashalfhour,type,stamp) VALUES "+pieces.join(",")+";"
        try {   await newDBPool.query(sql)
                res.send({error:""})
                setAudit(req.auth.id,req.auth.name,"Adaugare activitate.",newDBPool);
            }
        catch (err)
            {   res.send({error: err.message })
                logerr(err);
            }
    }

//=======================================================================
//=======================================================================DEPARTMENTS API
//=======================================================================

async function api_subgroups_import(req, res) {
    let csvcontent = req.body.data;
    if(csvcontent.length < 1) {
        res.send({error: "Nu exista fisier pentru importarea subgrupelor, grupelor si departamentelor."});
        return;
    }

    await syncUnits();
    await syncGroups();
    await syncSubGroups();
    await syncusers();
    let result =  await processImportSubgroupsCSV(csvcontent, subGroupMapping, groupsMapping, unitsMapping, usermapping, newDBPool);
    if (result.error.length > 0) {
        res.send({error: result.error});
        return;
    }
    log('[WEB]Inserted '+ result.subgroups + ' subgroups with ' + result.sgRepresentatives + ' representatives, ' + result.groups + ' groups and ' + result.departments + ' departments.');
    setAudit(req.auth.id,req.auth.name,"Importare subgrupe, grupe, departamente, reprezentanti de subgrupe: adaugate:" + result.subgroups + ', ' + result.groups + ', ' + result.departments + ', ' + result.sgRepresentatives, newDBPool);
    res.send({subgroups: result.subgroups, groups: result.groups, departments: result.departments, sgRepresentatives: result.sgRepresentatives, error: ""});
}

async function api_subGroupsRepresentatives_add(req,res,usermapping)
    {   let q = req.query;
        if(typeof q.newitem != 'string' || !q.newitem.startsWith("{")){ res.send({error:"Lipseste parametrul element nou."});return;}

        try {
            const newitem = JSON.parse(q.newitem);
            const matricol = newitem.matricol;
            const subgroup_id = newitem.sub_group_id;

            let userid = 0;
            if (usermapping.matricol.hasOwnProperty(matricol)) {
                userid = usermapping.matricol[matricol].id
            } else {
                res.send({error:"Nu exista un utilizator cu acest matricol"});
                return
            }
            let sql = "INSERT INTO SubGroupRepresentatives(sub_group_id,user_id) VALUES("+ subgroup_id +","+ userid +");";
            sql += "SELECT TOP 1 id FROM SubGroupRepresentatives ORDER BY id DESC;";
            const result = await newDBPool.query(sql);

            setAudit(req.auth.id,req.auth.name,"Adaugare element in SubGroupRep.: "+result.recordset[0].id+" user:"+userid,newDBPool);
            const returnid = result.recordset[0].id;
            res.send({data:result.rowsAffected,id:returnid,error:""});
        }
    catch (err)
        {   res.send({error:err.message});
            logerr(err);
        }
    }

async function api_get_departmentnames(req, res)
    {
        try {
            res.send({sgdata: config.departHeaderSg,pldata: config.departHeaderPl, error:""})
        } catch (error) {
            res.send({error:err.message});
            logerr(err);
        }
    }
//=======================================================================
//=======================================================================HISTORY API
//=======================================================================
async function api_history_users(req,res)
    {   let q = req.query;
        if(!isparamvalidint(q.month))   { res.send({error:"Parametru month invalid."}); return;}
        if(!isparamvalidint(q.year))    { res.send({error:"Parametru an invalid."}); return;}
        //let date=parseInt(q.year)*100+parseInt(q.month);
        let additionalwhere = " u.deactivated=0 ";
        let m = parseInt(q.month)+1;
        additionalwhere += " AND u.sub_group_id IN (SELECT sc.s"+m+" FROM Subgrschedule sc LEFT JOIN SubGroupRepresentatives rep ON sc.s"+m+"=rep.sub_group_id WHERE rep.user_id = "+req.auth.id+" AND u.id=sc.userid AND sc.year="+q.year+") ";
        // server_api_crud.api_crud_get_join(req,res,newDBPool," AND "," matricol DESC ","u2.id",injectsgrname,
        //     " u2.name name,u2.matricol matricol,sc.*",
        //     " FROM Subgrschedule sc INNER JOIN Users u2 ON sc.userid = u2.id ",
        //     additionalwhere,
        //     [{n:"userid",r:"u2.id",t:'nr'},{n:"username",r:"u2.name",t:'str'},{n:"matricol",r:"u2.matricol",t:'str'},
        //     {n:"locationid",r:"l.id",t:'nr'},{n:"location",r:"l.name",t:'str'},{n:"stamp",r:"s.stamp",t:'date'}]);

        server_api_crud.api_crud_get_join(req,res,newDBPool,req.query.useor=='1'?" OR ":" AND "," u.matricol ASC ","u.id",injectuserdata,
            " u.*,CONCAT(sg.name, '/', sg.key_ref)  depart_name ",
            " FROM Users u LEFT JOIN SubGroups sg on u.sub_group_id = sg.id ",
            additionalwhere,
            [{n:"cardid1",r:"u.cardid1",t:"str"},{n:"matricol",r:"u.matricol",t:"nr"},{n:"searchmatricol",r:"u.matricol",t:"str"},{n:"first_name",r:"u.first_name",t:"str"},{n:"id",r:"u.id",t:"nr"},{n:"userid",r:"u.id",t:"nr"},{n:"depart_name",r:"sg.name",t:"str"},
            {n:"last_name",r:"u.last_name",t:"str"},{n:"name",r:"u.name",t:"str"},{n:"searchdepartment",r:"sg.name",t:"str"},{n:"username",r:"u.username",t:"str"},{n:"sub_group_id",r:"sg.id",t:"nr"}])
    }
async function api_history_reports(req,res)
    {   let q = req.query;
        if(!isparamvalidint(q.month))   { res.send({error:"Parametru month invalid."}); return;}
        if(!isparamvalidint(q.year))    { res.send({error:"Parametru an invalid."}); return;}
        let date = parseInt(q.year)*100+parseInt(q.month);
        let m = parseInt(q.month)+1;
        let additionalwhere = " r.date="+date+"  AND u.deactivated=0 ";
        additionalwhere += " AND u.sub_group_id IN (SELECT sc.s"+m+" FROM Subgrschedule sc LEFT JOIN SubGroupRepresentatives rep ON sc.s"+m+"=rep.sub_group_id WHERE rep.user_id = "+req.auth.id+" AND u.id=sc.userid AND sc.year="+q.year+") ";
        server_api_crud.api_crud_get_join(req,res,newDBPool," AND "," u.matricol DESC ","r.id",(list)=>{list.forEach(elem => {for(let i=1;i<31;i++)elem["d"+i]=processDayDate(elem["d"+i]);});},
            "r.*,u.first_name,u.last_name,u.matricol,sgr.name subgrname,sgr.key_ref",
            " FROM Reports r INNER JOIN Users u on r.userid = u.id LEFT JOIN SubGroups sgr on sgr.id = u.sub_group_id",
            additionalwhere,
            [{n:"userid",r:"u2.id",t:'nr'},{n:"username",r:"u2.name",t:'str'},{n:"matricol",r:"u.matricol",t:'nr'},{n:"first_name",r:"u.first_name",t:"str"},{n:"subgrname",r:"sgr.name",t:"str"},
            {n:"last_name",r:"u.last_name",t:"str"},{n:"locationid",r:"l.id",t:'nr'},{n:"location",r:"l.name",t:'str'},{n:"stamp",r:"s.stamp",t:'date'},{n:"key_ref",r:"sgr.key_ref",t:"str"}])
    }
async function api_history_reports_download(req,res)
    {   let q = req.query;
        if(!isparamvalidint(q.month))   { res.send({error:"Parametru month invalid."}); return;}
        if(!isparamvalidint(q.year))    { res.send({error:"Parametru an invalid."}); return;}
        if(!isparamvalidint(q.userid))    { res.send({error:"Parametru userid invalid."}); return;}
        var userid=q.userid;
        if(!usermapping.id.hasOwnProperty(userid)){ res.send({error:"Utilizatorul nu a fost gasit"}); return;}
        let m = parseInt(q.month)+1;
        var user=usermapping.id[userid];
        if(!req.auth.accesstoallusers)
            {   try {   let result=await newDBPool.query("SELECT s"+m+" as subgr FROM Subgrschedule WHERE userid="+userid);
                        if(result.recordset.length<1){ res.send({error:"Nu ati fost responsabil pentru acest angajat."});return;}
                        let subgr=result.recordset[0].subgr;
                        result=await newDBPool.query("SELECT * FROM SubGroupRepresentatives WHERE user_id="+req.auth.id+" AND sub_group_id="+subgr+";");
                        if(result.recordset.length<1){ res.send({error:"Nu ati fost responsabil pentru aceasta subgrupa."});return;}
                    }
                catch (err)
                    {   res.send({error:err.message});
                        logerr(err);
                        return;
                    }
            }
        q.subgroupid=user.sub_group_id
        q.matricoltype="white";
        q.matricolvalues=user.matricol+"";
        q.start=0;
        q.count=2;
        api_download_pdf_report(req, res)
    }
async function api_history_scans(req,res)
    {   let q = req.query;
        if(!isparamvalidint(q.month))   { res.send({error:"Parametru month invalid."});return;}
        if(!isparamvalidint(q.year))    { res.send({error:"Parametru an invalid."});return;}
        let minstamp = new Date(parseInt(q.year),parseInt(q.month)  ,1,0,0,0).getTime();
        let maxstamp = new Date(parseInt(q.year),parseInt(q.month)+1,0,0,0,0).getTime();
        let m = parseInt(q.month)+1;
        let additionalwhere = " s.stamp>"+minstamp+" AND s.stamp < "+maxstamp+" ";
        additionalwhere += " AND u2.sub_group_id IN (SELECT sc.s"+m+" FROM Subgrschedule sc LEFT JOIN SubGroupRepresentatives rep ON sc.s"+m+"=rep.sub_group_id WHERE rep.user_id = "+req.auth.id+" AND u2.id=sc.userid AND sc.year="+q.year+") ";
        server_api_crud.api_crud_get_join(req,res,newDBPool," AND "," stamp DESC ","s.id",injectscandata,
            " s.id id , s.stamp stamp, u2.name username,u2.id userid, u2.matricol matricol, l.name location, s.[type] type_print , s.inorout inorout_print ",
            " FROM Scans s INNER JOIN Users u2 on u2.id = s.userid LEFT JOIN Locations l on l.id = s.location ",
            additionalwhere,
            [{n:"userid",r:"u2.id",t:'nr'},{n:"username",r:"u2.name",t:'str'},{n:"matricol",r:"u2.matricol",t:'nr'},
            {n:"locationid",r:"l.id",t:'nr'},{n:"location",r:"l.name",t:'str'},{n:"stamp",r:"s.stamp",t:'date'}]);
    }
function injectsgrname(list)
    {   list.forEach((elem)=>
            {   for(let i=1;i<13;i++)
                    if(subGroupMapping.id.hasOwnProperty(elem["s"+i]))
                        {   let sgr=subGroupMapping.id[elem["s"+i]];
                            elem["s"+i]=sgr.name+" "+sgr.key_ref+" "+sgr.id
                        }
            });
    }
function api_history_vac(req,res)
    {   let q = req.query;
        if(!isparamvalidint(q.month))   { res.send({error:"Parametru month invalid."});return;}
        if(!isparamvalidint(q.year))    { res.send({error:"Parametru an invalid."});return;}
        let minstamp = new Date(parseInt(q.year),parseInt(q.month)  ,1,0,0,0).getTime();
        let maxstamp = new Date(parseInt(q.year),parseInt(q.month)+1,0,0,0,0).getTime();
        let m = parseInt(q.month)+1;
        let additionalwhere = " (v.datestart<"+maxstamp+" AND v.dateend > "+minstamp+")  AND u.deactivated=0 ";
        additionalwhere += " AND u.sub_group_id IN (SELECT sc.s"+m+" FROM Subgrschedule sc LEFT JOIN SubGroupRepresentatives rep ON sc.s"+m+"=rep.sub_group_id WHERE rep.user_id = "+req.auth.id+" AND u.id=sc.userid AND sc.year="+q.year+") ";
        server_api_crud.api_crud_get_join(req,res,newDBPool," AND "," v.datestart DESC ","v.id",null,
            " t.vacationtype typename, v.*, u.name, u.matricol ",
            " FROM Vacations v INNER JOIN Users u ON v.userid=u.id LEFT JOIN Vacationtypes t ON v.type=t.id ",
            additionalwhere,
            [{n:"userid",r:"u.id",t:'nr'},{n:"name",r:"u.name",t:'str'},{n:"type",r:"t.vacationtype",t:'str'},{n:"typename",r:"t.vacationtype",t:'str'},{n:"matricol",r:"u.matricol",t:'nr'},{n:"id",r:"v.id",t:'nr'},{n:"vacationid",r:"v.id",t:'nr'},{n:"datestart",r:"v.datestart",t:'date'},{n:"dateend",r:"v.dateend",t:'date'}])
    }
function api_history_activ(req,res)
    {   let q = req.query;
        if(!isparamvalidint(q.month))   { res.send({error:"Parametru month invalid."});return;}
        if(!isparamvalidint(q.year))    { res.send({error:"Parametru an invalid."});return;}
        let minstamp = new Date(parseInt(q.year),parseInt(q.month)  ,1,0,0,0).getTime();
        let maxstamp = new Date(parseInt(q.year),parseInt(q.month)+1,0,0,0,0).getTime();
        let m = parseInt(q.month)+1;
        let additionalwhere = " a.stamp>"+minstamp+" AND a.stamp < "+maxstamp+" AND u.deactivated=0 ";
        additionalwhere += " AND u.sub_group_id IN (SELECT sc.s"+m+" FROM Subgrschedule sc LEFT JOIN SubGroupRepresentatives rep ON sc.s"+m+"=rep.sub_group_id WHERE rep.user_id = "+req.auth.id+" AND u.id=sc.userid AND sc.year="+q.year+") ";
        server_api_crud.api_crud_get_join(req,res,newDBPool," AND "," a.stamp DESC ","a.id", (list)=>{list.forEach(elem => elem.hours=elem.hours+(elem.hashalfhour==1?":30":":00"));},
            " a.*, t.name as activityname, u.name, u.matricol ",
            " FROM Activities a LEFT JOIN Activitytypes t ON a.type=t.slot INNER JOIN Users u ON a.userid=u.id ",
            additionalwhere,
            [{n:"userid",r:"u.id",t:'nr'},{n:"name",r:"u.name",t:'str'},{n:"matricol",r:"u.matricol",t:'nr'},{n:"type",r:"t.name",t:'str'},{n:"activitiesid",r:"a.id",t:'nr'},
            {n:"activityname",r:"t.name",t:'str'},{n:"id",r:"a.id",t:'nr'},{n:"idtype",r:"t.slot",t:'nr'},{n:"stamp",r:"a.stamp",t:'date'}])
    }
async function api_history_subgr(req,res)
    {   let q = req.query;
        if(!isparamvalidint(q.month))   { res.send({error:"Parametru month invalid."});return;}
        if(!isparamvalidint(q.year))    { res.send({error:"Parametru an invalid."});return;}
        let additionalwhere = " sc.year="+q.year+" AND u2.deactivated=0 ";
        let m = parseInt(q.month)+1;
        additionalwhere += " AND u2.sub_group_id IN (SELECT sc.s"+m+" FROM SubGroupRepresentatives rep WHERE rep.user_id = "+req.auth.id+" AND sc.s"+m+"=rep.sub_group_id AND u2.id=sc.userid) ";
        server_api_crud.api_crud_get_join(req,res,newDBPool," AND "," matricol DESC ","u2.id",injectsgrname,
            " u2.name name,u2.matricol matricol,sc.*",
            " FROM Subgrschedule sc INNER JOIN Users u2 ON sc.userid = u2.id ",
            additionalwhere,
            [{n:"userid",r:"u2.id",t:'nr'},{n:"username",r:"u2.name",t:'str'},{n:"matricol",r:"u2.matricol",t:'nr'},
            {n:"locationid",r:"l.id",t:'nr'},{n:"location",r:"l.name",t:'str'},{n:"stamp",r:"s.stamp",t:'date'}]);
    }
//=======================================================================
//=======================================================================REPORTS API
//=======================================================================
async function api_reports_get(req,res,users,settings)
    {   let q = req.query;

        let month=-1,year=-1,sgID=-1;
        if(isparamvalidint(q.subGroupIdReport)) sgID = parseInt(q.subGroupIdReport);
        if(isparamvalidint(q.month)) month = parseInt(q.month);
        if(isparamvalidint(q.year)) year = parseInt(q.year);
        if(year==-1||month==-1)
            {   year = new Date().getFullYear();
                month = new Date().getMonth()-1;
            }
        if(month<0) {month=11; year--;}

        try {   let result = await downloadreports(q, req.auth, year, month, sgID);

                res.send({data:result.recordsets[0], year:year,month:month,error:"",
                    count:result.recordsets[3][0].count, holidays:result.recordsets[2],
                    middleofmonth:settings.monthmiddledate,
                    vacationtypes:result.recordsets[4],
                    activitytypes:result.recordsets[6]
                });
                return;
            }
        catch (error)
            {   res.send({error:typeof error=='string'?error:error.message})
                return;
            }
    }
async function api_reportsmeta_get(req,res,users,settings)
    {   let q = req.query;
        let filter={};
        try {  filter = JSON.parse(q.filter) } catch (error) { filter={}}

        let month=-1,year=-1,subgroupid=-1, total="", ballance="", unifier = "", lateEmployeeComparator = "";

        if(isparamvalidint(filter.subgroupid)) subgroupid = parseInt(filter.subgroupid);
        if(isparamvalidint(filter.month)) month = parseInt(filter.month);
        if(isparamvalidint(filter.year)) year = parseInt(filter.year);
        if(isparamvalidstring(filter.total)) total = filter.total;
        if(isparamvalidstring(filter.ballance)) ballance = filter.ballance;
        if(isparamvalidstring(filter.unifier)) unifier = filter.unifier;
        if(isparamvalidstring(filter.lateEmployeeComparator)) lateEmployeeComparator = filter.lateEmployeeComparator;
        if(!isparamvalidstring(q.orderby)) q.orderby="matricol";
        if(!isparamvalidint(q.start)) q.start=0;
        if(!isparamvalidint(q.count)) q.count=10;

        if(year==-1||month==-1)
            {   year = new Date().getFullYear();
                month = new Date().getMonth()-1;
            }
        if(month<0){month=11;year--;}

        try {
            let wherepieces = buildwhere(q.filter," AND ",[{n:"matricol",r:"u.matricol",t:"nr"},{n:"firstName",r:"u.first_name",t:"str"},
                                                        {n:"lastName",r:"u.last_name",t:"str"},{n:"sgName",r:"sg.name",t:"str"},{n:"generatedat",r:"r.generatedat",t:"datetime"}]);

            if(unifier !== "AND" && unifier !== "OR") {
                res.send({error: "Unificator invalid (diferit de SI/SAU)."})
                return;
            }
            let totalBalanceTemp = [];
            if(total !== "")
                totalBalanceTemp.push("total " + total);
            if(ballance !== "")
                totalBalanceTemp.push("ballance " + ballance);
            let totalBalanceString = totalBalanceTemp.join(" " + unifier + " ");
            if(totalBalanceString.includes("OR")) {
                totalBalanceString = "(" + totalBalanceString + ")";
            }
            if(totalBalanceString !== "")
                wherepieces.push(totalBalanceString);
            if(lateEmployeeComparator !== "")
                wherepieces.push("numOfLateDays " + lateEmployeeComparator);
            if(!req.auth.accesstoallusers)
                wherepieces.push("r.userid IN ((SELECT u.id FROM Users u WHERE u.sub_group_id IN "+
                                "(SELECT sgr.sub_group_id FROM SubGroupRepresentatives sgr WHERE sgr.user_id = "+req.auth.id+")))");
            wherepieces.push("r.date="+(year*100+month))
            if (subgroupid != -1)
                wherepieces.push("sg.id="+subgroupid)

            const where = "WHERE "+(wherepieces.join(" AND "));
            const pagination = "ORDER BY "+q.orderby+" OFFSET "+q.start+" ROWS FETCH NEXT "+q.count+" ROWS ONLY";

            const sql = `SELECT r.*, u.matricol, u.first_name firstName, u.last_name lastName, u.sub_group_id subGroupId, sg.name sgName, sg.key_ref sgkeyref FROM Reports_meta r
                        INNER JOIN Users u on r.userid = u.id LEFT JOIN SubGroups sg ON u.sub_group_id = sg.id ${where}  ${pagination} ;
                    SELECT * from Holidays WHERE stamp>${new Date(year,month,1).getTime()} AND stamp<${new Date(year,month+1,1).getTime()};
                    SELECT COUNT(r.id) as count FROM Reports_meta r
                        INNER JOIN Users u on r.userid = u.id LEFT JOIN SubGroups sg  ON u.sub_group_id = sg.id  ${where};`
                    
            const result = await newDBPool.query(sql);

            result.recordsets[0].forEach(elem => {
                elem["totalhours"]=Math.round(parseInt(elem['total'])/60)
                elem["ballancehours"]=Math.round(parseInt(elem['ballance'])/60)
                for(let i=1;i<32;i++)
                    elem["a"+i]=formathour(parseInt(elem["a"+i]));
            });

            if (typeof q.format !== 'undefined') {
                filterData(result.recordset,q.fields, q.names);
            } 
            //else 
            if(q.format ==  'xlsx') {
                processXLSX(result.recordset, res)
            } else if(q.format == 'csv' || q.format == 'txt') {
                processCSV(result.recordset, res)
            } else {
                res.send({data:result.recordsets[0], year:year,month:month,error:"",
                    count:result.recordsets[2][0].count,
                    holidays:result.recordsets[1],
                    middleofmonth:settings.monthmiddledate
                });
            }
                return;
        }
        catch (error) {
            res.send({error:typeof error=='string'?error:error.message})
            return;
        }
    }

async function downloadreports(q,auth,year,month,sgID)//q=query
    {
        if(!isparamvalidstring(q.orderby))  q.orderby="matricol";
        if(!isparamvalidint(q.start))   q.start=0;
        if(!isparamvalidint(q.count))   q.count=10;
        const REPORTS_TABLE = q.type === "ore suplimentare" ? "Reports_meta" : "Reports";

        if(typeof year=='string')   year = parseInt(year);
        if(typeof month=='string')  month = parseInt(month);
        if(typeof year!=='number')  throw new Error("Anul nu este definit.")
        if(typeof month!=='number') throw new Error("Luna nu este definita.")

        let searchQuery = []
        const verifyparams = [{n:"matricol",r:"u.matricol",t:"nr"},{n:"firstName",r:"u.first_name",t:"str"},{n:"subgroupid",r:"u.sub_group_id",t:"nr"},
                            {n:"lastName",r:"u.last_name",t:"str"},{n:"subGroup",r:"sg.name",t:"str"},{n:"userid",r:"r.userid",t:"nr"}];
        verifyparams.forEach((elem)=>
            {   if(q.hasOwnProperty(elem.n))
                    if(elem.t=='str'&&isparamvalidstring(q[elem.n]))
                        searchQuery.push(elem.r+" LIKE '%"+q[elem.n]+"%'");
                    else if(elem.t=='nr'&&isparamvalidint(q[elem.n]))
                        searchQuery.push(elem.r+" ="+q[elem.n]+"");
            });
        if(!auth.accesstoallusers)
            searchQuery.push("r.userid IN ((SELECT u.id FROM Users u WHERE u.sub_group_id IN "+
                            "(SELECT sgr.sub_group_id FROM SubGroupRepresentatives sgr WHERE sgr.user_id = "+auth.id+")))");
        searchQuery.push("r.date="+(year*100+month))
        if (sgID != -1) searchQuery.push("sg.id="+sgID);

        const stampstart = new Date(year,month,1).getTime();
        const stampend = new Date(year,month+1,1).getTime();

        const where = "WHERE "+(searchQuery.join(" AND "));
        const pagination = "ORDER BY "+q.orderby+" OFFSET "+q.start+" ROWS FETCH NEXT "+q.count+" ROWS ONLY";
        
        const graficSQL = q.type === "grafic" ? 
                        (`SELECT s.* from ShiftSchedule s INNER JOIN Users u ON s.userid = u.id WHERE u.sub_group_id = ${sgID} AND s.datestart-100<${stampend} AND s.dateend+100>${stampstart};
                        SELECT * from Shifts;
                        SELECT v.* from Vacations v INNER JOIN Users u ON v.userid = u.id WHERE v.datestart-100<${stampend} AND v.dateend+100>${stampstart};`)
                        : "";

        const sql = `SELECT r.*, u.matricol,u.shift, u.first_name firstName, u.last_name lastName, u.sub_group_id subGroupId, sg.name sgName, sg.key_ref sgkeyref FROM ${REPORTS_TABLE} r
                        INNER JOIN Users u on r.userid = u.id LEFT JOIN SubGroups sg ON u.sub_group_id = sg.id ${where}  ${pagination} ;
                    SELECT TOP 1 stamp FROM Scans ORDER BY id ASC;
                    SELECT * from Holidays WHERE stamp>${stampstart} AND stamp<${stampend};
                    SELECT COUNT(r.id) as count FROM ${REPORTS_TABLE} r INNER JOIN Users u on r.userid = u.id LEFT JOIN SubGroups sg  ON u.sub_group_id = sg.id  ${where};
                    SELECT * FROM Vacationtypes;
                    SELECT * FROM SubGroups WHERE id =${sgID};
                    SELECT * FROM Activitytypes WHERE name <> '';
                    SELECT u.* FROM SubGroups s LEFT JOIN Groups g on s.group_id=g.id LEFT JOIN Units u ON g.unit_id=u.id WHERE s.id =${sgID};
                    ${graficSQL}`

        try {   const result = await newDBPool.query(sql);
                return result;
            }
        catch (error)
            {   logerr(sql);
                throw error;
            }
    }
async function downloadreports_coyear(auth,year,month,sgID)
    {   if(typeof year=='string')   year = parseInt(year);
        if(typeof month=='string')  month = parseInt(month);
        if(typeof year!=='number'||isNaN(year))  throw new Error("Anul nu este definit.");
        if(typeof month!=='number'||isNaN(month)) throw new Error("Luna nu este definita.");

        let searchQuery=[];
        if(!auth.accesstoallusers)
            searchQuery.push("r.userid IN ((SELECT u.id FROM Users u WHERE u.sub_group_id IN "+
                            "(SELECT sgr.sub_group_id FROM SubGroupRepresentatives sgr WHERE sgr.user_id = "+auth.id+")))");
        searchQuery.push(" (r.date>="+(year*100)+" AND r.date<"+(year*100+12)+")");
        
        if (sgID != -1) searchQuery.push("sg.id="+sgID);

        const where = "WHERE "+(searchQuery.join(" AND "));
        const pagination = "ORDER BY u.name ";//no pagination needed :(

        let sql="SELECT r.co,r.date,r.userid,u.matricol,u.colastyear FROM Reports r INNER JOIN Users u ON r.userid = u.id "+
                    "LEFT JOIN SubGroups sg ON u.sub_group_id = sg.id "+where+" "+pagination+";"+
                "SELECT name FROM SubGroups WHERE id="+sgID+";";
        try {   const result = await newDBPool.query(sql);
                return result;
            }
        catch (error)
            {   logerr(sql);
                throw error;
            }
    }
async function downloadreports_overtime(auth,year,month,sgID)
    {   if(typeof year=='string')   year = parseInt(year);
        if(typeof month=='string')  month = parseInt(month);
        if(typeof year!=='number'||isNaN(year))  throw new Error("Anul nu este definit.");
        if(typeof month!=='number'||isNaN(month)) throw new Error("Luna nu este definita.");

        let searchQuery=[];
        if(!auth.accesstoallusers)
            searchQuery.push("r.userid IN ((SELECT u.id FROM Users u WHERE u.sub_group_id IN "+
                            "(SELECT sgr.sub_group_id FROM SubGroupRepresentatives sgr WHERE sgr.user_id = "+auth.id+")))");
        searchQuery.push("r.date="+(year*100+month));
        
        if (sgID != -1) searchQuery.push("sg.id="+sgID);

        const where = "WHERE "+(searchQuery.join(" AND "));
        const pagination = "ORDER BY u.name ";//no pagination needed :(

        let sql="SELECT r.overtimetotal,r.overtime1last,r.overtime2last,r.overtime3last,r.overtimeapproved,r.overtimebefore3m,u.matricol,u.name FROM Reports r INNER JOIN Users u ON r.userid = u.id "+
                    "LEFT JOIN SubGroups sg ON u.sub_group_id = sg.id "+where+" "+pagination+";"+
                "SELECT s.name sgname,s.key_ref sgkeyref,g.name gname,g.key_ref gkeyref,u.name uname FROM SubGroups s LEFT JOIN Groups g on s.group_id=g.id LEFT JOIN Units u ON g.unit_id=u.id WHERE s.id ="+sgID+";";
        try {   const result = await newDBPool.query(sql);
                for(let i=0;i<result.recordset.length;i++)
                result.recordset.forEach(elem => {
                    elem.totallast3=elem.overtime1last+elem.overtime2last+elem.overtime3last;
                });
                return result;
            }
        catch (error)
            {   logerr(sql);
                throw error;
            }
    }
async function downloadReportsCondica(q,auth,year,month,sgID)//q=query
    {
        if(!isparamvalidstring(q.orderby))  q.orderby="matricol";
        if(!isparamvalidint(q.start))   q.start=0;
        if(!isparamvalidint(q.count))   q.count=10;

        if(typeof year=='string')   year = parseInt(year);
        if(typeof month=='string')  month = parseInt(month);
        if(typeof year!=='number')  throw new Error("Anul nu este definit.")
        if(typeof month!=='number') throw new Error("Luna nu este definita.")

        let searchQuery = []
        const verifyparams = [{n:"matricol",r:"u.matricol",t:"nr"},{n:"firstName",r:"u.first_name",t:"str"},{n:"subgroupid",r:"u.sub_group_id",t:"nr"},
                            {n:"lastName",r:"u.last_name",t:"str"},{n:"subGroup",r:"sg.name",t:"str"},{n:"userid",r:"s.userid",t:"nr"}];
        verifyparams.forEach((elem)=>
            {   if(q.hasOwnProperty(elem.n))
                    if(elem.t=='str'&&isparamvalidstring(q[elem.n]))
                        searchQuery.push(elem.r+" LIKE '%"+q[elem.n]+"%'");
                    else if(elem.t=='nr'&&isparamvalidint(q[elem.n]))
                        searchQuery.push(elem.r+" ="+q[elem.n]+"");
            });
        if(!auth.accesstoallusers)
            searchQuery.push("s.userid IN ((SELECT u.id FROM Users u WHERE u.sub_group_id IN "+
                            "(SELECT sgr.sub_group_id FROM SubGroupRepresentatives sgr WHERE sgr.user_id = "+auth.id+")))");
        
        if (sgID != -1) searchQuery.push("sg.id="+sgID);

        const stampstart = new Date(year,month,1).getTime();
        const stampend = new Date(year,month+1,1).getTime();

        searchQuery.push(`s.stamp > ${stampstart} AND s.stamp < ${stampend}`);

        const where = "WHERE "+(searchQuery.join(" AND "));
        const pagination = "ORDER BY "+q.orderby+", s.stamp OFFSET "+q.start+" ROWS FETCH NEXT "+q.count+" ROWS ONLY";

        const sql = `SELECT s.stamp, s.inorout, s.userid, u.matricol, u.first_name firstName, u.last_name lastName, u.sub_group_id subGroupId, sg.name sgName, sg.key_ref sgkeyref FROM Scans s
                        INNER JOIN Users u on s.userid = u.id LEFT JOIN SubGroups sg ON u.sub_group_id = sg.id ${where}  ${pagination} ;
                    SELECT TOP 1 stamp FROM Scans ORDER BY id ASC;
                    SELECT * from Holidays WHERE stamp>${stampstart} AND stamp<${stampend};
                    SELECT TOP 1 stamp FROM Scans ORDER BY id ASC;
                    SELECT * FROM Vacationtypes;
                    SELECT * FROM SubGroups WHERE id =${sgID};
                    SELECT * FROM Activitytypes WHERE name <> '';
                    SELECT u.* FROM SubGroups s LEFT JOIN Groups g on s.group_id=g.id LEFT JOIN Units u ON g.unit_id=u.id WHERE s.id =${sgID}
                    SELECT v.* from Vacations v INNER JOIN Users u ON v.userid = u.id WHERE v.datestart-100<${stampend} AND v.dateend+100>${stampstart};`;

        try {   const result = await newDBPool.query(sql);
                return result;
            }
        catch (error)
            {   logerr(sql);
                throw error;
            }
    }

async function downloadDeszapezire(q, auth,year,month,sgID) {

    if(!isparamvalidstring(q.orderby))  q.orderby="matricol";
    if(!isparamvalidint(q.start))   q.start=0;
    if(!isparamvalidint(q.count))   q.count=10;

    if(typeof year=='string')   year = parseInt(year);
    if(typeof month=='string')  month = parseInt(month);
    if(typeof year!=='number')  throw new Error("Anul nu este definit.")
    if(typeof month!=='number') throw new Error("Luna nu este definita.")

    let searchQuery = []
    const verifyparams = [{n:"matricol",r:"u.matricol",t:"nr"},{n:"firstName",r:"u.first_name",t:"str"},{n:"subgroupid",r:"u.sub_group_id",t:"nr"},
                        {n:"lastName",r:"u.last_name",t:"str"},{n:"subGroup",r:"sg.name",t:"str"},{n:"userid",r:"r.userid",t:"nr"}];
    verifyparams.forEach((elem)=> {   
        if(q.hasOwnProperty(elem.n))
            if(elem.t=='str'&&isparamvalidstring(q[elem.n]))
                searchQuery.push(elem.r+" LIKE '%"+q[elem.n]+"%'");
            else if(elem.t=='nr'&&isparamvalidint(q[elem.n]))
                searchQuery.push(elem.r+" ="+q[elem.n]+"");
    });
    
    if(!auth.accesstoallusers)
        searchQuery.push("r.userid IN ((SELECT u.id FROM Users u WHERE u.sub_group_id IN "+
                        "(SELECT sgr.sub_group_id FROM SubGroupRepresentatives sgr WHERE sgr.user_id = "+auth.id+")))");
    
    searchQuery.push("r.date="+(year*100+month));
    
    if (sgID != -1) 
        searchQuery.push("sg.id="+sgID);

    const stampstart = new Date(year,month,1).getTime();
    const stampend = new Date(year,month+1,1).getTime();

    const where = "WHERE "+(searchQuery.join(" AND "));
    const pagination = "ORDER BY "+q.orderby+" OFFSET "+q.start+" ROWS FETCH NEXT "+q.count+" ROWS ONLY";

    const sql = `SELECT r.*, u.matricol,u.shift, u.first_name firstName, u.last_name lastName, u.sub_group_id subGroupId, sg.name sgName, sg.key_ref sgkeyref FROM Reports r
                    INNER JOIN Users u on r.userid = u.id LEFT JOIN SubGroups sg ON u.sub_group_id = sg.id ${where}  ${pagination} ;
                SELECT * from Holidays WHERE stamp>${stampstart} AND stamp<${stampend};
                SELECT * FROM Vacationtypes;
                SELECT s.* from ShiftSchedule s INNER JOIN Users u ON s.userid = u.id WHERE u.sub_group_id = ${sgID} AND s.datestart-100<${stampend} AND s.dateend+100>${stampstart};
                SELECT * from Shifts;
                SELECT v.* from Vacations v INNER JOIN Users u ON v.userid = u.id WHERE v.datestart-100<${stampend} AND v.dateend+100>${stampstart};
                SELECT * FROM Activitytypes WHERE name <> '';
                SELECT * FROM SubGroups WHERE id =${sgID};`
    try {   
        const result = await newDBPool.query(sql);
        return result;
    } catch (error) {   
        logerr(sql);
        throw error;
    }
}

async function api_reports_generate_all(req,res,users,settings)
    {   if(!isparamvalidint(req.query.month))   { res.send({error:"Parametru luna invalid."});return;  }
        if(!isparamvalidint(req.query.year))    { res.send({error:"Parametru year invalid."});return;  }

        const year = parseInt(req.query.year), month = parseInt(req.query.month);

        try {   const result = await newDBPool.query("SELECT * from SubGroups;");
                let generatedcount=0;
                let lockedPath = config.systemClockingLockedPath+""+year+"\\"+(("0"+((month+1).toString())).slice(-2))+"\\";
                for(let i=0;i<result.recordsets[0].length;i++)
                    {   let subgr=result.recordsets[0][i];
                        if(subgr.name.toLowerCase().includes('transfer'))continue;
                        const filename=subgr.key_ref.split("-").reverse().join("-")+"_L.lock";
                        if(!fs.existsSync(lockedPath+filename))
                            {   await generatereport(year,month,users.id,newDBPool,subgr.id);
                                // log("[TSK]Report for "+year+"/"+month+"/"+subgr.key_ref+" GENERATED!");
                                generatedcount++;
                            }    
                    }
                //await generatereport(year,month,users.id,newDBPool,-1);
                res.send({error:"",count:generatedcount});
                setAudit(req.auth.id,req.auth.name,"Generare raport "+year+" "+month,newDBPool);
            }
        catch (err) {   res.send({error:err.message});
                        logerr(err);
                    }
    }
async function api_reports_generate_subgroup(req,res,users,settings)
    {   if(!isparamvalidint(req.query.month))   { res.send({error:"Parametru luna invalid."});return;  }
        if(!isparamvalidint(req.query.year))    { res.send({error:"Parametru year invalid."});return;  }
        if(!isparamvalidint(req.query.subgroup_id)) { res.send({error:"Parametru subgroup_id invalid."});return;  }

        const year = parseInt(req.query.year), month = parseInt(req.query.month), subgroupid = parseInt(req.query.subgroup_id);

        if(!subGroupMapping.id.hasOwnProperty(subgroupid))
            return res.send({error: "Nu s-a gasit subgrupa selectata." });

        let subgr=subGroupMapping.id[subgroupid];
        let lockedPath = config.systemClockingLockedPath+""+year+"\\"+(("0"+((month+1).toString())).slice(-2))+"\\";
        const filename=subgr.key_ref.split("-").reverse().join("-")+"_L.lock";
        if(fs.existsSync(lockedPath+filename))
            return res.send({error: "Nu se poate genera un raport pentru o luna finalizata." });

        if(!isMonthValidForReport(subgroupid,month))
            return res.send({error: "Nu se poate exporta raportul pentru o luna incheiata." });

        try {   await generatereport(year,month,users.id,newDBPool,subgroupid);
                res.send({error:""});
                setAudit(req.auth.id,req.auth.name,"Generare raport "+year+" "+month,newDBPool);
            }
        catch (err) {   res.send({error:err.message});
                        logerr(err);
                    }
    }
async function api_download_pdf_report(req, res)
    {
        //const hasEditReportPermission = await getEditReportPermission(req.auth.userref.permission_id, newDBPool);
        const XLSX_REPORT_TYPES = ["xlsx", "prezenta", "concedii", "grafic", "deszapezire", "coyear"];
        let q = req.query;
        if(!isparamvalidint(q.month))   {res.send({error:"Parametru luna invalid."});return;  }
        if(!isparamvalidint(q.year))    { res.send({error:"Parametru an invalid."});  return;  }
        if(!isparamvalidint(q.subgroupid))  { res.send({error:"Parametru subgroupid invalid."});  return;  }
        let subgroupid = parseInt(q.subgroupid);
        if(!subGroupMapping.id.hasOwnProperty(subgroupid))  { res.send({error:"Subgrupa nu a putut fi gasita."});  return;  }
        let year = parseInt(q.year);
        let month = parseInt(q.month);
        
        // let date = new Date(q.date).setDate(1)
        try {   let gentime =-new Date().getTime();
                let result;
                if (q.type === "prezenta") {
                    result = await downloadReportsCondica(q, req.auth, year, month, subgroupid);
                    if(result.recordsets[5].length==0){ res.send({error:"Subgrupa nu a putut fi gasita."});  return;  }
                    let filtererror = filtermatricols(result.recordsets[0],q.matricoltype, q.matricolvalues);
                    if(filtererror.length>0){ res.send({error:filtererror});  return;  }
                } else if (q.type === "ore suplimentare") {
                    
                } else  {
                    result = await downloadreports(q, req.auth, year, month,subgroupid);
                    if(result.recordsets[5].length==0){ res.send({error:"Subgrupa nu a putut fi gasita."});  return;  }
                    let filtererror = filtermatricols(result.recordsets[0],q.matricoltype, q.matricolvalues);
                    if(filtererror.length>0){ res.send({error:filtererror});  return;  }
                } 
                
                if (q.type == "print"||q.type == "pdf")
                    {   let printtitle = "Pontajul pentru anul "+year+", luna "+monthnames[month]+"  ---"+(q.usefullmonth==1?"LICHIDARE":"AVANS");
                        let htmlcode = generatehtmlreport(q.usefullmonth==1,year,month,result.recordsets[0],result.recordsets[4],result.recordsets[6],result.recordsets[5][0],
                                                            [q.suffix1,q.suffix2,q.suffix3,q.suffix4,q.suffix5],printtitle);
                        gentime += new Date().getTime();
                        if (q.type == "print")
                            {   res.send({data:htmlcode,error:"",gentime:gentime})
                                return;
                            }
                        generatePDFreportFromHTML(htmlcode, (generatedpdf => {
                            if(generatedpdf.hasOwnProperty('error'))
                                {   res.send({error:generatedpdf.error});
                                    return;
                                }
                            res.send({error:"",gentime:gentime+generatedpdf.time,data:generatedpdf.filebytes});
                        }));
                        return;
                    }
                else if(q.type=='csv')
                    {   let csvreport = generatecsvreport(q.usefullmonth==1,year,month,result.recordsets[0],result.recordsets[4],result.recordsets[6],result.recordsets[5][0]);
                        gentime += new Date().getTime();
                        return res.send({error:"",data:csvreport,gentime:gentime});
                    }
                else if(XLSX_REPORT_TYPES.includes(q.type)) {
                    let xlsxBytes;
                    let groupdata = {name:"",key_ref:""};
                    if(result.recordsets[5].length>0&&groupsMapping.hasOwnProperty(result.recordsets[5][0].group_id)) {
                        groupdata = groupsMapping[result.recordsets[5][0].group_id];
                    }
                    let unitdata = {name:""};
                    if(result.recordsets[7].length>0) {
                        unitdata = result.recordsets[7][0];
                    }
                    if (q.type === "xlsx") {
                        const DNTM = await calculateDNTM(year, month, newDBPool);
                        let {valid,lockedPath,filenamelock} = checkparamsfinalize(req,res,true)
                        if (!valid) {
                            return;
                        }
                        const unfinishedReport = fs.existsSync(lockedPath + filenamelock) ?  "" : "Raport temporar, luna nu a fost finalizata";
                        xlsxBytes = await generatexlsxreport(year,month,result.recordsets[0],result.recordsets[4],result.recordsets[6],result.recordsets[5][0],groupdata,unitdata,[q.suffix1,q.suffix2,q.suffix3,q.suffix4,q.suffix5], DNTM, unfinishedReport,"xcelltemplate.json",q.usefullmonth==1);
                        if (req.auth.candownloadrawreports) {
                            gentime += new Date().getTime();
                            return res.send({error:"", data:xlsxBytes.toString('base64'), gentime:gentime, extension: "xlsx"});
                        } else {
                            let pdfBytes;
                            try {
                                pdfBytes = convertExcelToPdf(xlsxBytes);
                            } catch(error) {
                                return res.send({error: "Nu s-a putut genera pdf-ul:"+error.message, data: "", gentime: 0, extension: ""});
                            }
                            gentime += new Date().getTime();
                            return res.send({error: "", data: pdfBytes, gentime: gentime, extension: "pdf"});
                        }
                    } else if (q.type === "grafic") {
                        const sortedShifts = processShifts(year, month, result.recordsets[0], subgroupid, result.recordsets[8], result.recordsets[9], result.recordsets[2], result.recordsets[10], result.recordsets[4]);
                        const DNTM = await calculateDNTM(year, month, newDBPool);
                        xlsxBytes = await generateGraficLucru(year,month,result.recordsets[0], sortedShifts, result.recordsets[4],result.recordsets[6],result.recordsets[5][0],groupdata,unitdata,[q.suffix1,q.suffix2,q.suffix3,q.suffix4,q.suffix5], DNTM);
                    } else if (q.type === "prezenta") {
                        const usersWithScans = processCondicaScans(year, month, result.recordsets[0], result.recordsets[2], result.recordsets[8], result.recordsets[4]);
                        xlsxBytes = await generateClockingFile(year,month,usersWithScans,result.recordsets[4],result.recordsets[6],result.recordsets[5][0],groupdata,unitdata,gentime,res,[q.suffix1,q.suffix2,q.suffix3,q.suffix4,q.suffix5], q.type);
                    } else if(q.type=="coyear") {   
                        let coresult=await downloadreports_coyear(req.auth, year, month,subgroupid);
                        if(coresult.recordsets[1].length==0){ res.send({error:"Subgrupa nu a putut fi gasita."});  return;  }
                        let filtererror = filtermatricols(coresult.recordsets[0],q.matricoltype, q.matricolvalues);
                        if(filtererror.length>0){ res.send({error:filtererror});  return;  }

                        xlsxBytes = await generateReportCoYear(coresult.recordsets[0],coresult.recordsets[1][0].name,month,year,res,[q.suffix1,q.suffix2,q.suffix3,q.suffix4,q.suffix5],usermapping.id,gentime);
                    } else if (q.type === "deszapezire") {
                        result = await downloadDeszapezire(q, req.auth, year, month, subgroupid);
                        const sortedShifts = processShifts(year, month, result.recordsets[0], subgroupid, result.recordsets[3], result.recordsets[4], result.recordsets[1], result.recordsets[5], result.recordsets[2]);
                        xlsxBytes = await generateRaportDeszapezire(year,month,result.recordsets[0], sortedShifts, result.recordsets[5],result.recordsets[6],result.recordsets[7][0],[q.suffix1,q.suffix2,q.suffix3,q.suffix4,q.suffix5]);
                    } else { 
                        xlsxBytes = await generateClockingFile(year,month,result.recordsets[0],result.recordsets[4],result.recordsets[6],result.recordsets[5][0],groupdata,unitdata,gentime,res,[q.suffix1,q.suffix2,q.suffix3,q.suffix4,q.suffix5], q.type);
                    }

                    gentime += new Date().getTime();
                    return res.send({error:"", data:xlsxBytes.toString('base64'), gentime:gentime, extension: "xlsx"});
                } else if(q.type=="ore suplimentare"){ 
                    let dlddata=await downloadreports_overtime(req.auth,year,month,subgroupid);
                    if(dlddata.recordsets[1].length==0){ res.send({error:"Subgrupa nu a putut fi gasita."});  return;  }
                    let filtererror = filtermatricols(dlddata.recordsets[0],q.matricoltype, q.matricolvalues);
                    if(filtererror.length>0){ res.send({error:filtererror});  return;  }
                    dlddata.recordsets[0].forEach(user => { user.overtimetotal=formathour(user.overtimetotal);
                                                            user.overtimeapproved=formathour(user.overtimeapproved);
                                                            user.overtime1last=formathour(user.overtime1last);
                                                            user.overtime2last=formathour(user.overtime2last);
                                                            user.overtime3last=formathour(user.overtime3last);
                                                            user.overtimebefore3m=formathour(user.overtimebefore3m);
                                                            user.totallast3=formathour(user.totallast3);
                                                          });
                    let xlsxBytes = await generate_xlsx_overtime(year,month,dlddata.recordsets[0],dlddata.recordsets[1][0],[q.suffix1,q.suffix2,q.suffix3,q.suffix4,q.suffix5],"xcell_overtime.json");    
                    gentime += new Date().getTime();
                    return res.send({error:"", data:xlsxBytes.toString('base64'), gentime:gentime, extension: "xlsx"});
                } else {
                    return res.send({error:"Tip raport neimplementat "+q.type});
                }
                
                res.send({error:"Tip raport neimplementat"})
            }
        catch (error)
            {   logerr(error)
                res.send({error:error.message})
            }
    }
async function api_get_finalize_status(req,res,newDBPool)
    {   let q = req.query;
        if(!isparamvalidint(q.subgroup_id)) { res.send({error:"Id subgrupa invalid:"+q.subgroup_id});return;}
        if(!isparamvalidint(q.month))   {res.send({error:"Parametru luna invalid."});return;  }
        if(!isparamvalidint(q.year))    { res.send({error:"Parametru an invalid."});  return;  }
        if(!isparamvalidstring(q.report_type))    { res.send({error:"Parametrul report_type invalid."});  return;  }
        const report_type = settings.finalizeascsv==1? q.report_type:"L";
        const year = parseInt(q.year);
        const month = parseInt(q.month);
        const date = year*100 + month;
        const id_subgroup = parseInt(q.subgroup_id);
        const format = settings.finalizeascsv==1?"csv":"xlsx";

        if (!subGroupMapping.id.hasOwnProperty(id_subgroup)) {
            res.send({ data: "", error: "Nu exista subgrupa cu id-ul: "+id_subgroup });
            return;
        }
        try {   let sql = `SELECT TOP(1) ro.generatedat FROM Reports ro
                        LEFT JOIN Users u ON ro.userid = u.id
                        LEFT JOIN SubGroups sg ON sg.id = u.sub_group_id
                        WHERE u.sub_group_id = ${id_subgroup} AND ro.date = ${date} ORDER BY ro.generatedat DESC;`;
                let result = await newDBPool.query(sql);
                let stampgeneratedat=result.recordset.length>0?result.recordset[0]:"";

                let stringmonth = ("0" + (month+1)).slice(-2)
                let subgroupname = subGroupMapping.id[id_subgroup].key_ref.split("-").reverse().join("-");
                let filename = `${config.systemClockingPath}${year}\\${stringmonth}\\${subgroupname}_${report_type}.`+format;
                let filenamelock = `${config.systemClockingLockedPath}${year}\\${stringmonth}\\${subgroupname}_${report_type}.lock`
                let lastModifiedDate = fs.existsSync(filename)?formattime(parseInt(new Date(fs.statSync(filename).mtime).getTime())).substring(0,19):"";

                res.send({data:stampgeneratedat,isOK:lastModifiedDate!="",isLock:fs.existsSync(filenamelock),
                          lastModified:lastModifiedDate,isGenerated:stampgeneratedat!="",error:''});
            }
        catch (err)
            {   res.send({error:err.message});
                logerr(err);
            }
    }

async function api_finalize_month(req, res, users) {
    let q = req.query

    if (!isparamvalidstring(q.report_type)) {  res.send({error:"Tipul raport invalid:"+q.report_type});    return; }
    if (!isparamvalidint(q.subGroupId)) {      res.send({error: "Id subgrupa invalid:"+q.subGroupId });    return; }
    if (!isparamvalidint(q.year)) {   res.send({error: "An invalid:"+q.year });   return; }
    if (!isparamvalidint(q.month)) {  res.send({error:"Luna valida:"+q.month });  return; }
    const subGroupId = parseInt(q.subGroupId);
    const year = parseInt(q.year);
    const month = parseInt(q.month);

    if (!subGroupMapping.id.hasOwnProperty(subGroupId)) {   res.send({error: "Nu exista subgrupa cu id-ul:"+subGroupId});   return; }
    if (year<2000||year>4000)   {   res.send({error:"An invalid:"+q.year });    return; }
    if (month<0||month>12)      {   res.send({error: "Luna selectata nu este valida : " + q.month });    return; }


    //CHECKS TO PREVENT EXPORT IN FUTURE/PAST/WRONG MONTHS
    let _todaydate=new Date();
    //if in future block
    if(year*100+month>_todaydate.getFullYear()*100+_todaydate.getMonth())
        return res.send({error: "Nu se pot finaliza rapoarte pentru viitor."});
    //if same month
    if(year*100+month==_todaydate.getFullYear()*100+_todaydate.getMonth())
        {   let lastday=new Date(_todaydate.getFullYear(),_todaydate.getMonth()+1,0).getDate();
            let today=_todaydate.getDate();
            if(lastday-today>settings.allowfindaysbefore-1)
                return res.send({error: "Nu se pot finaliza rapoarte decat in ultimele "+settings.allowfindaysbefore+" zile"});
        }
    //if in past
    if(year*100+month<_todaydate.getFullYear()*100+_todaydate.getMonth())
        if(!isMonthValidForReport(subGroupId,month))
            return res.send({error: "Nu se poate finaliza raportul pentru o luna incheiata." });
        
        
    
    if (typeof config.systemClockingPath !== "string"||config.systemClockingPath.length<1)
        {   logerr("systemClockingPath is not defined in config file");
            res.send({error: "Cale finalizare rapoarte nu este definită."});
            return;
        }
    if (typeof config.systemClockingLockedPath !== "string"||config.systemClockingLockedPath.length<1)
        {   logerr("systemClockingLockedPath is not defined in config file");
            res.send({error: "_Cale finalizare rapoarte nu este definită."});
            return;
        }
    if(!subGroupMapping.id.hasOwnProperty(subGroupId))
        {   res.send({error: "Biroul/Subgrupa nu a fost gasita."});
            return;
        }

    let exportPath = config.systemClockingPath+""+year+"\\"+(("0"+((month+1).toString())).slice(-2))+"\\";
    let lockedPath = config.systemClockingLockedPath+""+year+"\\"+(("0"+((month+1).toString())).slice(-2))+"\\";

    try{    if (!fs.existsSync(exportPath)) fs.mkdirSync(exportPath,{recursive:true});
       }
    catch(error){   logerr(error.message)
                    res.send({error: "Calea către locul unde trebuie salvate rapoartele de pontaj este incorectă. Contactați departament IT."})
                    return;
                }
    try{    if (!fs.existsSync(lockedPath)) fs.mkdirSync(lockedPath,{recursive:true});
       }
    catch(error){  logerr(error.message)
                    res.send({error: "_Calea către locul unde trebuie salvate rapoartele de pontaj este incorectă. Contactați departament IT."})
                    return;
                }
    const format=settings.finalizeascsv==1 ?"csv":"xlsx";
    const reportType = settings.finalizeascsv==1 ?q.report_type:"L";
    const reportTypePrintValue = reportType == "A" &&  settings.finalizeascsv==1 ? "AVANS" : "LICHIDARE";

    const subGroupKeyRef = subGroupMapping.id[subGroupId].key_ref.split("-").reverse().join("-");

    exportPath += subGroupKeyRef + "_" + reportType
    lockedPath += subGroupKeyRef + "_" + reportType

    if (fs.existsSync(lockedPath + ".lock")) {
        res.send({error: `Raportul de tipul ${reportTypePrintValue} nu mai poate fi exportat. Fisierele au fost preluate de către sistemul de salarizare.` });
        return;
    }

    if(!isMonthValidForReport(subGroupId,month))
        {   res.send({error: "Nu se poate exporta raportul pentru o luna incheiata." });
            return;
        }

    try {   await generatereport(year,month,users.id, newDBPool, subGroupId);
            q.count = 5000;
            let result = await downloadreports(q, req.auth, year, month,subGroupId);

            //let CSVReport = generatecsvreport(year, month, result.recordsets[0], result.recordsets[4], result.recordsets[5], [],"ALL", [], reportType == "A" ? settings.monthmiddledate : 9999);

            if(result.recordsets[5].length==0)
                {   res.send({error: "Eroare la obtinerea subgrupei."});
                    return;
                }

            if(settings.finalizeascsv)
                {   let CSVReport = generatecsvreport(reportType == "L",year,month,result.recordsets[0],result.recordsets[4],result.recordsets[6],result.recordsets[5][0]);
                    fs.writeFileSync(exportPath + "."+format, CSVReport);
                    
                }
            else{   const DNTM = await calculateDNTM(year, month, newDBPool);
                    let groupdata = {name:"",key_ref:""};
                    if(result.recordsets[5].length>0&&groupsMapping.hasOwnProperty(result.recordsets[5][0].group_id)) {
                        groupdata = groupsMapping[result.recordsets[5][0].group_id];
                    }
                    let unitdata = {name:""};
                    if(result.recordsets[7].length>0) {
                        unitdata = result.recordsets[7][0];
                    }
                    let xlsxbytes=await generatexlsxreport(year,month,result.recordsets[0],result.recordsets[4],result.recordsets[6],result.recordsets[5][0],groupdata,unitdata,["","","","",""], DNTM,"","xcelltemplate.json",true);
                    fs.writeFileSync(exportPath + "."+format, xlsxbytes);
                }
            if(result.recordset.length>0)
                {   const generationDate = new Date(parseInt(result.recordset[0].generatedat));
                    fs.utimesSync(exportPath + "."+format, generationDate, generationDate);
                }
            log(`Report ${reportTypePrintValue} was exported in ${exportPath}.`+format);
            
            let lockaswell="";
            if(settings.lockonfinalize==1)
                {   fs.writeFileSync(lockedPath + ".lock","locked");
                    lockaswell="+Blocare";
                }

            setAudit(req.auth.id,req.auth.name,"Finalizare luna "+monthnames[month]+" subgr:"+subGroupKeyRef+lockaswell,newDBPool);
            res.send({ data: `Raportul de tipul ${reportTypePrintValue} a fost exportat`, error: "" });
            return;

    } catch (error) {
        logerr(error);
        res.send({error: error.message});
        return;
    }
}
async function api_get_finalized_report(req, res, users)
    {   let q = req.query;
        if (!isparamvalidstring(q.report_type)) {  res.send({error:"Tipul raport invalid:"+q.report_type});    return; }
        if (!isparamvalidint(q.year))   {   res.send({ data: "", error: "Anul selectat nu este valid: " + q.year });    return; }
        if (!isparamvalidint(q.month))  {   res.send({ data: "", error: "Luna selectată nu este valida: " + q.month }); return; }
        if (!isparamvalidint(q.subGroupId)) {   res.send({ data: "", error: "Id-ul subgrupei selectate nu este valid: "+q.subGroupId }); return; }
        let reporttype=settings.finalizeascsv==1?q.report_type:"L";
        let subgroup_id = parseInt(q.subGroupId);
        let format=settings.finalizeascsv==1?"csv":"xlsx";
        if (!subGroupMapping.id.hasOwnProperty(subgroup_id))
            {   res.send({ data: "", error: "Nu exista subgrupa cu id-ul: "+subgroup_id });
                return;
            }
        try {   let subgroupname = subGroupMapping.id[subgroup_id].key_ref.split("-").reverse().join("-");
                let filename = `${config.systemClockingPath}${q.year}\\${("0" + (parseInt(q.month)+1)).slice(-2)}\\${subgroupname}_${reporttype}.`+format;
                let gentime =-new Date().getTime();
                if(!fs.existsSync(filename))
                    {   res.send({data:"",error:"Nu exista fisier exportat"})
                        return;
                    }
                let result=fs.readFileSync(filename);
                if (settings.finalizeascsv==1)
                    result=result.toString();
                else{   if(req.auth.candownloadrawreports)
                            result=result.toString('base64');
                        else{   format='pdf';
                                try {
                                    result = convertExcelToPdf(result);                                   
                                } catch(error) {
                                    res.send({data:"",error:"Eroare la generarea pdf-ului:"+error.message});
                                    return;
                                }
                            }
                    }
                
                res.send({bytes:result,gentime:new Date().getTime()-gentime,error:"",extension:format , iscsv:settings.finalizeascsv==1});
            }
        catch (error)
            {   logerr(error);
                res.send({data:"",error:error.message});
            }
    }

//=======================================================================
//=======================================================================FILES API
//=======================================================================

async function api_import_file(req, res) {
    const FOLDER_NAME = "templates/";
    const isHTML = req.query.isHTML;
    let fileName;

    if(isHTML == 1) {
        const isFullMonth = req.query.isFullMonth;
        fileName = (isFullMonth == 1) ? "pdf_template.html" : "pdf_template_avans.html";
    }
    else {
        fileName = "xcelltemplate.json";
    }

    fs.mkdirSync(FOLDER_NAME, { recursive: true}, (err) => {
        if (err) {
            logerr(err);
            return;
        };
    });
    try {
        const buffer = Buffer.from(req.body.data, 'base64');
        fs.writeFileSync(FOLDER_NAME + fileName, buffer);
        setAudit(req.auth.id,req.auth.name,"Incarcare template raport.",newDBPool);
        res.send({error: ""});
    }
    catch (error) {
        logwarn(error)
        res.send({data:"", error:error.message})
        return;
    }
}

async function api_download_report_template(req, res) {
    const isHTML = req.query.isHTML;
    const isCustom = req.query.isCustom;
    let fileName;
    if(isHTML == 1) {
        const isFullMonth = req.query.isFullMonth;
        fileName = (isFullMonth == 1) ? "pdf_template.html" : "pdf_template_avans.html";
    }
    else {
        fileName = "xcelltemplate.json";
    }
    try {
        let file = (isCustom == 1) ? getCustomFile(fileName) : getDefaultFile(fileName);
        res.send({downloadedFile: file, error: ""});
    }
    catch(error) {
        logerr(error);
        res.send({downloadedFile: "", error: error.message});
    }
}

async function api_delete_file(req, res) {
    const FOLDER_NAME = "/templates/";
    const isHTML = req.query.isHTML;
    let fileName;
    if(isHTML == 1) {
        const isFullMonth = req.query.isFullMonth;
        fileName = (isFullMonth == 1) ? "pdf_template.html" : "pdf_template_avans.html";
    }
    else {
        fileName = "xcelltemplate.json";
    }
    if(!fs.existsSync(process.cwd() + FOLDER_NAME + fileName)) {
        res.send({deletedFile: "", error: 'Nu s-a gasit fisierul dorit.'});
        return;
    }
    try {
        let filePath = process.cwd() + FOLDER_NAME + fileName;
        fs.unlinkSync(filePath);
        setAudit(req.auth.id,req.auth.name,"Stergere template raport.",newDBPool);
        res.send({deletedFile: filePath, error: ""});
    }
    catch(error) {
        logerr(error);
        res.send({deletedFile: "", error: error.message});
    }
}

//=======================================================================
//=======================================================================SCANS API
//=======================================================================
async function api_getUntransferedCards(req, res, users)
    {   const sql = `SELECT us.card_id, COUNT(us.card_id) scans_count, u.id user_id, u.matricol, u.first_name, u.last_name FROM UnknownScans us
                    JOIN (SELECT u2.id user_id, u2.cardid1 cards FROM Users u2 UNION SELECT u3.id, u3.cardid2 FROM Users u3
                            WHERE LEN(u3.cardid2) > 0) as tempTags ON us.card_id = tempTags.cards JOIN Users u ON tempTags.user_id = u.id
                    GROUP BY us.card_id, u.id, u.matricol, u.first_name, u.last_name;`;
        try {   let {recordset} = await newDBPool.query(sql);
                res.send({data: recordset, error: ""})
            }
        catch (error)
            {   res.send({data:"", error})
            }
    }

async function api_transferUnknownScans(req, res, users)
    {   let q = req.query;
        if (!(isparamvalidint(q.cardId) && isparamvalidint(q.userId)) )
            {   res.send({data:"", error:"Seria cardului " + q.cardId + " sau ID-ul angajatului "+ q.userId + " sunt invalide."})
                return;
            }
        try {   let {recordset} = await newDBPool.query(`SELECT us.stamp, us.location, us.[type], us.inorout, us.incedo_id FROM UnknownScans us WHERE us.card_id = '${q.cardId}';`);
                if (!recordset.length > 0)
                    {   res.send({data:"", error:"Nu au fost gasite înregistrări ale cardului " + q.cardId + " în Scanări cu probleme"})
                        return;
                    }
                //INSERTING unkn->scans
                let insertValues = [];
                for (let row of recordset)
                    {   row.userId = q.userId
                        insertValues.push(Object.values(row).reduce((res, v) => res + "," + v))
                    }
                let {rowsAffected} = await newDBPool.query(`INSERT INTO Scans (stamp, location, [type], inorout, incedo_id, userid) VALUES `+"(" + insertValues.join("),(") + ")");
                if (recordset.length != rowsAffected[0])
                    {   res.send({data:"", error:"Nu au fost transferate toate scanările cu probleme ale cardului"+
                                                q.cardId + ". Număr scanări de transferat: "+
                                                recordset.length+", număr trnasferate: "+rowsAffected[0]});
                        logwarn("Scans transfered for user:"+q.userId+" card:"+q.cardId+" ERR: Not all scans were inserted.");
                        setAudit(req.auth.id,req.auth.name,"Transfer scanari pentru:"+q.userId+" (incomplet insert)",newDBPool);
                        return;
                    }
                //DELETING unkn
                let {rowsAffected: rowsRemoved} = await newDBPool.query(` DELETE FROM UnknownScans WHERE card_id = ` + `'${q.cardId}'`);
                if (rowsRemoved != recordset.length)
                    {   res.send({data:"", error:"În urma tranferului, nu au fost sterșe toate scanările cu probleme ale cardului"+
                                q.cardId + ". Număr scanări de sterșe: " + rowsRemoved[0] + ", număr trnasferate: " + rowsAffected[0]})
                        logwarn("Scans transfered for user:"+q.userId+" card:"+q.cardId+" ERR: Not all unkn scans were deleted.");
                        setAudit(req.auth.id,req.auth.name,"Transfer scanari pentru:"+q.userId+" (incomplet delete)",newDBPool);
                        return;
                    }
                res.send({data:  rowsRemoved + `${rowsRemoved  == 1 ? " scanare a fost transferată cu succes": " scanări au fost transferate cu succes"}`, error: ""})
                log("Scans transfered for user:"+q.userId+" card:"+q.cardId);
                setAudit(req.auth.id,req.auth.name,"Transfer scanari pentru:"+q.userId,newDBPool);
            }
        catch (error) {
            logerr(error)
            res.send({data:"", error})
        }
    }
//=======================================================================
//=======================================================================SHIFTS API
//=======================================================================
async function api_getshiftprogramm(req,res)
    {   let q = req.query;
        if(!isparamvalidint(q.month))   { res.send({error:"Parametrul month este incorect:"+q.month}); return;}
        if(!isparamvalidint(q.year))    { res.send({error:"Parametrul year este incorect:"+q.year}); return;}
        if(!isparamvalidint(q.shiftid))    { res.send({error:"Parametrul shiftid este incorect:"+q.shiftid}); return;}
        const year=parseInt(q.year),month=parseInt(q.month);
        const stampstart = new Date(year,month,1).getTime();
        const stampend = new Date(year,month+1,1).getTime();
        let sql= "SELECT * FROM Shifts WHERE id="+q.shiftid+";"+
                 "SELECT * from Holidays WHERE stamp>"+stampstart+" AND stamp<"+stampend+";";
        try {   let result = await newDBPool.query(sql);
                if(result.recordset.length<1){res.send({error:"Tura nu a fost gasita."});return;}
                let shift=result.recordset[0];
                let details={clamp:shift.clamp,clampinterval:shift.clampinterval,includebreaks:shift.includebreaks,
                             extraunpaidhours:shift.extraunpaidhours,extrapaidhours:shift.extrapaidhours,name:shift.name}
                res.send({data:processhiftdata(year,month,result.recordsets),details:details,error:""});
            }
        catch(err)
            {   logerr(err);logerr(sql);
                res.send({error:err.message});
            }
    }
//=======================================================================
//=======================================================================ADMIN API
//=======================================================================
async function resetUsersAccounts(records = [], permissionId) {
    let userCount = records.length;
    let keepGoing = true;
    let batchSize = userCount > 100 ? 100 : userCount;
    let contor = 0;
    if (records.length > 0) {
        while (keepGoing === true) {
            let userNamesArray = []
            let hashArray = []
            let ids = []
            for (let i = contor; i < batchSize; i++) {
                let userNameString = `WHEN ${records[i].id} THEN '${records[i].matricol}'`
                let hashString = `WHEN ${records[i].id} THEN '${gethash(`${records[i].matricol}`)}'`
                userNamesArray.push(userNameString)
                hashArray.push(hashString)
                ids.push(records[i].id)
            }
            if (ids.length > 0) {
                let updateSql = `UPDATE Users SET username = CASE id ${userNamesArray.join('\n')} END,
                hash = CASE id ${hashArray.join('\n')} END, permission_id = ${permissionId} WHERE id IN (${ids.join(',')})`

                try {
                    let { rowsAffected } = await newDBPool.query(updateSql);
                    let updatedRows = rowsAffected[0];
                    if (updatedRows === ids.length) {
                        contor = contor + updatedRows <= userCount ? contor + updatedRows : userCount - contor;
                        batchSize = batchSize + updatedRows <= userCount ? batchSize + updatedRows : userCount;
                        if (contor === userCount) {
                            keepGoing = false;
                            log(`${contor} accounts reseted`)
                            setAudit(req.auth.id,req.auth.name,"Resetare conturi. ("+contor+")",newDBPool);
                            return contor
                        }
                    } else {
                        log(`Not all accounts was reseted ${updatedRows}/${recordsValuesArray.length}`);
                        setAudit(req.auth.id,req.auth.name,"Resetare conturi. ("+updatedRows+"/"+(recordsValuesArray.length)+")",newDBPool);
                        return;
                    }
                } catch (error) {
                    throw error;
                }
            } else {
                log(`Any account was reseted`);
                setAudit(req.auth.id,req.auth.name,"Resetare conturi.",newDBPool);
            }
        }
    }
}

async function api_admin_reset_resp_accounts(req, res, users)
    {   let q = req.query
        if(!isparamvalidint(q.permissionid)) { res.send({error:"Id grup invalid: "+q.permissionid});    return; }

        const sql = "SELECT u.id, u.matricol FROM Users u WHERE u.id IN ( SELECT DISTINCT sgr.user_id from SubGroupRepresentatives sgr)"+
                 (q.ignorealreadyset == "1"?" AND u.username=''":"")+";"+
                 "UPDATE Settings SET data="+(new Date().getTime())+" WHERE name='syncusersstamp';";

        try {   let {recordset} = await newDBPool.query(sql);
                if (recordset.length == 0)
                    {   res.send({error: "0 conturi au fost resetate.", message:""})
                        return
                    }
                let activatedAccounts = await resetUsersAccounts(recordset, q.permissionid)
                res.send({ message: activatedAccounts+ (activatedAccounts > 1? " conturi au fost resetate":" cont a fost resetat") +" cu succes.", error: ""})
                setAudit(req.auth.id,req.auth.name,"Resetare conturi responsabili.",newDBPool);
            }
        catch (error) {
            logerr(error)
            res.send({ error: "Probleme la resetarea coturilor "+error.message});
            return
        }
    }

async function api_import_manual(req, res) {
    try {
        const buffer = Buffer.from(req.body.data, 'base64');
        fs.writeFileSync("manual.pdf", buffer);
        setAudit(req.auth.id,req.auth.name,"Incarcare manual.",newDBPool);
        res.send({error: ""});
    }
    catch (error) {
        logwarn(error)
        res.send({data:"", error:error.message})
        return;
    }
}

async function api_get_tablenames(req, res)
    {
        try {
            const result = await newDBPool.query("SELECT name FROM sys.objects WHERE type='U'");
            res.send({data:result.recordset,tableConnections, error:""});
        }
        catch (err)
        {   res.send({error:err.message});
            logerr(err);
    }
}

async function api_advancedtablequery(req, res)
    {
        try {
            let q = req.query;
            if (typeof q.tablenames === 'undefined') {
                res.send({error: 'Eroare la parsare'})
                return
            }
            let tablenames = q.tablenames
            let tablesData = tablenames.split(',')

            let tableIndexes = []
            let tablesArray = []
            for (let i = 0; i < tablesData.length - 1; i += 2) {
                tablesArray.push(tablesData[i])
                tableIndexes.push(parseInt(tablesData[i + 1]))
            }
            let tempSQL = ''
            tablesArray.forEach(element => {
                tempSQL += "SELECT COLUMN_NAME from INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='" + element + "';"
            });

            const resultColumnNames = await newDBPool.query(tempSQL);
            let toPrint = tablesArray[0] + ' a0'
            if(!isparamvalidint(q.start))       q.start=0;
            if(!isparamvalidint(q.count))       q.count=10;
            if(!isparamvalidstring(q.orderby))  q.orderby="a0.id"

            let where = '';

            let columnMapping = { }
            for(let i = 0; i < tablesArray.length ; i++) {
                if(!tableConnections.hasOwnProperty(tablesArray[i])) {
                    res.send({error: 'Nu exista tabelul ' + tablesArray[i]})
                    return
                }
            }
            for(let i = 0; i < tablesArray.length; i++) {
                if(isNaN(tableIndexes[i])) {
                    res.send({error: 'Numarul pentru tabelul ' + tablesArray[i] + ' nu este valid' })
                    return
                }
            }
            for(let i = 1; i < tablesArray.length; i++) {
                if(!(tableIndexes[i] > -1 && tableIndexes[i] < tablesArray.length)) {
                    res.send({error: 'Indexul pentru tabelul ' + tablesArray[i] + ' este incorect.'})
                    return
                }
            }
            for(let i = 1; i < tablesArray.length ; i++) {
                if(!tableConnections[tablesArray[tableIndexes[i]]].hasOwnProperty(tablesArray[i])) {
                    res.send({error: 'Nu exista relatie intre tabelele ' +  tablesArray[tableIndexes[i]] + " si " +  tablesArray[i]})
                    return
                }
                toPrint += ' LEFT JOIN ' + tablesArray[i] + ' a' + i + ' ON a' + tableIndexes[i] + '.'
                        + tableConnections[tablesArray[tableIndexes[i]]][tablesArray[i]][0] + '=a' + i + '.'
                        + tableConnections[tablesArray[tableIndexes[i]]][tablesArray[i]][1]
                }
            let columnNames = [];
            for(let i = 0; i < tablesArray.length; i++) {
                for(let j = 0; j < resultColumnNames.recordsets[i].length; j++) {
                    columnNames.push('a' + i + '.' + resultColumnNames.recordsets[i][j].COLUMN_NAME + ' AS ' + tablesArray[i] + '@' + resultColumnNames.recordsets[i][j].COLUMN_NAME)
                    columnMapping[tablesArray[i] + '@' + resultColumnNames.recordsets[i][j].COLUMN_NAME] = 'a' + i + '.' + resultColumnNames.recordsets[i][j].COLUMN_NAME
                    if(q.orderby.includes(tablesArray[i] + '@' +resultColumnNames.recordsets[i][j].COLUMN_NAME)) {
                        q.orderby = 'a' + i + '.' + q.orderby.split('@')[1]
                    }
                }
            }
            if(q.orderby == "id ASC") { q.orderby = "a0.id ASC"}
            let tableValues = ['stamp', 'datestart', 'dateend', 'generatedat', 'data', 'refdate', 'last_checked_stamp', 'last_online_stamp']
            if (typeof q.filter == 'string' && q.filter.startsWith('{')) {
                try {
                    let obj = JSON.parse(q.filter)

                    let pieces = [];
                    Object.keys(obj).forEach(key => {
                        if(tableValues.some(el => columnMapping[key].includes(el))) {
                            if (obj[key].hasOwnProperty('min')&&obj[key].hasOwnProperty('max')){
                                pieces.push(columnMapping[key]+">"+obj[key].min+" AND "+columnMapping[key]+"<"+obj[key].max)
                            } else if (obj[key].hasOwnProperty('min')) {
                                pieces.push(columnMapping[key]+">"+obj[key].min)
                            } else if(obj[key].hasOwnProperty('max')) {
                                pieces.push(columnMapping[key]+"<"+obj[key].max)
                            }
                        } else {
                            pieces.push(columnMapping[key] +" LIKE '%" + obj[key] + "%'");
                        }
                    });
                    if(pieces.length>0)
                    {
                        where = " WHERE " + (pieces.join(" AND "));
                    }
                }
                catch (error) {
                    logerr(error);
                }

            }
            const pagination = " ORDER BY " + q.orderby  + " OFFSET " + q.start + " ROWS FETCH NEXT " + q.count + " ROWS ONLY";

            const sql = "SELECT " + columnNames.join(',') + " FROM " + toPrint + where + pagination + ' ;';
            const countSql = "SELECT count (*) as count FROM " + toPrint + where + ' ;';
            let result = await newDBPool.query(sql + countSql);

            result.recordset.forEach((elem) => {
                try {
                    let keys = Object.keys(elem)
                    keys.forEach((key) => {
                        if(key.includes('@date')) {
                            if(Array.isArray(elem[key])) {
                                for(let i = 0; i < elem[key].length; i++) {
                                    if(elem[key][i] < 1500000000000){
                                        let arrOfDigits = Array.from(String(elem[key][i]), Number)
                                        arrOfDigits.splice(4, 0, '-')
                                        arrOfDigits = arrOfDigits.join('')
                                        elem[key][i] = arrOfDigits
                                    }
                                    elem[key] = elem[key].toString().replace(',', '/')
                                }
                            } else  if(elem[key] < 1500000000000){
                                let arrOfDigits = Array.from(String(elem[key]), Number)
                                arrOfDigits.splice(4, 0, '-')
                                arrOfDigits = arrOfDigits.join('')
                                elem[key] = arrOfDigits
                            }
                        }
                        if(key.includes('Users@hash')) {
                            elem[key] = ''
                        }
                        if(key.includes('Shifts@day') || key.includes('Reports@d')) {
                            if(key.includes('date')){
                                return
                            }
                            if(Array.isArray(elem[key])) {
                                for(let i = 0; i < elem[key].length; i++) {
                                    elem[key][i] = processday(elem[key][i])
                                }
                                elem[key] = elem[key].toString().replace(',', '/')
                            } else {
                                elem[key] = processday(elem[key])
                            }
                        }
                        if(key.includes('inorout')) {
                            if(Array.isArray(elem[key])) {
                                for(let i = 0; i < elem[key].length; i++) {
                                    if(elem[key][i] === 1) {
                                        elem[key][i] += ' Intrare'
                                    } else {
                                        elem[key][i] += ' Iesire'
                                    }
                                }
                                elem[key] = elem[key].toString().replace(',', '/')
                            } else {
                                if(elem[key] === 1) {
                                    elem[key] += ' Intrare'
                                } else {
                                    elem[key] += ' Iesire'
                                }
                            }
                        }
                        if(Array.isArray(elem[key])) {
                            for(let i = 0; i < elem[key].length; i++) {
                                if(elem[key][i] == null) { elem[key][i] = '-'}
                            }
                            elem[key] = elem[key].toString().replace(',', '/')
                        }
                    })
                } catch (error) {
                    res.send({error: error.message});
                    logerr(error);
                }
            })
            if (typeof q.format !== 'undefined') {
                result.recordset.forEach((elem) => {
                let keys = Object.keys(elem)
                keys.forEach((field) => {
                    if(tableValues.some(el => field.includes(el))) {
                        if(typeof elem[field] ==='string'){
                            if(elem[field] > 1500000000000){
                                elem[field] = formattime(parseInt(elem[field]))
                            }
                        } else if(Array.isArray(elem[field])) {
                            elem[field].forEach((val) => {
                                if(val > 1500000000000){
                                    val = formattime(parseInt(val))
                                }
                            })
                        }
                    }
                    const fieldArray = q.field.split(',')
                    if(!fieldArray.includes(field)) {
                        delete elem[field]
                    } else {
                        elem[field.replace('@', ' ')] = elem[field]
                        delete elem[field]
                    }
                })
            });
            }
            if(q.format ==  'xlsx') {
                processXLSX(result.recordset, res)
            }else if(q.format == 'csv' || q.format== 'txt'){
                processCSV(result.recordset, res)
            } else {
                res.send({data: result.recordset, count: result.recordsets[1][0].count, error: ''})
            }

        } catch (error) {
            logerr(error);
        }
    }

const tableConnections = {
    Activities: {
        Users: ['userid', 'id'],
        Activitytypes: ['type', 'slot']
    },
    Activitytypes: { },
    Audit: {
        Users: ['userid', 'id']
    },
    Clockingchangesaudit: {
        Users: ['userid', 'id'],
        Editreason: ['reasonid', 'id'],
        Scans: ['scanid', 'id']
    },
    Editreason: {   },
    GroupRepresentatives: {
        Users: ['user_id', 'id'],
        Groups:['group_id', 'id']
    },
    Groups: {
        Units: ['unit_id', 'id']
    },
    Holidays: { },
    Locations: { },
    Logs: {
        // Activitytypes: ['type', 'slot']
    },
    Metascans: {  },
    Permissions: { },
    Reports_meta: {
        Users: ['userid', 'id']
    },
    Reports: {
        Users: ['userid', 'id']
    },
    Scanips: {
        Scans: ['scanid', 'id']
    },
    Scans: {
        Users: ['userid', 'id'],
        // Activitytypes: ['type', 'slot'],
        Clockingchangesaudit: ['changeid', 'id']
    },
    Settings: { },
    Shifts: { },
    Shiftschedule: {
        Users: ['userid', 'id'],
        Shifts: ['shiftid', 'id']
    },
    SubGroupRepresentatives: {
        Users: ['user_id', 'id'],
        Subgroups: ['sub_group_id', 'id']
    },
    Subgroups: {
        Groups: ['group_id', 'id']
    },
    Terminals: {
        Locations: ['locationid', 'id']
    },
    Units: { },
    UnitsRepresentatives: {
        Users: ['user_id', 'id'],
        Units: ['unit_id', 'id']
    },
    UnknownScans: {
        Users: ['card_id', 'cardid1']
        // Activitytypes: ['type', 'slot']
    },
    Users: {
        Permissions: ['permission_id', 'id'],
        Shifts: ['shift', 'id'],
        Subgroups: ['sub_group_id', 'id']
    },
    Vacations:  {
        Users: ['userid', 'id'],
        Vacationtypes: ['type', 'id']
    },
    Vacationtypes: { }
    }

function processDayDate(val) {
    if(val === null) {return}
    if(typeof val!=='string')logerr("Valoare invalida, trebuie string, e "+typeof val+" "+val);
    if(val.startsWith("-"))//VACATION
        {   val=-parseInt(val);
            return 'Concediu'
        }
    if(val=="0")return '0'//WORKED 0 HOURS IN THAT DAY
    if(val=="2")return 'L' //WEEKEND
    if(val=="3")return 'Concediu' //HOLIDAY
    if(val.length>1) {
        let val1 = parseInt(val.slice());       if(typeof val1!="number") val1 = 0;
        let val2 = parseInt(val.slice(0,-8));   if(typeof val2!="number") val2 = 0;

        if(val>100000000000) {
            const start  = Math.floor((val2%10000000000)/100000000);
            const end    = Math.floor((val2%100000000)/1000000);
            const total  = Math.floor((val2%100));
            const result = ("0"+Math.floor(start/2)+(start%2==1?":30":":00")).slice(-5) + '-' + ("0"+Math.floor(end/2)+(end%2==1?":30":":00")).slice(-5) + ', ' + ("0"+Math.floor(total/2)+(total%2==1?":30":":00")).slice(-5)
            return result
        } else {
            const start  = Math.floor((val1%1000000)/10000);
            const end    = Math.floor((val1%10000)/100);
            const total  = Math.floor((val1%100));
            const result = ("0"+Math.floor(start/2)+(start%2==1?":30":":00")).slice(-5) + '-' + ("0"+Math.floor(end/2)+(end%2==1?":30":":00")).slice(-5) + ', ' + ("0"+Math.floor(total/2)+(total%2==1?":30":":00")).slice(-5)
            return result
        }
    }

}

function processday(val) {
    // if(val === null) {return}
    if(typeof val=='string'){
        return processDayDate(val)
    } else if(Array.isArray(val)) {
        val.forEach((elem) => {
            return processDayDate(elem)
        })
    }
}

async function api_getallfinalizedstatus(req,res)
    {   let {valid,lockedPath,exportPath} =checkparamsfinalize(req,res,false)
        if(!valid)return;
        let gentime=-new Date().getTime()
        let subgroups={};
        Object.values(subGroupMapping.keyRef).forEach(subgr => {subgroups[subgr.key_ref]={locked:"",generated:"",name:subgr.name,code:subgr.code,id:subgr.id}})
        if(fs.existsSync(exportPath))
            {   fs.readdirSync(exportPath).forEach(file => 
                    {   let name=file.split('_')[0].split('-').reverse().join('-');
                        if(subgroups.hasOwnProperty(name))
                            subgroups[name].generated="Generat";
                    });
            }
        if(fs.existsSync(lockedPath))
            {   fs.readdirSync(lockedPath).forEach(file => 
                    {   let name=file.split('_')[0].split('-').reverse().join('-');
                        if(subgroups.hasOwnProperty(name))
                            subgroups[name].locked="Blocat";
                    });
            }
        let toreturn=Object.values(subgroups);// for(let i=0;i<100;i++)toreturn.push(toreturn[0]);
        let len=toreturn.length;
        if(isparamvalidint(req.query.start) && isparamvalidint(req.query.count))
            {   let start=parseInt(req.query.start);
                let count=parseInt(req.query.count);
                toreturn=toreturn.slice(start,start+count);
            }
        res.send({data:toreturn,count:len,error:"",gentime:new Date().getTime()+gentime});
    }
async function api_lockmonth(req,res)
    {   let {valid,lockedPath,filenamelock,year,month,subgroup} =checkparamsfinalize(req,res,true)
        if(!valid)return;
        if(!fs.existsSync(lockedPath))
            fs.mkdirSync(lockedPath,{recursive:true});
        if(!fs.existsSync(lockedPath+filenamelock))
            fs.writeFileSync(lockedPath+filenamelock,"lock");
        setAudit(req.auth.id,req.auth.name,"Blocare Finalizare "+year+"/"+monthnames[month]+" "+subgroup.key_ref,newDBPool);
        res.send({error:""});
    }
async function api_unlockmonth(req,res)
    {   let {valid,lockedPath,filenamelock,year,month,subgroup} =checkparamsfinalize(req,res,true)
        if(!valid)return;
        if(fs.existsSync(lockedPath+filenamelock))
            fs.unlinkSync(lockedPath+filenamelock);
        setAudit(req.auth.id,req.auth.name,"Deblocare Finalizare "+year+"/"+monthnames[month]+" "+subgroup.key_ref,newDBPool);
        res.send({error:""});
    }
async function api_downloadfinalizedarchive(req,res)
    {   let {valid,exportPath,year,month} = checkparamsfinalize(req,res,false)
        if(!valid)return;
        
        if(!fs.existsSync(exportPath))
            return res.send({error:'Nu exista fisiere pentru exportare.'});
        
        var archivename="/tosend_"+new Date().getTime()+".zip";
        
        var output = fs.createWriteStream(process.cwd() +archivename);
        var archive = archiver('zip', {zlib: { level: 9 } });
        output.on('close', function()
            {   log("Generated export archive("+archive.pointer()+" bytes) "+year+"/"+month);
                res.send({error:'',bytes:fs.readFileSync(process.cwd() +archivename).toString('base64')});
                fs.unlinkSync(process.cwd() +archivename);
            });
        output.on('end', function()
            {   logerr("Unknown archiver Error:end");
                throw new Error('Eroare la generarea arhivei:end.');
            });
        archive.on('warning', function(err)
            {   if (err.code === 'ENOENT') {logerr("Archiver warning:"+err.message);} 
                else {  logerr("Archiver warning:"+err.message);
                        throw err;
                     }
            });
        archive.on('error', function(err)
            {   logerr("Archiver Error:"+err.message);
                throw err;
            });
        archive.pipe(output);

        fs.readdirSync(exportPath).forEach(file => {
            archive.append(fs.createReadStream(exportPath+file), { name: file });    
        });
        archive.finalize();
        
        // exemplu folder: archive.directory(process.cwd()+'/TranzactiiCard/', 'TranzactiiCard');
        
    }
function checkparamsfinalize(req,res,checksubgrup)
    {   let q = req.query;
        if (typeof q.report_type === "undefined" && typeof q.type !== "undefined") {
            q.report_type = q.type;
        }
        if (typeof q.subgroup_id === "undefined" && typeof q.subgroupid !== "undefined") {
            q.subgroup_id = q.subgroupid;
        }
        if(!isparamvalidint(q.month))   {res.send({error:"Parametru luna invalid."});return {valid:false};  }
        if(!isparamvalidint(q.year))    { res.send({error:"Parametru an invalid."});  return {valid:false};  }
        if(!isparamvalidstring(q.report_type))    { res.send({error:"Parametrul report_type invalid."});  return {valid:false};  }
        const report_type = settings.finalizeascsv==1? q.report_type:"L";
        let subgroup={}, subgroupname="",filename;
        if(checksubgrup)
            {   if(!isparamvalidint(q.subgroup_id)) { res.send({error:"Id subgrupa invalid:"+q.subgroup_id});return;}
                const id_subgroup = parseInt(q.subgroup_id);
                if(!subGroupMapping.id.hasOwnProperty(id_subgroup))
                    {   res.send({ data: "", error: "Nu exista subgrupa cu id-ul: "+id_subgroup });
                        return {valid:false};
                    }
                subgroup=subGroupMapping.id[id_subgroup];
                subgroupname=subGroupMapping.id[id_subgroup].key_ref.split("-").reverse().join("-");
                filename = subgroupname+"_"+report_type+"";
            }
        let year=parseInt(q.year);
        let month=parseInt(q.month);
        let date=year*100+month;
        if (typeof config.systemClockingPath !== "string"||config.systemClockingPath.length<1)
            {   res.send({error: "Cale finalizare rapoarte nu este definită."});
                return {valid:false};
            }
        if (typeof config.systemClockingLockedPath !== "string"||config.systemClockingLockedPath.length<1)
            {   res.send({error: "_Cale finalizare rapoarte nu este definită."});
                return {valid:false};
            }
        let exportPath = config.systemClockingPath+""+year+"\\"+(("0"+((month+1).toString())).slice(-2))+"\\";
        let lockedPath = config.systemClockingLockedPath+""+year+"\\"+(("0"+((month+1).toString())).slice(-2))+"\\";
        if(year>3000||year<2000)
            {res.send({error:"Parametru an incorect."}); return {valid:false};  }
        if(month>11||month<0)
            {res.send({error:"Parametru luna incorect."}); return {valid:false};  }
        let format=settings.finalizeascsv?'csv':(req.auth.candownloadrawreports?'pdf':'xlsx');
        return {valid:true,year:year,month:month,date:date,report_type:report_type,subgroup:subgroup,exportPath:exportPath,
                lockedPath:lockedPath,filename:filename+format,filenamelock:filename+".lock",format:format};
                
    }
//=======================================================================
//=======================================================================AUDIT API
//=======================================================================
async function api_log_file_get(req, res)
    {   if (typeof req.query.selectedDate == "undefined")
            {   res.send({data:"", error:"Nu a fost primită nicio dată"});
                return;
            }
        let selectedFile = process.cwd() +"\\logs\\" + req.query.selectedDate.split("T")[0].split("-").join("_") + "_log.log";
        if (!fs.existsSync(selectedFile))
            {   res.send({data:"", error:"Nu a fost indentificat niciun fisier pentru ziua selectată"});
                return;
            }
        let file = Buffer.from(fs.readFileSync(selectedFile)).toString();
        res.send({data: file, error:""});
        return;
    }
//=======================================================================
//=======================================================================OTHER API
//=======================================================================
async function diff_import_incedo(req,res,users)
    {   let q = req.query
        if(!isparamvalidint(q.year))    { res.send({error:"Param year invalid, pune ?year=2022"});return;}
        if(!isparamvalidint(q.month))   { res.send({error:"Param month invalid, pune &month=0  sau &month=11 ..."});return;}
        if(!isparamvalidint(q.day))     { res.send({error:"Param day invalid, pune &day=1 sau 31 ..."});return;}

        const year = parseInt(q.year);// 2022;
        const month = parseInt(q.month);//2;0=ianuarie
        const day = parseInt(q.day);//16;
        const startstamp = new Date(year,month,day,0,0,0,0).getTime();
        const endstamp = startstamp+24*3600000;
        const dateiso = year+"-"+(("0"+(month+1)).slice(-2))+"-"+(("0"+day).slice(-2))
        const sql = "SELECT * FROM Scans WHERE stamp>"+ startstamp +" AND stamp<"+ endstamp +" AND type="+ASSAABLOY+";";
        const sqlincedo = "SELECT t.TR_DIRECTION inorout,t.TRANSACK_ID ScanId, t.TR_DATETIMELOCAL stamp, t.TR_TAGCODE card_id, t.TR_LOC_NAME location, m.MST_IDNUMBER matricol, m.MST_DISPLAYNAME username "+
                       "FROM TRANSACK AS t LEFT JOIN MASTER m ON m.MASTER_ID = t.TR_MASTER_ID WHERE t.TR_DATETIMELOCAL LIKE '"+dateiso+"%' AND t.TR_TAGCODE IS NOT NULL ORDER BY t.TRANSACK_ID ASC;";
        try {   const condnpontaj = createDBPool(config.db)
                const contdbincedo = createDBPool(config.dbIncedo)
                const stamptimer = new Date().getTime();
                const result1 = await condnpontaj.query(sql);
                const result2 = await contdbincedo.query(sqlincedo);

                let stamps = {}
                let toinsert = [];
                let duplicated = [];
                let toremoveids = [];
                let unknownscancount = 0;

                //PROCES OUR SCANS
                result1.recordset.forEach(elem =>
                    {   if(stamps.hasOwnProperty(elem.stamp+"_"+elem.inorout))
                            {   duplicated.push("Stamp same time(can't insert):"+JSON.stringify(elem)+" "+JSON.stringify(stamps[elem.stamp+"_"+elem.inorout]));
                                const last = stamps[elem.stamp+"_"+elem.inorout];
                                if(elem.stamp==last.stamp&&elem.inorout==last.inorout&&elem.userid==last.userid&&elem.location==last.location&&elem.changeid==last.changeid)
                                    toremoveids.push(elem.id);
                            }
                        else stamps[elem.stamp+"_"+elem.inorout]=elem;
                    });
                //PROCES INCEDO SCANS
                result2.recordset.forEach(elem =>
                    {   elem.stamp = new Date(elem.stamp).getTime();
                        elem.inorout++;
                        if(!stamps.hasOwnProperty(elem.stamp+"_"+elem.inorout))
                            toinsert.push(elem)
                    });
                //LOCATION DICT
                let locationdict = {};
                let idofmissinglocation = -1;
                const locations = await condnpontaj.query("SELECT * FROM Locations WHERE deactivated=0;");
                locations.recordset.forEach(elem =>
                    {   locationdict[elem.name] = elem.id;
                        if (idofmissinglocation < 0 && elem.name == 'Locatie lipsa') idofmissinglocation = elem.id;
                    });
                //BUILDING QUERIES
                let inserts = [], insertcount = 0, totalinserts = 0, batches = [];
                toinsert.forEach(elem =>
                    {   if(users.cardid.hasOwnProperty(elem.card_id))
                            {   if(locationdict.hasOwnProperty(elem.location))
                                    elem.location = locationdict[elem.location]
                                else elem.location = idofmissinglocation;
                                inserts.push("("+elem.stamp+","+users.cardid[elem.card_id].id+","+elem.location+","+ASSAABLOY+","+elem.inorout+","+elem.ScanId+")")
                                totalinserts++;
                                insertcount++;
                                if(insertcount==100)
                                    {   insertcount = 0;
                                        batches.push("INSERT INTO Scans (stamp,userid,location,type,inorout,incedo_id) VALUES "+inserts.join(",")+";");
                                        inserts = [];
                                    }
                            }
                        else unknownscancount++;
                    });
                if(inserts.length>0)
                    {   insertcount = 0;
                        batches.push("INSERT INTO Scans (stamp,userid,location,type,inorout,incedo_id) VALUES "+inserts.join(",")+";")
                        inserts = [];
                    }

                let toremovepieces = [];
                toremoveids.forEach(elem => {toremovepieces.push("DELETE FROM SCANS WHERE id="+elem+";");});

                const testingsql = "SELECT * FROM scans WHERE stamp IN (SELECT stamp FROM SCANS WHERE id=);"
                fs.writeFileSync("sqlquerysyncdiff.txt","Scanari cu acelasi stamp:\n"+duplicated.join('\n')+"\n\n\nSQL:\n\n\n\n"+batches.join('\n')+"\n\n\n\n"+testingsql+"\nSQL DELETE DUPLICATES:\n\n"+toremovepieces.join('\n'));
                const toprint = "DB:"+result1.recordset.length+" DBINCEDO:"+result2.recordset.length+" TOTAL NOT SYNCED SCANS(including unknown):"+toinsert.length+" UNKNOWNSCANS(not inserted):"+unknownscancount+" BATCHES WRITTEN:"+batches.length+"  INSERTS WRITTEN:"+totalinserts+"    DUPLICATED STAMPS(not inserted):"+duplicated.length+"  TO REMOVE DUPLICATES:"+toremoveids.length+"   FILTER:"+year+" "+monthnames[month]+" "+day+" "+startstamp+" "+endstamp+" "+dateiso+"  ELAPSED:"+((new Date().getTime()-stamptimer)/1000+" seconds");
                log(toprint);
                res.send({result:"Query generat in sqlquerysyncdiff.txt, "+toprint})
                condnpontaj.disconnect();
                contdbincedo.disconnect();
                setAudit(req.auth.id?req.auth.id:-1,req.auth.name?req.auth.name:"?","Sincronizare manuala scanari Incedo.",newDBPool);
            }
        catch (err)
            {   res.send({result:err.message})
                logerr(err);
                logerr(sql);
                logerr(sqlincedo);
            }
    }

//=========================================================================SOME API FOR CHECKING DATES
function isMonthValidForReport(subgroupid,month)
    {   if(!subGroupMapping.id.hasOwnProperty(subgroupid))return false;
        let subgr=subGroupMapping.id[subgroupid];
        return (subgr.editclockinghistory===1)||
               (subgr.editvacationhistory===1)||
               (subgr.editactivityhistory===1)||
               (_isMonthValidForEdit(month));
    }
function isStampValidForScanEdit(subgroupid,stamp)
    {   if(!subGroupMapping.id.hasOwnProperty(subgroupid))return false;
        let subgr=subGroupMapping.id[subgroupid];
        return (subgr.editclockinghistory===1)||(_isStamphValidForEdit(stamp))
    }
function isStampValidForActivityEdit(subgroupid,stamp)
    {   if(!subGroupMapping.id.hasOwnProperty(subgroupid))return false;
        let subgr=subGroupMapping.id[subgroupid];
        return (subgr.editactivityhistory===1)||(_isStamphValidForEdit(stamp))
    }
function isStampValidForVacationEdit(subgroupid,stamp)
    {   if(!subGroupMapping.id.hasOwnProperty(subgroupid))return false;
        let subgr=subGroupMapping.id[subgroupid];
        return (subgr.editvacationhistory===1)||(_isStamphValidForEdit(stamp))
    }

function _isStamphValidForEdit(stamp)
    {   return _isMonthValidForEdit(new Date(stamp).getMonth());
    }
function _isMonthValidForEdit(month)
    {   let date=new Date();
        if(month >= date.getMonth())return true;
        if(month == date.getMonth()-1 && date.getDate()<=settings.lastdaytogenreport)return true;
        return false;
    }
