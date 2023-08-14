import React from "react";

import "../../bootstrap.min.css";

const InputField = (props) => {
  return (
    <input
      type={props.type}
      value={props.value}
      onChange={props.inputHandler}
      onKeyDown={props.checkInputHandler}
      className="form-control me-sm-1 validinput"
      style={{
        width: props.width,
        height: "32px",
        display: "inline-block",
      }}
    />
  );
};

export default InputField;
