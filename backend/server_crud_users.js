const { logerr,logwarn, log } = require("./server_utils");
const {
  getAuthToken,
  getUnsyncedUsers,
  performAPIRequest,
  getUserIdByMatricol,
  getTagsIdsByMasterId,
  setRequiredStatusToFalse,
  insertUser,
  insertUserTag,
  insertUserMasterGroup
} = require("./server_crud_utils");

async function add() {
  try {
    let requireAddUsers = await getUnsyncedUsers("add");
    let loginHeaders = await getAuthToken();
    return await addUsers(requireAddUsers, loginHeaders);
  } 
  catch (error) {
    throw (error);
  }
}
async function update() {
  try {
    let requireUpdateUsers = await getUnsyncedUsers("update");
    let loginHeaders = await getAuthToken();
    return await updateUsers(requireUpdateUsers, loginHeaders);
  } 
  catch (error) {
    throw (error);
  }
}

async function deleteU() {
  try {
    let requireDeleteUsers = await getUnsyncedUsers("delete");
    let loginHeaders = await getAuthToken();
    return await deleteUsers(requireDeleteUsers, loginHeaders);
  } 
  catch (error) {
    throw (error);
  }
}

function buildFinalLogString(operationsResults = []) {
  let printMessage = operationsResults.filter(result => typeof result != 'undefined')
  if (printMessage.length > 0) log(`USERS SYNC result: ` + printMessage.join(" | "))
}

// function which runs sync process
async function main() {
  try {
    let inserted = await add();
    let updated = await update();
    let removed = await deleteU();
    let operationsResults = [inserted, updated, removed]
    buildFinalLogString(operationsResults);
  } 
  catch (error) {
    logerr(error)
  }
}

/**
 * add users from assa abloy db in incedo db
 * @param {an array of users which will be inserted in Incedo System} users
 * @param {token and cookie required to perform API requests} loginHeaders
 */
