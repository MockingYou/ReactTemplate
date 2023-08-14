// const mssql=require("mssql");
const {monthnames,gethash,setAudit,buildtoken,getAuth,log,logerr,isparamvalidstring,isparamvalidstringnolen,isparamvalidint,buildwhere,processXLSX, processCSV, filterData, processimportuserscsv}=require('./server_utils')

async function api_crud_get(req,res,dbPool,table,users,options,processmethod)//optional  query:start,count,orderby,user,{filter}
    {   if(typeof options!='object')options={};

        //VALIDATION
        let q = req.query;
        if(!isparamvalidint(q.start)) q.start=0;
        if(!isparamvalidint(q.count)) q.count=10;
        if(!isparamvalidstring(q.orderby)) q.orderby="id";
        else q.orderby = " " + q.orderby;

        if(typeof options.orderby=='string') q.orderby=options.orderby;
        if(typeof options.orderbyprefix=='string') q.orderby=options.orderbyprefix+q.orderby;


        //WHERE
        let where="";

        const filter = (typeof options.filter=='object')?options.filter:{}
        let filterquery = {}
        if(typeof q.filter=='string')if(q.filter.startsWith('{'))
            try {   q.filter = q.filter.split("'").join('"')
                    let tempfilter = JSON.parse(q.filter)
                    Object.keys(tempfilter).forEach(key => {
                        filterquery[key]=tempfilter[key];
                    });
                } catch (error) {logerr(error);}
        let filterarray = []
        const whereprefix = (typeof options.whereprefix=='string')?options.whereprefix:"";
        for (let [key, value] of Object.entries(filter))
            {   const s = isparamvalidint(value)?"":"'";
                if(typeof options.replacewhere=='object'&&options.replacewhere.hasOwnProperty(key))
                    key = options.replacewhere[key];
                filterarray.push(whereprefix+key+" = "+s+value+s+"")
            }

        let filterarrayquery=[]
        if(typeof options.additionalwhere=='string' && options.additionalwhere.length>0)
            filterarrayquery.push(options.additionalwhere)
        let tableValues = ['stamp', 'datestart', 'dateend', 'generatedat', 'data', 'refdate', 'last_checked_stamp', 'last_online_stamp']

        for (let [key, value] of Object.entries(filterquery))
            {   if(typeof options.replacewhere=='object'&&options.replacewhere.hasOwnProperty(key))
                    key = options.replacewhere[key];
                if(options.useequalinsteadoflike)
                    {   const s = isparamvalidint(value)?"":"'";
                        filterarrayquery.push(whereprefix+key+" = "+s+value+s+"")
                    }
                else if(tableValues.some(el => key == el)) {
                    if (filterquery[key].hasOwnProperty('min')&&filterquery[key].hasOwnProperty('max')){
                        filterarrayquery.push(whereprefix+key+">"+filterquery[key].min+" AND "+whereprefix+key+"<"+filterquery[key].max)
                    } else if (filterquery[key].hasOwnProperty('min')) {
                        filterarrayquery.push(whereprefix+key+">"+filterquery[key].min)
                    } else if(filterquery[key].hasOwnProperty('max')) {
                        filterarrayquery.push(whereprefix+key+"<"+filterquery[key].max)
                    }
                }  else {
                    filterarrayquery.push(whereprefix+key+" LIKE '%"+value+"%'")
                }
            }
        const useORinwhere = q.useor=='1'||(typeof options.useor=='boolean'&&options.useor)

        if(filterarray.length>0)
            {   where = "("+filterarray.join(" AND ")+")";
            }
        if(filterarrayquery.length>0)
            {   where += (where.length>0?" AND ":"")+"("+filterarrayquery.join(useORinwhere?" OR ":" AND ")+")";
            }

        if(typeof q.notempthy=='string' && q.notempthy.length>0)
            {   let lines = q.notempthy.split(',');
                for(let i=0;i<lines.length;i++) lines[i]+=" <> ''";
                where += (where.length>0?" AND ":"")+lines.join(' AND ')+" ";
            }
        if(where.length>0) where = " WHERE "+where+' ';

        const pagination = " OFFSET "+q.start+" ROWS FETCH NEXT "+q.count+" ROWS ONLY";

        //QUERY
        try {
                let sql="";
                if(typeof options.customsql==='string' )//typeof options.customsql.orderbyprefix=='string'
                    {   sql = options.customsql.replace("{{WHERE}}",where).replace("{{WHERE}}",where).replace("{{ORDERBY}}"," ORDER BY "+q.orderby).replace("{{PAGINATION}}",pagination);
                    }
                else{   let columns="*";
                        if(typeof options.columns==='string')columns=options.columns;
                        sql="SELECT "+columns+" FROM "+table+where+" ORDER BY "+q.orderby +pagination+";SELECT COUNT(*) as count FROM  "+table+where+";"
                    }
                if(typeof options.additionalquery=='string') sql += options.additionalquery;
                const result = await dbPool.query(sql);
                if(typeof processmethod=='function'){ processmethod(users,result.recordsets[0]); }

                if (typeof q.format !== 'undefined') { filterData(result.recordset,q.fields, q.names) }
                if(q.format ==  'xlsx') {
                    processXLSX(result.recordset, res)
                }else if(q.format == 'csv' || q.format== 'txt'){
                    processCSV(result.recordset, res)
                } else {
                    res.send({ data: result.recordset, count: result.recordsets[1][0].count, error: "" })
                }
            }
        catch (err)
            {   res.send({error:err.message});
                logerr(err);
            }
    }
