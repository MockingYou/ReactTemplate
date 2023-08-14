import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import {Link,Outlet} from "react-router-dom";


import {SyncAlt} from "@mui/icons-material";
import ButtonMenu from "./ButtonMenu";

import {DashboardCustomizeOutlined, Calculate, Code, Help} from '@mui/icons-material';
import {PendingActions, BarChart, CastConnected, EventRepeat, GroupAdd, CoPresent, Surfing, AppRegistration} from '@mui/icons-material';
import {Apartment, History, PhonelinkRing, DesignServices, AdminPanelSettings, SettingsAccessibility} from '@mui/icons-material';
import {VpnKey,Logout,ManageAccounts} from '@mui/icons-material';

var adminOpt = [
	{page:"/Logout", 			title:"Logout", 			icon:<Logout sx={{ fontSize: 24 }}/>, 			visible: false,	click1: false},
	{page:"/SchimbareParola", 	title:"Schimbare parola",   icon:<VpnKey sx={{ fontSize: 24 }}/>, 			visible: false,	click1: false},
	{page:"/SchimbareUser",   	title:"Schimbare user",  	icon:<ManageAccounts sx={{ fontSize: 24 }}/>, 	visible: false,	click1: false},
];

var arr2=[
	{page:"/dashboard", title:"Dashboard",          	 icon:<DashboardCustomizeOutlined sx={{ fontSize: 24 }}/>,	pageName : "p_dashboard", 		visible: false,	click1: false},
	{page:"/Clocking", title:"Pontare",        			 icon:<PendingActions sx={{ fontSize: 24 }}/>, 				pageName : "p_clocking", 		visible: false,	click1: false},
	{page:"/Reports",   title:"Rapoarte",             	 icon:<BarChart sx={{ fontSize: 24 }}/>, 					pageName : "p_reports", 		visible: false,	click1: false},
	{page:"/Scans",     title:"Scanari",               	 icon:<CastConnected sx={{ fontSize: 24 }}/>, 				pageName : "p_scans", 			visible: false,	click1: false},
	{page:"/EditClocking", title:"Editare pontaj", 		 icon:<EventRepeat sx={{ fontSize: 24 }}/>, 				pageName : "p_editclocking", 	visible: false,	click1: false},
	{page:"/Emploees",  title:"Angajati",            	 icon:<GroupAdd sx={{ fontSize: 24 }}/>, 					pageName : "p_emploees", 		visible: false,	click1: false},
	{page:"/Present",  title:"Prezenta",            	 icon:<CoPresent sx={{ fontSize: 24 }}/>, 					pageName : "p_present", 		visible: false,	click1: false},
	{page:"/Vacations", title:"Concedii si Activitati",  icon:<Surfing sx={{ fontSize: 24 }}/>, 					pageName : "p_vacations", 		visible: false,	click1: false},
	{page:"/EditOvertime", title:"Modif. Ore Suplim.",   icon:<AppRegistration sx={{ fontSize: 24 }}/>, 			pageName : "p_editovertime", 	visible: false,	click1: false},
	{page:"/Departments", title:"Departamente",  		 icon:<Apartment sx={{ fontSize: 24 }}/>, 					pageName : "p_departments",		visible: false,	click1: false},
	{page:"/History", title:"Istoric",  				 icon:<History sx={{ fontSize: 24 }}/>, 					pageName : "p_history",			visible: false,	click1: false},
	{page:"/Terminals", title:"Terminale",     			 icon:<PhonelinkRing sx={{ fontSize: 24 }}/>, 				pageName : "p_terminals",		visible: false,	click1: false},
	{page:"/Configs", title:"Configurare",    			 icon:<DesignServices  sx={{ fontSize: 24 }}/>,				pageName : "p_configs", 		visible: false,	click1: false},
	{page:"/Admin", title:"Administrare",  				 icon:<AdminPanelSettings sx={{ fontSize: 24 }}/>,	 		pageName : "p_admin", 			visible: false,	click1: false},
	{page:"/Permissions", title:"Permisiuni",  			 icon:<SettingsAccessibility sx={{ fontSize: 24 }}/>, 		pageName : "p_permissions", 	visible: false,	click1: false},
	{page:"/Finance", title:"Financiar", 				 icon:<Calculate sx={{ fontSize: 24 }}/>, 					pageName : "p_finance", 		visible: false,	click1: false},
	{page:"/Audit", title:"Audit",          			 icon:<Code sx={{ fontSize: 24 }}/>, 						pageName : "p_audit", 			visible: false,	click1: false},
	{page:"/Help", title:"Ajutor",          			 icon:<Help sx={{ fontSize: 24 }}/>, 						pageName : "p_dashboard", 		visible: false,	click1: false}

	// {page:"/Locations", title:"OLD Locatii",    template:"Pages/Locations.html",icon:"location_city"},
	// {page:"/Holidays",  title:"OLD Sarbatori",  template:"Pages/Holidays.html",icon:"event"},

];


