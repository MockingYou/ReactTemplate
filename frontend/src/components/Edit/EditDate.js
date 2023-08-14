import React, { useState, Fragment } from "react";

import EditStartButton from "./EditUtils/EditStartButton";
import EditCloseButton from "./EditUtils/EditCloseButton";
import EditDoneButton from "./EditUtils/EditDoneButton";
import EditText from "./EditUtils/EditText";
import Loading from "../utils/Loading";

import "../../bootstrap.min.css";

const EditDate = (props) => {
  const [active, setActive] = useState(false);
  const [newDate, setNewDate] = useState(
    typeof props.timestamp === "number" ? new Date(props.timestamp) :
    typeof props.timestamp === "string" ? new Date(parseInt(props.timestamp)) : new Date()
  );
  const [lastValidDate, setLastValidDate] = useState(newDate);

  const STYLE={
    width: props.type === "date" ? "140px" : "250px",
    padding: "5px",
    height: "32px",
    display: "inline-block",
    ...props.style,
  }

  const getPrintableDate = () => {
    const offsetMilliseconds = newDate.getTimezoneOffset() * 60 * 1000;
    let printDate = new Date(newDate.getTime() - offsetMilliseconds);

    if (props.type === "date") {
      return printDate.toISOString().split("T")[0];
    } else if (props.type === "datetime-local") {
      return printDate.toISOString().replace("T", " ").split(".")[0];
    } else {
      return "-";
    }
  };

  const startHandler = () => {
    setActive(true);
    setLastValidDate(newDate);
  };

  const inputHandler = (event) => {
    setNewDate(new Date(event.target.value));
  };

  const finishHandler = () => {
    if (typeof props.onFinish === "function") {
      props.onFinish(newDate.getTime());
    }
    setActive(false);
  };

  const cancelHandler = () => {
    setActive(false);
    setNewDate(lastValidDate);
  };

  return (
    <Fragment>
      {active && (
        <input
          required
          value={getPrintableDate()}
          onChange={inputHandler}
          type={props.type}
          style={STYLE}
          className="form-control me-sm-1"
        />
      )}
      {!active && (
        <EditText startHandler={startHandler} text={getPrintableDate()} readOnly={props.readOnly} />
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

export default EditDate;
