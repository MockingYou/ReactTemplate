import React, { Fragment, useEffect, useState, useRef } from "react";
import { QuestionMark, DoneOutlined, Close } from "@mui/icons-material";

const Confirm = (props) => {
  const [active, setActive] = useState(false);
  const [fill, setFill] = useState(30);
  let intervalRef = useRef(null);

  const startHandler = () => {
    cancelHandler();
    setActive(true);
    setFill(100);
    intervalRef.current = setInterval(() => {
      setFill((prevFill) => prevFill - 2);
      if (fill < 0) {
        cancelHandler();
      }
    }, 100);
  };

  const cancelHandler = () => {
    clearInterval(intervalRef.current);
    setActive(false);
    setFill(100);
  };

  useEffect(() => {
    if (fill < 0) {
      cancelHandler();
    }
  }, [fill]);

  const confirmHandler = () => {
    cancelHandler();
    if (typeof props.confirm === "function") {
      props.confirm();
    }
  };

  return (
    <Fragment>
      <span
        onClick={startHandler}
        className="material-icons buttonitembest"
        style={{
          color: typeof props.color === "string" ? props.color : "magenta",
        }}
      >
        {typeof props.icon === "object" ? props.icon : <QuestionMark />}
      </span>
      {active && (
        <div
          style={{
            overflow: "auto",
            position: "absolute",
            backgroundColor: "rgb(165, 245, 255)",
            border: "1px solid rgb(218, 218, 218)",
            display: "inline-block",
            padding: "0px",
            transform: "translate(-85%, -20%)",
            width: "88px",
            paddingBottom: "2px",
            borderRadius: "50px",
          }}
        >
          <div
            style={{
              backgroundColor: "rgb(255, 255, 255)",
              height: "100%",
              zIndex: "-1",
              position: "absolute",
              borderRadius: "5px",
              width: fill + "%",
            }}
          />
          <span
            onClick={confirmHandler}
            style={{
              marginTop: "10px",
              marginLeft: "10px",
            }}
            className="material-icons buttonitembest lightgreentext"
          >
            <DoneOutlined />
          </span>
          <span
            onClick={cancelHandler}
            style={{ marginTop: "10px", marginRight: "5px" }}
            className="material-icons buttonitembest lightredtext"
          >
            <Close />
          </span>
        </div>
      )}
    </Fragment>
  );
};

export default Confirm;
