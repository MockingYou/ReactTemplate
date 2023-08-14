import React, { Fragment } from "react";

import loadingGIF from "../../assets/loadinggif.gif";

const Loading = (props) => {
  return (
    <Fragment>
      {props.isLoading && (
        <img
          src={loadingGIF}
          alt=""
          style={{ position: "absolute", width: "40px", zIndex: "1" }}
        />
      )}
    </Fragment>
  );
};

export default Loading;
