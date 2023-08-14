import React, { Fragment, useState } from "react";
import axios from "axios";
import FileDownloadIcon from '@mui/icons-material/FileDownload';

import InputList from "./InputList";
import DownloadOptionsList from "./DownloadOptionsList";
import Loading from "../utils/Loading";

import { getMonthName, downloadTextFile, downloadBase64BinaryFile } from "../../helper_functions";

import "../../bootstrap.min.css";
import "../../styles.css";

const DownloadTable = (props) => {
  const [active, setActive] = useState(false);
  const [filter, setFilter] = useState(createsInitialFilter(props));
  const [headersInfo, setHeadersInfo] = useState(createHeadersInfo(props.downloadHeaders));
  const [downloadOptions, setDownloadOptions] = useState(DOWNLOAD_OPTIONS_DEFAULT);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const startHandler = () => {
    setActive(true);
    setFilter(createsInitialFilter(props));
    setHeadersInfo(createHeadersInfo(props.downloadHeaders));
    setDownloadOptions(DOWNLOAD_OPTIONS_DEFAULT);
  };

  const cancelHandler = () => {
    setActive(false);
  };

  const updateFilterHandler = (newFilter) => {
    setFilter(newFilter);
  };

  const updateDownloadOptionsHandler = (newDownloadOptions) => {
    setDownloadOptions(newDownloadOptions);
  };

  const downloadHandler = () => {
    let hasFilter = false;
    Object.keys(filter).forEach(key => {
      if (filter[key] !== "") {
        hasFilter = true;
      }
    });

    setIsLoading(true);

    const filterQuery = hasFilter ? `&filter=${JSON.stringify(filter).replace(/[#&%]/gi, '')}` : "";
    let additionalParams = typeof props.getAdditionalParams === "function" ? props.getAdditionalParams() : "";
    additionalParams = typeof additionalParams === "undefined" ? "" : additionalParams;

    const URL = encodeURI(`${props.apiGet}?start=0&count=${downloadOptions.maxNumber}${filterQuery}${additionalParams}&format=${downloadOptions.format}&names=${headersInfo.namesMerged}&fields=${headersInfo.fieldsMerged}`);

    axios.get(URL)
    .then((response) => {
      let currentDate = new Date();
      currentDate.setTime(currentDate.getTime() - currentDate.getTimezoneOffset() * 60 * 1000);

      const fileName = `Export_date_${currentDate.getFullYear()}-${getMonthName(currentDate)}-${currentDate.getDate()}_${currentDate.getTime()}`;

      if (response.data.error.startsWith("login")) {
        console.log("login");
        return;
      }
      if (response.data.error.length > 0) {
        setErrorText(response.data.error.substring(0, 60));
        setIsLoading(false);
      } else {
        if (typeof response.data.data === "undefined" || response.data.data === null) {
          setErrorText("Nu exista elemente pentru aceste filtre");
        } else {
          if (downloadOptions.format === "xlsx") {
            downloadBase64BinaryFile(response.data.data, `${fileName}.xlsx`, "xlsx");
          } else if (downloadOptions.format === "csv") {
            downloadTextFile(response.data.data, `${fileName}.csv`);
          } else if (downloadOptions.format === "txt") {
            downloadTextFile(response.data.data, `${fileName}.txt`);
          } else {
            setErrorText("Format invalid");
          }
          setActive(false);
        }
        setIsLoading(false);
      }
    }, (error) => {
          console.log(error);
          setErrorText(`Eroare de conexiune date:${error.statusText} ${error.xhrStatus}`);
          setIsLoading(false);
        }
    );
  };

  return (
    <Fragment>
      <FileDownloadIcon onMouseDown={startHandler} className="material-icons iconbtnok" style={{ color: "black" }} />
      {active && (
        <div
          onMouseDown={cancelHandler}
          style={{
            position: "fixed",
            zIndex: 100,
            width: "100%",
            height: "100%",
            top: "0px",
            left: "0px",
            backgroundColor: "#00000080",
            cursor: "pointer",
          }}
        />
      )}
      {active && (
        <div
          className="card1"
          style={{
            maxHeight: "90%",
            position: "fixed",
            left: "50%",
            top: "1%",
            display: "inline-block",
            zIndex: 1000,
            backgroundColor: "white",
            padding: "10px",
            borderRadius: "10px",
            border: "1px solid grey",
            transform: "translate(-50%, 0%)",
            width: "max-content",
            overflowY: props.downloadHeaders.length > 12 ? "scroll" : "visible",
          }}
        >
          <div
            className="cardtitle-blue"
            style={{
              fontSize: "30px",
              color: "white",
              userSelect: "none",
              textAllign: "center",
            }}
          >
            Descarcare
            <FileDownloadIcon style={{color: "white", textSize: "30px"}} />
          </div>
          <InputList filter={filter} headers={props.downloadHeaders} changeInputHandler={updateFilterHandler} />
          <DownloadOptionsList downloadOptions={downloadOptions} changeInputHandler={updateDownloadOptionsHandler} />
          <br />
          <br />
          <button onMouseDown={downloadHandler} className="button1" style={{float: "right", position: "relative"}}>
            Descarcare
            <FileDownloadIcon style={{color: "white"}} />
            <Loading isLoading={isLoading} />
          </button>
          <br />
          <br />
          <span style={{color: "red"}}>
            {errorText}
          </span>
          {errorText !== "" && <br />}
        </div>
      )}
    </Fragment>
  );
};

export default DownloadTable;

//============ COMPONENT UTILS
const DOWNLOAD_OPTIONS_DEFAULT = {
  "maxNumber": 1000,
  "format": "csv",
  "separator": ","
};

const createsInitialFilter = (props) => {
  const filter = {};

  props.downloadHeaders.map((header) => {
    if (["date", "datetime"].includes(header.type)) {
      filter[header.field] = {
        minDate: "",
        maxDate: "",
      };
    } else {
      filter[header.field] = "";
    }
  });

  if (typeof props.filterId === "number" && typeof props.addCustomUserId === "string") {
    filter[props.addCustomUserId] = props.filterId;
  }

  if (typeof props.getFilters === "function") {
    const additionalFilters = props.getFilters();
    if (typeof additionalFilters !== "undefined") {
      for (const key in additionalFilters) {
        filter[key] = additionalFilters[key];
      }
    }
  }

  return filter;
};

const createHeadersInfo = (downloadHeaders) => {
  const headersInfo = {
    namesMerged: "",
    fieldsMerged: ""
  };

  const tempNames = [];
  const tempFields = [];

  downloadHeaders.forEach((header, index) => {
    tempNames.push(header.name.replace(/,/g, "."));
    tempFields.push(header.field);

    if (header.hasOwnProperty("optiontext")) {
      tempFields.splice(index, 1, header.optionText);
    }
  });

  headersInfo.namesMerged = tempNames.join(",");
  headersInfo.fieldsMerged = tempFields.join(",");

  return headersInfo;
}
