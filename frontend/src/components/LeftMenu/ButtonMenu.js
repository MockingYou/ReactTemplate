import React, { useEffect, useState } from "react";
import { Outlet, Link } from "react-router-dom";


const ButtonMenu = (props) => {
    // const [click1,setClick1] = useState(props.click1);
    


    // console.log("child rerender");
    // console.log(props.currentPage);


    const onClick =  () =>{
        const func =  props.passEv2;
        const val =  func();
    }


    
    const isAdmin = props.opt
    
    return (
        <>
            {!isAdmin &&
                <>
                    
                    <Link to={props.page} onClick={() => onClick()}  className= {(props.currentPage == props.title) ? "menubutton menubuttonselected" : "menubutton"}>
                        <span>{props.title}</span>

                        <span className="menuIcon">
                            {props.icon}
                        </span>

                    </Link>
                    <br/>
                </>
            }
             {/* pentru cont admin shift left icons  */}
            {isAdmin &&
                <>
                    <Link to="/" onClick={() => onClick()} className= {(props.currentPage == props.title) ? "menubutton menubuttonselected" : "menubutton"}>
                        <span>{props.title}</span>

                        <span className="menuIcon" style={{paddingRight: "17px"}}>
                            {props.icon}
                        </span>

                    </Link>
                    <br/>
                </>
            }
            
           
        </>
    );
}

export default ButtonMenu;
