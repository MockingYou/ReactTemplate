import React from "react";
import { Done } from "@mui/icons-material";

import "../../../styles.css";

const EditDoneButton = (props) => {
  return (
    <span
      onMouseDown={props.finishHandler}
      className="material-icons iconbtnok iconconfirmleft"
    >
      <Done />
    </span>
  );
};

export default EditDoneButton;
