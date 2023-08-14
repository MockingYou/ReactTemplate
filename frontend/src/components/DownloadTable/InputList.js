import React, { Fragment, useState, useEffect } from "react";

import AutoComplete from "../AutoComplete";
import InputField from "./InputField";
import DateInputField from "./DateInputField";

import { isValidCharacter, isValidDigit } from "../../helper_functions";

const InputList = (props) => {
  const [filter, setFilter] = useState(props.filter);

  useEffect(() => {
    props.changeInputHandler(filter);
  }, [filter]);

  const inputTextHandler = (event, headerField) => {
    const textInput = event.target.value;
    setFilter((prevFilter) => ({
      ...prevFilter,
      [headerField]: textInput,
    }));
  };

  const inputDateHandler = (event, headerField, isMinDate) => {
    const dateInput = new Date(event.target.value).getTime();
    const initialDates = filter[headerField];
    const updateDateType = isMinDate ? "min" : "max";

    setFilter((prevFilter) => ({
      ...prevFilter,
      [headerField]: {
        ...initialDates,
        [updateDateType]: dateInput,
      },
    }));
  };

  const checkStringInputHandler = (event) => {
    if (!isValidCharacter(event.keyCode)) {
      event.preventDefault();
    }
  };

  const checkNumberInputHandler = (event) => {
    if (!isValidDigit(event.keyCode)) {
      event.preventDefault();
    }
  };

  const finishHandler = (value, headerField) => {
    setFilter((prevFilter) => ({
      ...prevFilter,
      [headerField]: value.id,
    }));
  };

  return (
    <Fragment>
      {props.headers.map((header, index) => (
        <div key={index} style={{ fontWeight: "normal" }}>
          {header.type !== "option" && (
            <span style={{ fontWeight: "bold" }}>{header.name}:</span>
          )}
          {header.type === "string" && (
            <InputField
              type={"text"}
              value={filter[header.field]}
              inputHandler={(event) => inputTextHandler(event, header.field)}
              checkInputHandler={(event) => checkStringInputHandler(event)}
              width={"140px"}
            />
          )}
          {header.type === "number" && !header.dontAdd && (
            <InputField
              type={"number"}
              value={filter[header.field]}
              inputHandler={(event) => inputTextHandler(event, header.field)}
              checkInputHandler={(event) => checkNumberInputHandler(event)}
              width={"140px"}
            />
          )}
          {(header.type === "date" || header.type === "datetime") && (
            // refactor even more if possible?
            <Fragment>
              <DateInputField
                text={"Inceput:"}
                value={filter[header.field].min}
                inputHandler={(event) => inputDateHandler(event, header.field, true)}
              />
              <DateInputField
                text={"Sfarsit:"}
                value={filter[header.field].max}
                inputHandler={(event) => inputDateHandler(event, header.field, false)}
              />
            </Fragment>
          )}
          {header.type === "option" && (
            <AutoComplete
              url={header.url}
              idField={header.idField}
              printField1={header.printField1}
              printField2={header.printField2}
              text={header.text}
              onFinish={(value) => finishHandler(value, header.field)}
              needsConfirmation={false}
              className="form-control me-sm-1 validinput"
              style={{
                whiteSpace: "nowrap",
                width: "300px",
              }}
            />
          )}
        </div>
      ))}
    </Fragment>
  );
};

export default InputList;