async function api_crud_get_join(req,res,dbPool,separator,orderby,countcolumn,processresults,columns,from,additionalwhere,parameters)
    {   let q = req.query;
        if(!isparamvalidint(q.start)) q.start=0;
        if(!isparamvalidint(q.count)) q.count=10;
        if(!isparamvalidstring(q.orderby)) q.orderby = orderby;
        let wherepieces = buildwhere(q.filter,separator,parameters);
        if(additionalwhere.length>0) wherepieces.push(additionalwhere)
        let orderByColumn = q.orderby.split(" ")[0];
        let orderByType = q.orderby.split(" ")[1];
        for(let param of parameters) {
            if(orderByColumn === param.n) {
                q.orderby = param.r + " " + orderByType;
                break;
            }
        }
        let where = wherepieces.length>0?" WHERE "+wherepieces.join(" AND "):"";
        let pagination = " OFFSET "+q.start+" ROWS FETCH NEXT "+q.count+" ROWS ONLY ";
        let sql = "SELECT "+columns+from+" "+where+" ORDER BY "+q.orderby+pagination+";SELECT COUNT("+countcolumn+") as [count] "+from+" "+where+";";
        try {
            let result = await dbPool.query(sql)
            if(typeof processresults=='function'){processresults(result.recordsets[0]);}

            if (typeof q.format !== 'undefined') { filterData(result.recordset, q.fields, q.names) }
            if(q.format ==  'xlsx') {
                processXLSX(result.recordset, res)
            }else if(q.format == 'csv' || q.format== 'txt'){
                processCSV(result.recordset, res)
            } else {
                res.send({ data: result.recordset, count: result.recordsets[1][0].count, error: "" })
            }
        }
        catch (err)
            {   res.send({ error: err.message })
                logerr(err);
            }
    }
