import React, { useEffect, useState } from "react";

const Card = (props) =>{
    let green = "rgb(153, 255, 153)";
    let red = "rgb(230, 0, 0)";

    return (

        <div class="card1" style={{backgroundColor: props.color , marginTop:'40px' , display: 'inline-block' , border: '1px solid #aca6a6',marginLeft: "2px",marginRight: "2px"}}>
            <b style={{fontSize: '30px' , textAlign: 'center'}}>{props.name}</b>
            <br></br>
            <br></br>
            <span class="material-icons" style={{float: 'center' , fontSize: '50px', marginTop: '-15px'}}>dvr</span>
            <b style={{float: 'right' , fontSize: '25px'}}><span>{props.state}</span></b>
        </div>

    );
};

export default Card;