async function addUsers(users = [], loginHeaders) {
  let insertedUsersIds = [];
  if (users.length > 0) {
    for (const user of users) {
      if (typeof user !== "undefined") {
        let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
          <protocol id="82945242" version="1.0" xsi:schemaLocation="http://www.identisoft.net/protocol 
            protocol.xsd" xmlns="http://www.identisoft.net/protocol" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <dbupdate>
              <Master id="0" current="1" displayName="${user.name}"  mstExpiryDate="0" firstName="${user.first_name}" 
                gender="M" idnumber="${user.matricol}" lastName="${user.last_name}" mstStartDate="0">
                <company id="1" />
                <department id="1" />
                ${user.cardid1.length > 0 ? `
                <tag id="0" startTime="0" startDate="0" tagCode="${user.cardid1}" expiryTime="0" suspendWithAlarm="0"
                   expiryDate="0" report="1" suspend="0" ordinal="1" specialEvent="0" tagCodeUntruncated="${user.cardid1}" tagDisplay="${user.cardid1}">
                  <tagType id="15" />
                  <tagTypeUntruncated id="15" />
                </tag>`: ""}
                ${user.cardid2.length > 0 ? `
                <tag id="0" startTime="0" startDate="0" tagCode="${user.cardid2}" expiryTime="0" suspendWithAlarm="0"
                   expiryDate="0" report="1" suspend="0" ordinal="1" specialEvent="0" tagCodeUntruncated="${user.cardid2}" tagDisplay="${user.cardid1}">
                  <tagType id="15" />
                  <tagTypeUntruncated id="15" />
                </tag>`: ""}
              </Master>
            </dbupdate>
          </protocol>`;
        try {
          let result = await performAPIRequest(loginHeaders, xml);
          if (result === "Success") {
            insertedUsersIds.push(user.id);
          }
        } 
        catch (error) {
          if (typeof error == "object") {
            logerr(error)
          } 
          else {
            if (error.includes("Error Constraint Violation : [ID must be unique,]")) {
              logerr(error)
              let userId = await getUserIdByMatricol(user.matricol);
              logerr(`userId = ${userId}`)
              if (userId === 0) {
                let result = await setRequiredStatusToFalse([user.id], "","","",1);
                logerr(`One of user cards is already in Incedo System.`)
                logerr(`[U111]sync_error set to true for user with matricol ${user.matricol}`)
              }
              else {
                try {
                  let result = await setRequiredStatusToFalse([user.id], 0, 1);
                  if (result === 1) {
                    log(`User with matricol ${user.matricol} already exist. User will be updated at next run.`)
                  }
                  else {
                    throw `Changing require_update status for user with matricol ${user.matricol} to 1 failed.`
                  }
                } 
                catch (error) {
                  throw (`At setRequiredStatusToFalse ${error}`)
                }
              }
            }
            if (error.includes(`Error Constraint Violation : [Your software license limits you to 5000 tagholders per site. This limit has been reached.`)) {
              let userInsertResult;
              let userMasterGroupInsertResult;
              let userCard1InsertResult;
              let userCard2InsertResult;
          
              try {
                logerr(error)
                log(`WORKAROUND: User and his tags will be inserted directly via sql insert query`)
                userInsertResult = await insertUser(user.first_name, user.last_name, user.matricol)
  
                if (userInsertResult == 1) {
                  log(`User with matricol: ${user.matricol} was inserted in MASTER table`)
                  userMasterGroupInsertResult = await insertUserMasterGroup(user.matricol)
  
                  if (userMasterGroupInsertResult == 1) {
                    log(`User with matricol: ${user.matricol} was inserted in MASTER_GROUP table`)
                    insertedUsersIds.push(user.id);
  
                    if (user.cardid1.length > 0) {
                      userCard1InsertResult = await insertUserTag(user.cardid1, user.matricol)
  
                      if (userCard1InsertResult == 1) {
                        log(`Card ${user.cardid1} of user with matricol: ${user.matricol} was inserted in TAG table`)
                      }
                    }
                    if (user.cardid2.length > 0) {
                      userCard2InsertResult = await insertUserTag(user.cardid2, user.matricol)
  
                      if (userCard2InsertResult == 1) {
                        log(`Card ${user.cardid2} of user with matricol: ${user.matricol} was inserted in TAG table`)
                      }
                    }
                  }
                } 
                else {
                  logerr(`User with matricol: ${user.matricol} was not inserted in MASTER table due to DB Connection problems`)
                  let result = await setRequiredStatusToFalse([user.id], "","","",1);
                  logerr(`[U164]sync_error set to true for user with matricol ${user.matricol}`)
                }
              } 
              catch (error) {
                logerr(error.message)
                if (error.message.includes(`Violation of UNIQUE KEY constraint 'UNQ_MST_IDENTITY'`)) {
                  logerr(`User with matricol ${user.matricol} is already inserted. He will be updated at next run`)
                  let result = await setRequiredStatusToFalse([user.id], 0, 1);
                }
              }
            }
          }
        }
      }
      else {
        throw (`User type is undefined`);
      }
    }
    if (insertedUsersIds.length > 0) {
      let result = await setRequiredStatusToFalse(insertedUsersIds, 0,"","", 0);
      return `INSERTED: ${result}/${users.length}`;
    } 
    else {
      return `INSERTED: 0/${users.length}`;
    }
  }
}

/**
 * update users from assa abloy db in incedo db
 * @param {an array of users which will be updated in Incedo System} users
 * @param {token and cookie required to perform API requests} loginHeaders
 */
async function updateUsers(users = [], loginHeaders) {
  let updatedUsersIds = [];
  if (users.length > 0) {
    for (const user of users) {
      try {
        let userId = await getUserIdByMatricol(user.matricol);
        if (userId !== 0) {
          let tagsIds = await getTagsIdsByMasterId(userId);

          let haveUserCard1 = user.cardid1.trim().length > 0 ? true : false
          let haveUserCard2 = user.cardid2.trim().length > 0 ? true : false

          let isCard1Inserted = tagsIds.some(tag => tag.tagCode === user.cardid1)
          let isCard2Inserted = tagsIds.some(tag => tag.tagCode === user.cardid2)

          let requireDeleteTags = tagsIds.filter(tag => tag.tagCode !== user.cardid1 && tag.tagCode !== user.cardid2)

          let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
          <protocol id="82945242" version="1.0" xsi:schemaLocation="http://www.identisoft.net/protocol 
            protocol.xsd" xmlns="http://www.identisoft.net/protocol" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <dbupdate>
              <Master id="${userId}" current="1" displayName="${user.name}" mstExpiryDate="0" firstName="${user.first_name}" 
                gender="M" idnumber="${user.matricol}" lastName="${user.last_name}" mstStartDate="0">
                <company id="1" />
                <department id="1" />
                ${haveUserCard1 && !isCard1Inserted ? `
                <tag id="0" startTime="0" startDate="0" tagCode="${user.cardid1}" expiryTime="0" suspendWithAlarm="0" 
                  expiryDate="0" report="1" suspend="0" ordinal="1" specialEvent="0" tagCodeUntruncated="${user.cardid1}" tagDisplay="${user.cardid1}">
                  <tagType id="15" />
                  <tagTypeUntruncated id="15" />
                </tag>`: ""}
                ${haveUserCard2 && !isCard2Inserted ? `
                <tag id="0" startTime="0" startDate="0" tagCode="${user.cardid2}" expiryTime="0" suspendWithAlarm="0" 
                  expiryDate="0" report="1" suspend="0" ordinal="1" specialEvent="0" tagCodeUntruncated="${user.cardid2}" tagDisplay="${user.cardid1}">
                  <tagType id="15" />
                  <tagTypeUntruncated id="15" />
                </tag>`: ""}
              </Master>
            </dbupdate>
          </protocol>`;
          try {
            let result = await performAPIRequest(loginHeaders, xml);
            if (result === "Success") {
              updatedUsersIds.push(user.id);
              for (const tag of requireDeleteTags) {
                let deleteCardXml = `<protocol id="1" version="1.0" xsi:schemaLocation="http://www.identisoft.net/protocol 
                  protocol.xsd" xmlns="http://www.identisoft.net/protocol" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
                  <dbupdate>
                    <tag id="-${tag.id}">
                    </tag>
                  </dbupdate>
                </protocol>`;
                try {
                  let res = await performAPIRequest(loginHeaders, deleteCardXml);
                  log(`card ${tag.tagCode} detected: ${res}`);
                } 
                catch (error) {
                  logerr(error);
                }
              }
            }
          } 
          catch (error) {
            if (typeof error == "object") {
              logerr(error);
            } 
            else {
              if (error.includes(`Error Constraint Violation : [A tag with untruncated tag code`)) {
                logwarn(error)
                try {
                  let result = await setRequiredStatusToFalse([user.id], "","","",1);
                  logwarn(`[U263]sync_error set to true for user with matricol ${user.matricol}`)
                } 
                catch (error) {
                  logerr(error)
                }
              }
              if (error.includes(`Error Constraint Violation : [A tag with tag code`)) {
                logerr(error)
                try {
                  let result = await setRequiredStatusToFalse([user.id], "","","",1);
                  logerr(`[U272]sync_error set to true for user with matricol ${user.matricol}`)
                } 
                catch (error) {
                  logerr(error)
                }
              }
              if (error.includes(`Error Constraint Violation : [Cards per site limit reached. (Maximum: 10,000),]`)) {
                logerr(error)
                let userCard1InsertResult
                let userCard2InsertResult
                try {
                  if (haveUserCard1 && !isCard1Inserted) {
                    logerr(`Card ${user.cardid1} of user with matricol ${user.matricol} will be inserted in TAG table`)
                    userCard1InsertResult = await insertUserTag(user.cardid1, user.matricol)
                    userCard1InsertResult == 1 ? log(`Tag was inserted`) : logerr(`Tag was not inserted`)
                  }
                  if (haveUserCard2 && !isCard2Inserted) {
                    logerr(`Card ${user.cardid2} of user with matricol ${user.matricol} will be inserted in TAG table`)
                    userCard2InsertResult = await insertUserTag(user.cardid2, user.matricol)
                    userCard2InsertResult == 1 ? log(`Tag was inserted`) : logerr(`Tag was not inserted`)
                  }
                } 
                catch (error) {
                  logerr(error)
                }
                if (userCard2InsertResult == 1 || userCard1InsertResult == 1) {
                  for (const tag of requireDeleteTags) {
                    let deleteCardXml = `<protocol id="1" version="1.0" xsi:schemaLocation="http://www.identisoft.net/protocol 
                      protocol.xsd" xmlns="http://www.identisoft.net/protocol" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
                      <dbupdate>
                        <tag id="-${tag.id}">
                        </tag>
                      </dbupdate>
                    </protocol>`;
                    try {
                      let res = await performAPIRequest(loginHeaders, deleteCardXml);
                      log(`card ${tag.tagCode} detected: ${res}`);
                    } 
                    catch (error) {
                      logerr(error);
                    }
                  }
                }
              }
            }
          }
        } 
        else {
          logerr(`User with matricol ${user.matricol} not found in Incedo DB. User will be inserted at next run`);
          let result = await setRequiredStatusToFalse([user.id], 1);
        }
      } 
      catch (error) {
        throw (`At updateUsers(): ${error}`);
      }
    }
    if (updatedUsersIds.length > 0) {
      let result = await setRequiredStatusToFalse(updatedUsersIds, "", 0,"",0);
      return `UPDATED: ${result}/${users.length}`;
    } 
    else {
      return `UPDATED: 0/${users.length}`;
    }
  }
}

