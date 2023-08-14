import React, { Fragment, useState } from "react";
import { Edit, Check } from "@mui/icons-material";

import "../styles.css";

const TimePicker = (props) => {
  const NUMBERS = [...Array(25).keys()];
  const [active, setActive] = useState(false);
  const [hour, setHour] = useState(0);
  const [halfHour, setHalfHour] = useState(0);
  const [changed, setChanged] = useState(false);

  const startHandler = () => {
    setActive(true);
    setHour((props.time - (props.time % 2)) / 2);
    setHalfHour(props.time % 2);
  };

  const cancelHandler = () => {
    setActive(false);
  };

  const finishHandler = () => {
    if (hour === 24) setHour(0);
    props.onFinish({ time: 2 * hour + halfHour });
    setActive(false);
  };

  const clickHourHandler = (value) => {
    setHour(value);
    setChanged(true);
  };

  const clickHalfHourHandler = (value) => {
    setHalfHour(value);
    setChanged(true);
  };

  return (
    <Fragment>
      <span
        onClick={startHandler}
        style={{
          userSelect: "none",
          display: "inline-block",
          border: "1px solid grey",
          borderRadius: "5px",
          cursor: "pointer",
          backgroundColor: "white",
          padding: "4px 5px 4px 5px",
          fontSize: "20px",
        }}
      >
        {props.time < 20 ? "0" : ""}
        {(props.time - (props.time % 2)) / 2}:
        {props.time % 2 === 0 ? "00" : "30"}
        <Edit />
      </span>
      {active && (
        <div
          onClick={cancelHandler}
          style={{
            backgroundColor: "rgba(0,0,0,0.1)",
            zIndex: "900",
            cursor: "pointer",
            position: "fixed",
            top: "0px",
            left: "0px",
            width: "100%",
            height: "100%",
          }}
        />
      )}
      {active && (
        <div
          style={{
            userSelect: "none",
            transform: "translate(-65%, 0px)",
            display: "inline-block",
            width: "260px",
            height: "220px",
            zIndex: "999",
            position: "absolute",
            backgroundColor: "white",
            border: "1px solid grey",
            borderRadius: "5px",
          }}
        >
          {NUMBERS.map((number) => (
            <span
              key={number}
              onClick={() => clickHourHandler(number)}
              className={hour === number ? "hourtile green" : "hourtile blue"}
            >
              {number}
            </span>
          ))}
          <span
            onClick={() => clickHalfHourHandler(0)}
            className={halfHour === 0 ? "hourtile green" : "hourtile"}
          >
            :00
          </span>
          <span
            onClick={() => clickHalfHourHandler(1)}
            className={halfHour === 1 ? "hourtile green" : "hourtile"}
          >
            :30
          </span>
          {changed && (
            <span
              onClick={finishHandler}
              className="material-icons iconbtnok green"
              style={{
                fontSize: "42px",
                color: "white",
                borderRadius: "5px",
                position: "absolute",
                right: "5px",
                paddingLeft: "10px",
                paddingRight: "10px",
              }}
            >
              <Check />
            </span>
          )}
        </div>
      )}
    </Fragment>
  );
};

export default TimePicker;
