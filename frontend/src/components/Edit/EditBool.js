import React, { Fragment, useState } from "react";
import { CheckBox, CheckBoxOutlineBlank } from "@mui/icons-material";

import EditStartButton from "./EditUtils/EditStartButton";
import EditCloseButton from "./EditUtils/EditCloseButton";
import EditDoneButton from "./EditUtils/EditDoneButton";
import Loading from "../utils/Loading";

import "../../bootstrap.min.css";
import "../../styles.css";

const EditBool = (props) => {
  const [active, setActive] = useState(false);
  const [newValue, setNewValue] = useState(props.value);
  const [lastValidValue, setLastValidValue] = useState(newValue);

  const STYLE = {
    ...props.style,
  }

  const startHandler = () => {
    setActive(true);
    if (typeof newValue === "boolean") {
      setLastValidValue(newValue);
    }
  };

  const inputHandler = () => {
    setNewValue((prevValue) => !prevValue);
  };

  const finishHandler = () => {
    if (typeof props.onFinish === "function") {
      props.onFinish(newValue);
    }
    setActive(false);
  };

  const cancelHandler = () => {
    setActive(false);
    setNewValue(lastValidValue);
  };

  return (
    <Fragment>
      {active && (
        <input
          value={newValue}
          checked={newValue}
          onChange={inputHandler}
          type="checkbox"
          style={STYLE}
        />
      )}
      {!active && (
        <span
          onMouseDown={!props.readOnly ? startHandler : undefined}
          className="orderbyicon material-icons"
          style={{ color: "#78B2FF" }}
        >
          {newValue ? <CheckBox /> : <CheckBoxOutlineBlank />}
        </span>
      )}
      <Loading isLoading={props.isLoading} />
      {!active && !props.isLoading && !props.readOnly && (
        <EditStartButton startHandler={startHandler} />
      )}
      {active && <EditCloseButton cancelHandler={cancelHandler} />}
      {active && <EditDoneButton finishHandler={finishHandler} />}
    </Fragment>
  );
};

export default EditBool;
