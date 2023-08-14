const axios = require("axios").default;
const convert = require("xml-js");
const fs = require("fs");
const https = require("https");
const { createDBPool } = require("./server_utils");
let config = JSON.parse(fs.readFileSync("config.json"));

let pool = createDBPool(config.db);
let poolIncedo = createDBPool(config.dbIncedo);


const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // (NOTE: this will disable client verification),
  key: fs.readFileSync(process.cwd() + "/" + config.certificates.key),
  cert: fs.readFileSync(process.cwd() + "/" + config.certificates.cert),
  passphrase: config.certificates.passphrase,
  tls: {
    rejectUnauthorized: false,
  },
});

axios.defaults.baseURL = config.baseURL;
axios.defaults.url = config.endpoint;
axios.defaults.headers = {
  "Content-Type": "application/xml",
  Accept: "*/*",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
};
axios.defaults.httpsAgent = httpsAgent;

/**
 *
 * @param {a string which specify what kind of operation should be performed on returned users from assaabloy db in Incedo DB: add, update, delete} requiredOperationType
 * @returns an array of users
 */
async function getUnsyncedUsers(requiredOperationType = "") {
  let selectQuery = `	SELECT u.id, u.name, u.last_name, u.first_name, u.matricol, u.cardid1, u.cardid2 FROM Users u WHERE u.require_${requiredOperationType} = 1 ${requiredOperationType != 'delete' ? `AND u.deactivated = 0` : ''};`;
  try {
    let { recordset } = await pool.query(selectQuery);
    return recordset;
  } catch (error) {
    throw error;
  }
}

/**
 * authenticate in Incedo System
 * @returns on object which contain an token and a cookie
 */
async function getAuthToken() {
  let headersConfig = {
    headers: {
      name: "sysdba",
      pswd: "bWFzdGVya2V5",
    },
  };
  try {
    let { headers } = await axios.post(axios.defaults.url, {}, headersConfig);
    let loginHeaders = {
      Cookie: headers["set-cookie"],
      token: headers.token,
    };
    return loginHeaders;
  } catch (error) {
    throw(error);
  }
}

/**
 *
 * @param {additional headers: header and cookie } headers
 * @param {xml body send to incedo server in order to perform a specific operation} xml
 * @returns result of API request
 */
async function performAPIRequest(headers, xml) {
  let headersConfig = {
    headers,
  };
  try {
    let { data } = await axios.put(axios.defaults.url, xml, headersConfig);
    let result = convert.xml2js(data, { compact: true });
    return result.protocol.dbupdate._attributes.result;
  } catch (error) {
    if (typeof error.response == "undefined" || typeof error.response.data == "undefined") {
      throw error
    } else {
      let errorResult = convert.xml2js(error.response.data, { compact: true });
      throw errorResult.protocol.error._attributes.desc;
    }
  }
}

/**
 *
 * @param {user's matricol number from assaabloy db} matricol
 * @returns user's id from Incedo DB
 */
async function getUserIdByMatricol(matricol = 0) {
  try {
    let selectQuery = `SELECT TOP(1) m.MASTER_ID id
      FROM MASTER m
      WHERE m.MST_IDNUMBER = '${matricol}'`;
    let { recordset } = await poolIncedo.query(selectQuery);
    if (recordset.length > 0) {
      return recordset[0].id;
    } else {
      return 0;
    }
  } catch (error) {
    throw(error);
  }
}

/**
 *
 * @param { user's (master's ID)} id
 * @returns user's tags IDS
 */
async function getTagsIdsByMasterId(id) {
  try {
    let selectQuery = `SELECT t.TAG_ID id, t.TAG_CODE tagCode
      FROM TAG t 
      WHERE t.MASTER_ID = ${id}`;
    let { recordset } = await poolIncedo.query(selectQuery);
    return recordset;
  } catch (error) {
    throw(`At getScansFromIncedo: ${error}`);
  }
}

/**
 *
 * @param {a string which specify what kind of operation should be performed on returned users from assaabloy db in Incedo DB: add, update, delete} requiredOperationType
 * @param {users's ids which have been successfully synced} ids
 * @returns rowsAffected after db operation was performed
 */
async function setRequiredStatusToFalse( ids = [], addStatus, updateStatus, deleteStatus, syncError) {
  let idsString = ids.join(",");
  let columnsToUpdate = []
  addStatus === 1 || addStatus === 0 ? columnsToUpdate.push(`require_add = ${addStatus}`) : ""
  updateStatus === 1 || updateStatus === 0 ? columnsToUpdate.push(`require_update = ${updateStatus}`) : ""
  deleteStatus === 1 || deleteStatus === 0 ? columnsToUpdate.push(`require_delete = ${deleteStatus}`) : ""
  syncError === 1 || syncError === 0 ? columnsToUpdate.push(`sync_error = ${syncError}`) : ""

  if (columnsToUpdate.length > 0) {
    let updateQuery = `UPDATE Users SET ${columnsToUpdate.join(", ")} WHERE id IN(${idsString})`;
    try {
      let { rowsAffected } = await pool.query(updateQuery, ids);
      return rowsAffected[0];
    } catch (error) {
      throw error;
    }
  } else {
    throw 'Any require operation specified. Operations: require_add, require_update, require_delete. Values: 1=true, 0=false';
  }
}

