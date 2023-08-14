import React, { Fragment, useState } from "react";
import { Delete } from "@mui/icons-material";

import TimePicker from "../components/TimePicker";
import Confirm from "../components/Confirm";
import Pagination from "../components/Pagination";
import EditNumber from "../components/Edit/EditNumber";
import EditString from "../components/Edit/EditString";
import EditDate from "../components/Edit/EditDate";
import EditBool from "../components/Edit/EditBool";
import AutoComplete from "../components/AutoComplete";
import DownloadTable from "../components/DownloadTable/DownloadTable";
import { useNavigate } from "react-router-dom";
import AdvancedTable from "../components/AdvancedTable/AdvancedTable";

const downloadHeaders = [{name:'ID',field:'id',type:'number'},
{name:'Nume',field:'name',type:'string'}];

const headers = [{name:'ID',usefilter:true,field:'id',type:'number',dontadd:true,readonly:true},
{name:'Nume',usefilter:true,field:'name',type:'string',mandatoryadd:true,readonly:true,maxlength:60}];


function Demo (props) {
    const [time, setTime] = useState(20);
    const [page, setPage] = useState(18);
    const [pageCount, setPageCount] = useState(100);
	const navigate = useNavigate();

    const changePage = (newPage) => {
      setPage(newPage);
    }

    const headers = [{name:'ID',field:'id',type:'number',useFilter:true},
  {name:'Nume',field:'lastName',type:'string',useFilter:true},
  {name:'Prenume',field:'firstName',type:'string',useFilter:true},
  {name:'Matricol',field:'matricol',type:'number',useFilter:true},
  {name:'Detalii',useFilter:true,type:'string',field:'val'},
  {name:'Data',field:'stamp',type:'datetime',printasdatetime:true,readOnly:true,useFilter:true},
  {name:'ID User',field:'userid',type:'number',useFilter:true}];

  const downloadHeaders = [{name:'ID',field:'id',type:'number'},
  {name:'Data',field:'stamp',type:'datetime'},
  {name:'Detalii',type:'string',field:'val'},
  {name:'Matricol',field:'matricol',type:'number'},
  {name:'Nume Utilizator',field:'userid',type:'option',url:'users_get',text:'Selectati utilizator',idField:'id',printField1:'name',printField2:'matricol'}]

    return (
        <Fragment>
            <div style={{ display: "block", marginLeft: "auto", marginRight: "auto", textAlign: "center", maxWidth: "750px" }}>
                <div style={{border: "2px solid black", borderRadius: "8px", padding: "5px" }}>
                    <TimePicker time={time} onFinish={() => {setTime((prevTime) => prevTime+1)}} />
                </div>
                <br></br>
                <div style={{border: "2px solid black", borderRadius: "8px" }}>
                    <Confirm icon={<Delete />} color="rgb(255, 88, 88)" confirm={() => console.log(1)} />
                </div>
                <br></br>
                <div style={{border: "2px solid black", borderRadius: "8px" }}>
                    <Pagination page={page} pageCount={pageCount} changePage={changePage}/>
                </div>
                <br></br>
                <div style={{border: "2px solid black", borderRadius: "8px" }}>
                    <EditNumber number={20} min={15} max={30} onFinish={() => {}} makeRoundingOnSubmit isHalfHour />
                </div>
                <br></br>
                <div style={{border: "2px solid black", borderRadius: "8px" }}>
                    <EditString text="ceva" maxLength={5} />
                </div>
                <br></br>
                <div style={{border: "2px solid black", borderRadius: "8px" }}>
                    <EditDate type="datetime-local" timestamp={Date.now()} onFinish={() => {}} />
                </div>
                <br></br>
                <div style={{border: "2px solid black", borderRadius: "8px" }}>
                    <EditBool value={true} onFinish={() => {}} />
                </div>
                <br></br>
                <div style={{border: "2px solid black", borderRadius: "8px" }}>
                    <AutoComplete url="permissions_get" printField1="name" idField="id" needsConfirmation={false} />
                </div>
                <br></br>
                <div style={{border: "2px solid black", borderRadius: "8px" }}>
                    <DownloadTable apiGet="units_get" headers={headers} downloadHeaders={downloadHeaders} />
                </div>
                <AdvancedTable get="audit_get" headers={headers} downloadHeaders={downloadHeaders} />
            </div>
        </Fragment>
    );
}

export default Demo;