const LeftMenu = (props) => {

	const [pageHeight,setPageHeight] = useState("");

	const [pagenames,setPagenames] = useState(arr2);

	const [currentPage,setCurrentPage] = useState("");

	// const navigate = useNavigate();


	const changePage = (title) =>{
		setCurrentPage(title)
		console.log("parrent:");
		console.log(currentPage);
		return currentPage;
	}



	useEffect(() => {
		setPageHeight(window.innerHeight - 335 + "px");
		// console.log(typeof(pageHeight));
		// console.log(window.innerHeight - 335 + "px");

		const handleResize = () => {
			setPageHeight(window.innerHeight - 335 + "px");
		}
		window.addEventListener("resize", handleResize);

		// console.log(window.innerWidth);

		return () => {
			window.removeEventListener("resize", handleResize)
		}

	},[]);

    return (
			<>
				<div  className= {props.collapsed ? "leftmenu leftmenucollapsed" : "leftmenu"}>
					<div style={{height:"60px",width:"100%"}}>
						<img
							src="customer.png"
							style={{width:"205px",paddingLeft:"0px",paddingRight:"10px",paddingTop:"0px",paddingBottom:"10px"}}
							draggable="false"
							alt=""
						/>
						<SyncAlt
							onClick ={ () => props.Collapse() }
							style={{position:"relative",float:"right",marginRight:"20px",marginTop: "10px",cursor:"pointer", fontSize: "35px"}}
							className="syncalt"
							/>
					</div>

					<hr style={{border: '5px solid white' , borderRadius: '20px' , margin:'0px'}}>
					</hr>

					<h2 style={{fontSize: "16px",
								margin: '5px',
								lineHeight: '32px',
								borderLeft: '3px solid #eb9f1d00',
								color: 'rgb(255, 255, 255)',
								textDecoration: 'none',
								fontWeight: 'bold',
								fontFamily: 'Arial, Helvetica, sans-serif'}}
						onClick={() => console.log("ghe")}>
						Cont Admin
					</h2>

					<div>
						{
							adminOpt.map((opt) =>(
								<ButtonMenu passEv2={() => changePage(opt.title)} currentPage={currentPage} page={opt.page} title={opt.title} icon = {opt.icon} opt={true}/>
							))
						}
					</div>

					<hr style={{border: '5px solid white' , borderRadius: '20px' , margin:'0px'}}>
					</hr>

					<div style = {{overflowY:'auto',  maxHeight: pageHeight }}>
						{pagenames.map((page) =>(
							<ButtonMenu passEv2={() => changePage(page.title)} currentPage={currentPage} page={page.page} title={page.title} icon={page.icon} opt={false}/>
						))}
					</div>

					{props.collapsed ? null : <div style={{fontFamily: "Arial, Helvetica, sans-serif",height:"70px",position:"absolute",width:"100%",bottom:"40px",textAlign: "center"}}>
						<img
							src="logo.png"
							style={{maxWidth:"90%",height:"60px",padding:"0px"}}
							alt=""
						/>
						<br />
						<span style={{color: "white",fontWeight: "400"}}>Adresa noua:</span><br /><a href="https://pontaj.ad.cnab.ro">https://pontaj.ad.cnab.ro</a>
					</div>}
			</div>
				
		</>
    );
}

export default LeftMenu;
