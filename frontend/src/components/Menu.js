import React, { Fragment } from "react";
import {SyncAlt} from "@mui/icons-material";

function Menu (props) {

	return (
		<Fragment>
			<div  className= {props.collapsed ? "leftmenu leftmenucollapsed" : "leftmenu"}>
				<div style={{height:"60px",width:"100%"}}>
					<img
						src="customer3.png"
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
		</Fragment>
	);
};


export default Menu;