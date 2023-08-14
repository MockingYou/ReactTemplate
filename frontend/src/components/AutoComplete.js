import React, { Fragment, useState, useRef, useEffect } from "react";
import { ArrowLeft, ArrowRight } from "@mui/icons-material";
import axios from "axios";

import EditText from "./Edit/EditUtils/EditText";
import EditStartButton from "./Edit/EditUtils/EditStartButton";
import EditCloseButton from "./Edit/EditUtils/EditCloseButton";
import EditDoneButton from "./Edit/EditUtils/EditDoneButton";
import Loading from "./utils/Loading";
import useIsMount from "./utils/useIsMount"

import "../bootstrap.min.css";
import "../styles.css";

//in angular.js autocomplete1 => cu confirmare autocomplete2 => fara confirmare

const ELEMENTS_PER_PAGE = 3;

const AutoComplete = (props) => {
  const [active, setActive] = useState(false);
  const [element, setElement] = useState({
    id: -1,
    text: typeof props.text === "string" ? props.text : "",
  });
  const [searchText, setSearchText] = useState("");
  const [showList, setShowList] = useState(false);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [changedPage, setChangedPage] = useState(false);
  const [valid, setValid] = useState(false);
  const [validSelectedElement, setValidSelectedElement] = useState(false);
  const [lastValidElement, setLastValidElement] = useState(element);

  const startTimeoutRef = useRef(null);
  const deselectTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  const isMount = useIsMount();

  const STYLE = {
    ...props.style,
    height: "32px"
  }

  const startHandler = () => {
    setActive(true);
    setSearchText("");
    setShowList(true);
    setPage(1);
    startTimeoutRef.current = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
    if (typeof element == "object") {
      setLastValidElement(element);
    }
    getList();
  };

  const nextPage = () => {
    if (page < pageCount) {
      setPage((prevPage) => prevPage + 1);
    }
    setChangedPage(true);
  };

  const prevPage = () => {
    if (page > 1) {
      setPage((prevPage) => prevPage - 1);
    }
    setChangedPage(true);
  };

  const getPagination = () => {
    return (
      `start=${(page - 1) * ELEMENTS_PER_PAGE}&count=${ELEMENTS_PER_PAGE}`
    );
  };

  const getList = () => {
    console.log(2);
    const hasField1 = typeof props.printField1 === "string" && props.printField1.length > 0;
    const hasField2 = typeof props.printField2 === "string" && props.printField2.length > 0;

    let filter = "";
    if (searchText.length > 0) {
      let search = {};
      if (hasField1) {
        search[props.printField1] = searchText;
      }
      if (hasField2) {
        search[props.printField1] = searchText;
      }
      filter = "&filter=" + JSON.stringify(search).replace(/[#&%`]/gi, "");
    }

    axios.get(encodeURI(props.url + (props.url.includes("?") ? "&" : "?") + getPagination() + "&useor=1" + filter))
    .then((response) => {
      if (response.data.error.startsWith("login")) {
        console.log("login");
        return;
      }
      if (response.data.error.length > 0) {
        console.log(response.data.error);
        if (typeof props.onError === "function") {
          props.onError({ data: response.data.error });
        }
      } else {
        let newItems = [];
        response.data.data.forEach((element) => {
          let newElement = {
            id: element[props.idField],
            text: (hasField1 ? element[props.printField1] : "") +
                  (hasField2 ? `(${props.printField2}:${element[props.printField2]})` : ""),
          };
          newItems.push(newElement);
          setPageCount(Math.ceil(response.data.count / ELEMENTS_PER_PAGE));
        });
          setItems(newItems);
          setValid(items.length === 1);
        }
      }, (error) => {
            console.log(error);
            if (typeof props.onError === "function") {
              const errorMessage = `Eroare de conexiune date: ${error.statusText} ${error.xhrStatus}`;
              props.onError({
                data: errorMessage,
              });
            }
        }
    );
  };

  useEffect(() => {
    
    if (isMount) {
      getList();
    }
  }, [searchText, page]);

  const inputHandler = (event) => {
    setSearchText(event.target.value);
    setPage(1);
    setShowList(true);
  };

  const selectHandler = (data) => {
    setElement(data);
    setSearchText(`${data.text}(${data.id})`);
    setValidSelectedElement(true);
  };

  const deselectHandler = () => {
    deselectTimeoutRef.current = setTimeout(() => {
      if ((searchText === "" || items.length < 1) && changedPage === false) {
        setValid(false);
        setActive(false);
        setPage(1);
        setElement({ id: -1, text: props.text });
        setShowList(false);
      }
      if (changedPage === true) {
        if (inputRef.current) {
          inputRef.current.focus();
        }
        setChangedPage(false);
      }
    }, 300);
  };

  useEffect(() => {
    clearTimeout(startTimeoutRef);
    clearTimeout(deselectTimeoutRef);
  }, []);

  const cancelHandler = () => {
    setActive(false);
    setPage(1);
    setElement({ id: -1, text: props.text });
    setShowList(false);
    setElement(lastValidElement);
  };

  const finishHandler = () => {
    setActive(false);
    setShowList(false);
    if (typeof props.onFinish === "function") {
      props.onFinish(element);
    }
  };

  useEffect(() => {
    if (validSelectedElement) {
      if (!props.needsConfirmation) {
        finishHandler();
      }
    }
  }, [element])

  return (
    <Fragment>
      {!active && (
        <EditText
          startHandler={startHandler}
          text={element.text}
          readOnly={props.readOnly}
        />
      )}
      <Loading isLoading={props.isLoading} />
      {!active && !props.isLoading && !props.readOnly && (
        <EditStartButton startHandler={startHandler} />
      )}
      {active && (
        <div style={{ display: "inline-flex", zIndex: "2000" }}>
          <input
            ref={inputRef}
            placeholder={element.text}
            value={searchText}
            onChange={inputHandler}
            onBlur={deselectHandler}
            style={STYLE}
            className="form-control me-sm-1"
          />
          {active && <EditCloseButton cancelHandler={cancelHandler} />}
          {active && props.needsConfirmation && <EditDoneButton finishHandler={finishHandler} />}
        </div>
      )}
      {showList && (
        <div
          className="dropdown"
          style={{
            position: "absolute",
            zIndex: "1000",
            transform: "translate(-13%, 0%)",
          }}
        >
          {items.map((element) => (
            <div
              key={element.id}
              className="elem"
              onMouseDown={() => selectHandler(element)}
            >
              {element.text}({element.id})
            </div>
          ))}
          <span onMouseDown={prevPage} className="material-icons iconbtnok">
            <ArrowLeft />
          </span>
          <span>
            {page}/{pageCount}
          </span>
          <span onMouseDown={nextPage} className="material-icons iconbtnok">
            <ArrowRight />
          </span>
        </div>
      )}
    </Fragment>
  );
};

export default AutoComplete;