/**
 * detele users from assa abloy db in incedo db
 * @param {an array of users which will be deleted from Incedo System} users
 * @param {token and cookie required to perform API requests} loginHeaders
 */
async function deleteUsers(users = [], loginHeaders) {
  let deletedUsersIds = [];
  if (users.length > 0) {
    for (const user of users) {
      try {
        let userId = await getUserIdByMatricol(user.matricol);
        if (userId !== 0) {
          let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <protocol id="1" version="1.0" xsi:schemaLocation="http://www.identisoft.net/protocol 
              protocol.xsd" xmlns="http://www.identisoft.net/protocol" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
              <dbupdate>
                <Master id="-${userId}">
                </Master>
              </dbupdate>
            </protocol>`;
          let result = await performAPIRequest(loginHeaders, xml);
          if (result === "Success") {
            deletedUsersIds.push(user.id);
          }
        } 
        else {
          log(`User with matricol ${user.matricol} seems to be already deleted from Incedo System. require_delete set to 0.`);
          deletedUsersIds.push(user.id);
        }
      } 
      catch (error) {
        throw error;
      }
    }
    if (deletedUsersIds.length > 0) {
      let result = await setRequiredStatusToFalse(deletedUsersIds, "", "", 0,);
      return `REMOVED: ${result}/${users.length}`;
    } 
    else {
      return `REMOVED: 0/${users.length}`;
    }
  }
}

module.exports.syncUsers = main;
