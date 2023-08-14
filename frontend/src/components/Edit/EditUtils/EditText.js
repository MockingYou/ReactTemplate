import React from "react";

const EditText = (props) => {
  return (
    <span
      onMouseDown={!props.readOnly ? props.startHandler : undefined}
      style={{
        whiteSpace: "nowrap",
        padding: "6px",
        height: "32px",
        display: "inline-block",
        border: "1px solid rgba(0, 0, 0, .01)",
      }}
    >
      {props.text}
      {typeof props.isHalfHour === "undefined" ? "" 
            : props.text % 2 === 1 ? ":30" : ":00"}
    </span>
  );
};

export default EditText;
