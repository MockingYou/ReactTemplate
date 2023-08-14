import React, { Fragment, useState } from "react";

import EditStartButton from "./EditUtils/EditStartButton";
import EditCloseButton from "./EditUtils/EditCloseButton";
import EditDoneButton from "./EditUtils/EditDoneButton";
import EditText from "./EditUtils/EditText";
import Loading from "../utils/Loading";

import { isValidCharacter } from "../../helper_functions";

const EditString = (props) => {
  const [active, setActive] = useState(false);
  const [newText, setNewText] = useState(
    typeof props.text === "undefined" ? "" : props.text
  );
  const [lastValidText, setLastValidText] = useState(newText);
  const STYLE = {
    ...props.style,
    border: "1px solid grey"
  }

  const startHandler = () => {
    setActive(true);
    if (typeof newText === "string") {
      setLastValidText(newText);
    }
  };

  const inputHandler = (event) => {
    const textInput = event.target.value;
    if (typeof props.maxLength === "number") {
      if (textInput.length > props.maxLength) {
        setNewText(textInput.slice(0, props.maxLength - textInput.length));
      } else {
        setNewText(textInput);
      }
    } else {
      setNewText(textInput);
    }
  };

  const checkInputHandler = (event) => {
    if (!isValidCharacter(event.keyCode)) {
      event.preventDefault();
    }
  };

  const finishHandler = () => {
    if (typeof props.onFinish === "function") {
      props.onFinish(newText);
    }
    setActive(false);
  };

  const cancelHandler = () => {
    setActive(false);
    setNewText(lastValidText);
  };

  return (
    <Fragment>
      {active && (
        <input
          value={newText}
          onChange={inputHandler}
          onKeyDown={(event) => checkInputHandler(event)}
          style={STYLE}
          className="form-control me-sm-1"
        />
      )}
      {!active && (
        <EditText startHandler={startHandler} text={newText} readOnly={props.readOnly} />
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

export default EditString;