async function api_crud_remove(req,res,dbPool,table,users, options) //mandatory: query:id
    {   let q = req.query;
        if(!isparamvalidint(q.id)){ res.send({data:[],error:"Lipseste id-ul elementului("+q.id+")."});return;}
        if(typeof options !== "object")options={};

        if(typeof options.iselemvalid=='function') {
            if(!(await options.iselemvalid(parseInt(q.id)))) {
                res.send({error:typeof options.invalidresponse=="string"?options.invalidresponse:"Elementul nu poate fi sters."});
                return;
            }
        }

        if(typeof options.checkFKQuery == "string") {
            let sql = options.checkFKQuery.replace('{$id}', q.id);
            let queryResult = await dbPool.query(sql);
            let numberOfAppearencesFK = queryResult.recordsets[0][0].count;
            if(numberOfAppearencesFK > 0) {
                if(sql.includes("permission_id"))
                    return res.send({error:"Rolul nu a putut fi sters deoarece exista angajati care au acest rol."});
                else if(sql.includes("shift"))
                    return res.send({error:"Tura nu a putut fi stearsa deoarece exista angajati care au aceasta tura."});
            }
        }

        try {
            const result = await dbPool.query("DELETE FROM "+table+" WHERE id="+q.id+";");

            setAudit(req.auth.id,req.auth.name,"Stergere element "+q.id+" din "+table+".",dbPool);

            res.send({data:result.rowsAffected,error:""});
        }
        catch (err) {
            if(err.message.includes("DELETE statement conflicted with the REFERENCE constraint")) {
                if(table === "SubGroups")
                    res.send({error:"Subgrupa nu a putut fi stearsa deoarece exista angajati care fac parte din ea."});
                else if(table === "Groups")
                    res.send({error:"Grupa nu a putut fi stearsa deoarece exista subgrupe care fac parte din ea."});
                else if(table === "Units")
                    res.send({error:"Departamentul nu a putut fi sters deoarece exista grupe care fac parte din el."});
                else
                    res.send({error:"Elementul nu a putut fi sters deoarece alte elemente depind de acesta."});
            }
            else
                res.send({error:err.message});

            logerr(err);
        }
    }
async function api_crud_deactivate(req,res,dbPool,table,users,options)//mandatory: query:id
    {   let q = req.query;
        if(!isparamvalidint(q.id)){ res.send({data:[],error:"Lipseste id-ul elementului("+q.id+")."});return;}

        let sql = "UPDATE "+ table + " SET deactivated=1 WHERE id= "+ q.id +";";
        if(typeof options=='object'&&typeof options.additionalquery=='string')
            sql += options.additionalquery.replace('{$id}',q.id);

        try {
                const result = await dbPool.query(sql);

                setAudit(req.auth.id,req.auth.name,"Dezactivare element "+q.id+" din "+table+".",dbPool);

                res.send({data:result.rowsAffected,error:""});
            }
        catch (err)
            {   res.send({error:err.message});
                logerr(err);
            }
    }
async function api_crud_reactivate(req,res,dbPool,table,users,options)//mandatory: query:id
{   let q = req.query;
    if(!isparamvalidint(q.id)){ res.send({data:[],error:"Lipseste id-ul elementului("+q.id+")."});return;}

    let sql = "UPDATE "+ table + " SET deactivated=0 WHERE id= "+ q.id +";";
    if(typeof options=='object'&&typeof options.additionalquery=='string')
        sql += options.additionalquery.replace('{$id}',q.id);

    try {
            const result = await dbPool.query(sql);

            setAudit(req.auth.id,req.auth.name,"Reactivare element "+q.id+" din "+table+".",dbPool);

            res.send({data:result.rowsAffected,error:""});
        }
    catch (err)
        {   res.send({error:err.message});
            logerr(err);
        }
    }