async function insertUser(firstName, lastName, matricol) {
  let lastMasterId
  try {
    lastMasterId = await getLastMasterId()
    let query = `INSERT INTO MASTER(VERSION,MASTER_ID,MST_DISPLAYNAME,MST_TITLE,MST_FIRSTNAME,MST_MIDDLENAME,MST_LASTNAME,MST_SUFFIX,
      MST_IDNUMBER,MST_GENDER,MST_PIN,MST_TYPE,MST_CURRENT,MST_HOSTED,MST_HOSTID,MST_SUSPEND,MST_REPORT,MST_BLACKLIST,MST_NOAPB,
      SITE_ID,MASTER_TYPE_ID,DEPARTMENT_ID,COMPANY_ID,PROFILE_ID,MST_SEARCH_TERM, MST_EMAIL_ADDRESS,MST_MOBILE_ADDRESS,CARD_ID,
      MST_START_DATE,MST_EXPIRY_DATE,MST_START_TIME,MST_EXPIRY_TIME,MST_MOBILE_ACCESS_IDENTIFIER,MST_EXPIRY_START,MST_EXPIRY_END,MST_EXTENDED_ACCESS) 
    VALUES (0, '${lastMasterId+1}', '${firstName} ${lastName}', '', '${firstName}','', '${lastName}','','${matricol}','M',0,0,1,0,NULL,0,1,0,0,2,2,1,1,16,NULL,NULL,NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,0);`
    let { rowsAffected } = await poolIncedo.query(query);
    return rowsAffected[0]
  } catch (error) {
    throw error; 
  }
}
async function insertUserMasterGroup(matricol) {
  let lastMasterGroupId
  let masterId
  try {
    lastMasterGroupId = await getLastMasterGroupId()
    masterId = await getUserIdByMatricol(matricol)
    let query = `INSERT INTO MASTER_GROUP (MASTER_GROUP_ID,MASTER_ID,ACCESS_GROUP_ID,MG_START_DATETIME_UTC,MG_END_DATETIME_UTC,MG_DATETIME_IN_EFFECT,MG_EXPIRES) 
    VALUES (${+lastMasterGroupId+1},${+masterId},1,NULL,NULL,NULL,0);`
    let { rowsAffected } = await poolIncedo.query(query);
    return rowsAffected[0]
    
  } catch (error) {
    throw error; 
  }
}

async function insertUserTag(tagCode, matricol) {
  let lastTagId
  let masterId
  try {
    lastTagId = await getLastTagId()
    masterId = await getUserIdByMatricol(matricol)
    let query = `INSERT INTO TAG (TAG_ID,TAG_CODE,TAG_CODE_UNTRUNCATED,TAG_SUSPEND,TAG_REPORT,TAG_BLACKLIST,TAG_START,TAG_EXPIRY,
      TAG_VISITOR,TAG_SPECIALEV,TAG_STARTTIME,TAG_EXPIRYTIME,TAG_ORDINAL,MASTER_ID,TAG_TYPE_ID,TAG_TYPE_ID_UNTRUNCATED,TAG_BIOCONFIG,
      TAG_GUARD_TOUR,TAG_ACCESS_OVERRIDE, TAG_DELETE_ON_EXPIRE,CARD_ID,TAG_ISSUE_NO,TAG_ISSUE_DATE,TAG_ENCODING_TYPE_ID,TAG_DISPLAY,
      TAG_MOBILE_ACCESS_IDENTIFIER,TAG_BIOMETRIC,TRUNCATION_FORMAT_ID,TAG_CODE_UNTRUNCATED_NUM_BITS,PLUGIN_MANAGER_TYPE_ID,
      TAG_ISDURESS,TAG_BYPASS_FINGER_TOC,TAG_CARD_WRITE_DATE) 
    VALUES (${lastTagId + 1},'${tagCode}','${tagCode}',0,1,0,0,0,0,0,0,0,1,'${masterId}',15,9,NULL,0,0,0,NULL,0,NULL,1,'${tagCode}',NULL,0,NULL,40,NULL,0,0,NULL);`

    let { rowsAffected } = await poolIncedo.query(query);
    return rowsAffected[0]
  } catch (error) {
    throw error; 
  }
}

async function getLastMasterId() {
  let query = `SELECT TOP(1) m.MASTER_ID id
  FROM  MASTER m ORDER by m.MASTER_ID DESC`;
  try {
    let { recordset } = await poolIncedo.query(query);
    return recordset[0].id;
  } catch (error) {
    throw error;
  }
}

async function getLastTagId() {
  let query = `SELECT TOP(1) t.TAG_ID id
  FROM TAG t ORDER by t.TAG_ID DESC`;
  try {
    let { recordset } = await poolIncedo.query(query);
    return recordset[0].id;
  } catch (error) {
    throw error;
  }
}
async function getLastMasterGroupId() {
  let query = `SELECT TOP(1) mg.MASTER_GROUP_ID id
  FROM MASTER_GROUP mg ORDER by mg.MASTER_GROUP_ID DESC`;
  try {
    let { recordset } = await poolIncedo.query(query);
    return recordset[0].id;
  } catch (error) {
    throw error;
  }
}

module.exports = { getUnsyncedUsers, getAuthToken, performAPIRequest, getUserIdByMatricol, getTagsIdsByMasterId, setRequiredStatusToFalse, insertUser, insertUserTag, insertUserMasterGroup };
