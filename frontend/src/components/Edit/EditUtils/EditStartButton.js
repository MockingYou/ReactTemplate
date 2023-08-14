import React from "react";
import { Edit } from "@mui/icons-material";

import "../../../styles.css";

const EditButton = (props) => {
  return (
    <span onMouseDown={props.startHandler} className="material-icons iconbtnok">
      <Edit />
    </span>
  );
};

export default EditButton;
