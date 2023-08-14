import React, { Fragment, useState } from "react";

import EditStartButton from "./EditUtils/EditStartButton";
import EditCloseButton from "./EditUtils/EditCloseButton";
import EditDoneButton from "./EditUtils/EditDoneButton";
import EditText from "./EditUtils/EditText";
import Loading from "../utils/Loading";

import { isValidDigit } from "../../helper_functions";

// import "../../bootstrap.min.css";

const MIN_LIMIT = 0;
const MAX_LIMIT = 999999999999;

const EditNumber = (props) => {
  const [active, setActive] = useState(false);
  const [newNumber, setNewNumber] = useState(
    typeof props.number === "undefined" ? 0 : parseInt(props.number)
  );
  const [lastValidNumber, setLastValidNumber] = useState(newNumber);
  const [minNumber, setMinNumber] = useState(MIN_LIMIT);
  const [maxNumber, setMaxNumber] = useState(MAX_LIMIT);

  const STYLE = {
    ...props.style,
    border: "1px solid grey"
  }

  const startHandler = () => {
    setActive(true);
    if (typeof props.min === "number") {
      setMinNumber(Math.max(MIN_LIMIT, props.min));
    }
    if (typeof props.max === "number") {
      setMaxNumber(Math.min(MAX_LIMIT, props.max));
    }
    if (typeof props.number === "string") {
      setNewNumber(parseInt(props.number));
    }
    if (isNaN(newNumber)) {
      setNewNumber(minNumber);
    }
    if (typeof newNumber === "number") {
      setLastValidNumber(newNumber);
    }
  };

  const inputHandler = (event) => {
    if (event.target.value === "") {
      setNewNumber("");
    } else {
      let inputNum = parseInt(event.target.value) * (props.isHalfHour ? 2 : 1);
      if (!props.makeRoundingOnSubmit) {
        inputNum = Math.min(maxNumber, Math.max(inputNum, minNumber));
      }
      setNewNumber((prevNumber) => inputNum + prevNumber % 2);
    }
  };

  const checkboxInputHandler = (event) => {
    if (event.target.checked) {
      setNewNumber((prevNumber) => prevNumber + 1)
    } else {
      setNewNumber((prevNumber) => prevNumber - 1)
    }
  };

  const checkInputHandler = (event) => {
    if (!isValidDigit(event.keyCode)) {
      event.preventDefault();
    }
  };

  const finishHandler = () => {
    if (typeof newNumber === "number") {
      if (props.makeRoundingOnSubmit) {
        let roundedNumber = Math.min(maxNumber, Math.max(newNumber, minNumber));
        setNewNumber(roundedNumber);
        console.log("ALERT! Numarul schimbat a fost rotunjit la limita (minima/maxima) deoarece valoarea introdusa depasea limita.");
      }
      if (typeof props.onFinish === "function") {
        props.onFinish(newNumber);
      }
      setActive(false);
    }
  };

  const cancelHandler = () => {
    setActive(false);
    setNewNumber(lastValidNumber);
  };

  return (
    <Fragment>
      {active && (
        <div style={{ whiteSpace: "nowrap" }}>
          <input
            value={parseInt(newNumber / (props.isHalfHour ? 2 : 1))}
            onChange={inputHandler}
            onKeyDown={(event) => checkInputHandler(event)}
            type="number"
            style={STYLE}
            className="form-control me-sm-1"
          />
          {typeof props.isHalfHour !== "undefined" && (
            <div className="checkboxHalfHour" style={{ whiteSpace: "nowrap" }}>
              <label style={{ whiteSpace: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={newNumber % 2 === 1}
                  onChange={checkboxInputHandler}
                  style={{ whiteSpace: "nowrap" }}
                />
                <span style={{ whiteSpace: "nowrap" }}>
                  {newNumber % 2 === 1 ? ":30" : "00"}
                </span>
              </label>
            </div>
          )}
        </div>
      )}
      {!active && (
        <EditText
          startHandler={startHandler}
          text={parseInt(newNumber / (props.isHalfHour ? 2 : 1))}
          isHalfHour={props.isHalfHour}
          readOnly={props.readOnly}
        />
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

export default EditNumber;