//options:{convertusertoid:true,procesitembeforeinsert:function(){}}
async function api_crud_add(req,res,dbPool,table,users,options, processNewItem)//mandatory: query:id,field,value,type
    {   let q = req.query;

        if(typeof q.newitem != 'string' || !q.newitem.startsWith("{")){ res.send({error:"Lipseste parametrul element nou."});return;}
        // if(!isparamvalidstring(q.newitem)){ res.send({error:"Lipseste parametrul element nou."});return;}

        try {   let newitem = JSON.parse(q.newitem);
                if(typeof options!=='object')options={};
                if(typeof processNewItem == "function") {
                    processNewItem(users,newitem,req.auth);
                }

                if(typeof options.iselemvalid=='function') {
                    if(!(await options.iselemvalid(newitem))) {
                        res.send({error:typeof options.invalidresponse=="string"?options.invalidresponse:"Element invalid."});
                        return;
                    }
                }

                let columns=[], values=[];

                if(typeof options.procesitembeforeinsert == 'function')
                    options.procesitembeforeinsert(newitem);
                Object.keys(newitem).forEach(key=>
                    {   columns.push(key);
                        const separator = typeof newitem[key]=='string'?"'":"";
                        values.push(separator+newitem[key]+separator);
                    });

                let sql = "INSERT INTO "+table+"("+columns.join(',')+") VALUES("+values.join(',')+");";
                sql += "SELECT TOP 1 id FROM "+table+" ORDER BY id DESC;";
                if(typeof options.additionalquery=='string') sql += options.additionalquery;
                const result = await dbPool.query(sql);
                //if(q.newitem.includes('shiftid')) { updateshifts(dbPool); }
                setAudit(req.auth.id,req.auth.name,"Adaugare element in "+table+", id:"+result.recordset[0].id+".",dbPool);
                const returnid = result.recordset[0].id;
                res.send({data:result.rowsAffected,id:returnid,error:""});
            }
        catch (err)
            {   res.send({error:err.message});
                logerr(err);
            }
    }
async function api_crud_edit(req,res,dbPool,table,users,options)//mandatory: query:id,field,value,type
    {   let q = req.query;
        if(!isparamvalidint(q.id)) { res.send({error:"Lipseste parametrul id("+q.id+")."}); return;}
        if(!isparamvalidstring(q.field)) { res.send({error:"Lipseste parametrul field("+q.field+")."}); return;}
        if(!isparamvalidstringnolen(q.value)) { res.send({error:"Lipseste parametrul value("+q.value+")."}); return;}
        if(!isparamvalidstring(q.type)) { res.send({error:"Lipseste parametrul type("+q.type+")."}); return;}
        if(typeof options !== 'object') options = {};
        const sepparator = q.type=='number'||q.type=='bool' ? "" : "'";

        if(typeof options.iselemvalid=='function') {
            if(!(await options.iselemvalid(q))) {
                res.send({error:typeof options.invalidresponse=="string"?options.invalidresponse:"Elementul nu poate fi sters."});
                return;
            }
        }
        if(typeof options.processvalue=='function') {
            options.processvalue(q);
        }
        try {
                let sql = "UPDATE "+table+" SET "+q.field+"="+sepparator+q.value+sepparator+" WHERE id="+q.id+";";
                if(typeof options.additionalquery=='string') sql+=options.additionalquery.replace('{$id}',q.id+"").replace('{$id}',q.id+"").replace('{$id}',q.id+"");
                setAudit(req.auth.id,req.auth.name,"Edit "+table+":"+q.id+"("+q.field+":"+(q.value.toString())+")",dbPool);
                const result = await dbPool.query(sql);

                res.send({data:result.rowsAffected,error:""});
            }
        catch (err)
            {   res.send({error:err.message});
                logerr(err);
            }
    }
async function api_crud_query(req,res,dbPool,query)
    {   try {   const result = await dbPool.query(query);
                res.send({data:result.recordset,error:""});
            }
        catch (err)
            {   res.send({error:err.message});
                logerr(err);
            }
    }

exports.api_crud_get = api_crud_get
exports.api_crud_get_join = api_crud_get_join
exports.api_crud_remove = api_crud_remove
exports.api_crud_deactivate = api_crud_deactivate
exports.api_crud_reactivate = api_crud_reactivate
exports.api_crud_add = api_crud_add
exports.api_crud_edit = api_crud_edit
exports.api_crud_query = api_crud_query