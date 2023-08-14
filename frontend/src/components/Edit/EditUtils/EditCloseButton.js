import React from "react";
import { Close } from "@mui/icons-material";

import "../../../styles.css";

const EditCloseButton = (props) => {
  return (
    <span
      onMouseDown={props.cancelHandler}
      className="material-icons iconbtncancel iconconfirmright"
    >
      <Close />
    </span>
  );
};

export default EditCloseButton;
