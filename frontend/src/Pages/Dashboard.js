import React, { Fragment, useEffect, useState } from "react";
import Card from "../components/Dashboard/Card";
import ChartStart from "../components/Dashboard/ChartStart";
import axios from "axios";


const Dashboard = (props) =>{
    const [statebackend, setStatebackend] = useState("OFFLINE")
	const [statedatabase, setStatedatabase] = useState("OFFLINE")
	const [statetasks, setStatetasks] = useState("OFFLINE")

    const getStateInfo = () =>{
        axios.get(encodeURI("getdashdata2"))
        .then(function(response)
        {
            if(response.data.error.startsWith("login"))
            {
                console.log("not logged")
                // window.location.replace("login.html");
                return;
            }
            else if(response.data.error.length>0)
            {   console.log(response.data.error);

                // root.alert(response.data.error,"Eroare la actualizarea starilor");
                setStatebackend('OFFLINE')
                setStatedatabase('OFFLINE')
                setStatetasks('OFFLINE')
            }
            else
            {
                let be = response.data.statusbackend;
                let db = response.data.statusdb;
                let tasks = response.data.statustasks;
                // console.log(be);
                // console.log(db);
                // console.log(tasks);



                setStatebackend(be?'ONLINE':'OFFLINE')
                setStatedatabase(db?'ONLINE':'OFFLINE')
                setStatetasks(tasks?'ONLINE':'OFFLINE')
            }
        },
        function(response) {
            console.log('error');
            console.log(response)
            setStatebackend('OFFLINE')
            setStatedatabase('OFFLINE')
            setStatetasks('OFFLINE')
            // root.alert(error.statusText+" "+error.xhrStatus,"Eroare de conexiune");
        });

    }
    useEffect(() => {
        getStateInfo();
      }, []);


    return (
        <>
            <div style={{width: "100%", textAlign: "center", marginBottom: "50px"}}>
                <Card state={statebackend}  color={statebackend==="OFFLINE"?"rgb(230, 0, 0)":'rgb(153, 255, 153)'} name="Stare Backend"/>
                <Card state={statedatabase} color={statebackend==="OFFLINE"?"rgb(230, 0, 0)":'rgb(153, 255, 153)'} name="Stare Baza de Date"/>
                <Card state={statetasks} color={statebackend==="OFFLINE"?"rgb(230, 0, 0)":'rgb(153, 255, 153)'} name="Stare Tasks"/>
            </div>
            <ChartStart/>
        </>
    );
};


export default Dashboard;