import React, { Fragment } from 'react'

import InputField from './InputField';

const DateInputField = (props) => {

  const getPrintableDate = () => {
    if (typeof props.value !== "number") {
      return  "-";
    }

    const tempDate = new Date(props.value);
    const offsetMilliseconds = tempDate.getTimezoneOffset() * 60 * 1000;
    let printDate = new Date(tempDate.getTime() - offsetMilliseconds);
    
    return printDate.toISOString().split("T")[0];
  };

  return (
    <Fragment>
      <span>
        <br />
        {props.text}       
      </span>
      <InputField
        type={"date"}
        value={getPrintableDate()}
        inputHandler={props.inputHandler}
        width="150px"
      />
    </Fragment>
  )
}

export default DateInputField