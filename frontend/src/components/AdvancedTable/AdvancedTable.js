import React, { useState, useEffect, Fragment, useCallback } from "react";
import axios from "axios";
import { debounce } from "lodash"

import { ExpandLess, ExpandMore, Refresh, Clear, Delete, AddBox } from "@mui/icons-material";

import Loading from "../utils/Loading";
import DownloadTable from "../DownloadTable/DownloadTable";
import EditDate from "../Edit/EditDate";
import EditBool from "../Edit/EditBool";
import EditNumber from "../Edit/EditNumber";
import EditString from "../Edit/EditString";
import AutoComplete from "../AutoComplete";
import Pagination from "../Pagination";

import "../../styles.css";


const AdvancedTable = (props) => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [orderBy, setOrderBy] = useState(typeof props.defaultOrderBy === "string" ? props.defaultOrderBy : "id ASC");
  const [searchFilters, setSearchFilters] = useState(initializeSearchFilters(props.headers, props.filterId, props.customAddUserId, props.getFilters));
  const [showMinDateInput, setShowMinDateInput] = useState(initializeMinDateFilters(props.headers));
  const [showMaxDateInput, setShowMaxDateInput] = useState(initializeMaxDateFilters(props.headers));
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState(initializeNewItem(props.headers, props.customAddParams));
  const [isNewItemValid, setIsNewItemValid] = useState(false);
  const [paginationOptions, setPaginationOptions] = useState({
    currentPage: 1,
    numberOfPages: 1,
    itemsPerPage: 20,
    numberOfItems: 0
  });

  const TR_STYLE = {height: "40px", cursor: props.onClickedItem ? "pointer" : "default"};

  const refreshTable = () => {
    setIsLoading(true);
    let hasFilter = false;

    const toSend = {};

    Object.keys(searchFilters).forEach((key) => {
      if (searchFilters[key] !== "") {
        toSend[key] = searchFilters[key]

        if (typeof toSend[key] === "object") {
          if (toSend[key].minDate instanceof Date) {
            toSend[key]["min"] = toSend[key].minDate.getTime()
          }
          if (toSend[key].maxDate instanceof Date) {
            toSend[key]["max"] = toSend[key].maxDate.getTime()
          }
        }
      }
      if (toSend[key] !== "" || 
          (typeof toSend[key] === "object" && 
            (typeof toSend[key].min === "number" || typeof toSend[key].max === "number"))) {
        hasFilter = true
      }
    });
    
    const filter = hasFilter ? `&filter=${encodeURIComponent(JSON.stringify(toSend).replace(/[#&%`]/gi,''))}` : "";
    //console.log(JSON.stringify(toSend).replace(/[#&%`]/gi,''));
    const additionalParams = (typeof props.getAdditionalParams === "function") ? props.getAdditionalParams() : "";
    const orderByFilter = `&orderby=${encodeURIComponent(orderBy)}`;
    const URL = `${props.get}?${getPagination()}${filter}${additionalParams}${orderByFilter}`;

    axios.get(URL)
    .then((response) => {
      if (response.data.error.startsWith("login")) {
        window.location.replace("login.html");
        return;
      }
      if (response.data.error.length > 0) {
        console.log(response.data.error);
        if (typeof props.onError === "function") {
          props.onError(response.data.error);
        }
        const refreshErrorTimeout = setTimeout(() => {
          setIsLoading(false);
        }, 500);
        return () => clearTimeout(refreshErrorTimeout);
      } else {
        const auxItems = response.data.data;
        
        if (typeof response.data.count === "number") {
          setPaginationOptions((prevPaginationOptions) => ({
            ...prevPaginationOptions,
            "numberOfPages": Math.ceil(response.data.count / prevPaginationOptions.itemsPerPage),
            "numberOfItems": response.data.count
          }));
        } else {
          setPaginationOptions((prevPaginationOptions) => ({
            ...prevPaginationOptions,
            "numberOfPages": 1,
            "numberOfItems": 0
          }));
        }
        checkNewItemValidity(false);
        
        props.headers.forEach((header) => {
          if (["date", "datetime", "number", "numberWithHalfHour"].includes(header.type)) {
            auxItems.forEach((item) => {
              if (typeof item[header.field] === "string") {
                item[header.field] = parseInt(item[header.field])
              }
            })
          }
        });
        setItems([]);
        const refreshSuccessTimeout = setTimeout(() => {
          setItems(auxItems);
          setIsLoading(false);
        }, 100);
        return () => clearTimeout(refreshSuccessTimeout);
      }
    }, (error) => {
      console.log(error);
      if (typeof props.onError === "function") {
        props.onError(`Eroare de conexiune date:${error.statusText} ${error.xhrStatus}`);
        const refreshErrorTimeout = setTimeout(() => {
          setIsLoading(false);
        }, 500);
        return () => clearTimeout(refreshErrorTimeout);
      } 
    })
  }

  useEffect(() => {
    refreshTable();
  }, [orderBy, searchFilters, paginationOptions.currentPage, paginationOptions.itemsPerPage])

  useEffect(() => {
    if (typeof props.onDownloaded === "function") {
      props.onDownloaded(paginationOptions.numberOfItems)
    }
  }, [paginationOptions.numberOfItems])

  const searchChangeHandler = (event, headerField) => {
    const textInput = event.target.value;

    setSearchFilters((prevSearchFilter) => ({
      ...prevSearchFilter,
      [headerField]: textInput,
    }));
  }

  const searchHandler = () => {
    setPaginationOptions((prevPaginationOptions) => ({
      ...prevPaginationOptions,
      currentPage: 1
    }));
  }

  const debouncedSearchHandler = useCallback(
    debounce(searchHandler, 500)
  , []);

  const showMinDateHandler = (headerField) => {
    setShowMinDateInput((prevShowMinDateInput) => ({
      ...prevShowMinDateInput,
      [headerField]: !prevShowMinDateInput[headerField]
    }))
  };

  const showMaxDateHandler = (headerField) => {
    setShowMaxDateInput((prevShowMaxDateInput) => ({
      ...prevShowMaxDateInput,
      [headerField]: !prevShowMaxDateInput[headerField]
    }))
  };

  const dateChangeHandler = (event, headerField, isMinDate) => {
    const textInput = event.target.value;
    const dateAux = searchFilters[headerField];

    if (isMinDate) {
      dateAux.minDate = new Date(textInput);
    } else {
      dateAux.maxDate = new Date(textInput);
    }

    setSearchFilters((prevSearchFilter) => ({
      ...prevSearchFilter,
      [headerField]: dateAux
    }))
  };

  const getPrintableDate = (headerType, date) => {
    if (date instanceof Date) {
      const offsetMilliseconds = date.getTimezoneOffset() * 60 * 1000;
      let printDate = new Date(date.getTime() - offsetMilliseconds);

      if (headerType === "date") {
        return printDate.toISOString().split("T")[0];
      } else if (headerType === "datetime") {
        return printDate.toISOString().replace("T", " ").split(".")[0];
      } else {
        return "-";
      }
    } else {
      return "-";
    }
  };

  const clickItemHandler = (item, readOnly) => {
    if (readOnly) {
      if (typeof props.onClickedItem === "function") {
        props.onClickedItem(item)
      }
    }
  };

  const buttonClickHandler = (item, header) => {
    if (typeof props.onButtonClick === "function") {
      props.onButtonClick(item, header)
    }
  };

  const editHandler = (item, header, newValue) => {
    if (typeof newValue === "object" && newValue.id !== "undefined") {
        newValue = newValue.id;
    }
    if (typeof props.customEdit === "function") {
      props.customEdit(item, header, newValue);
      return;
    }
    setIsLoading(true);
    const URL = `${encodeURI(props.edit)}?id=${encodeURIComponent(item.id)}&field=${encodeURIComponent(header.field)}&value=${encodeURIComponent(newValue.toString().replace(/[#&%`]/gi,''))}&type=${encodeURIComponent(header.type)}`;
    axios.get(URL)
    .then((response) => {
      if (response.data.error.startsWith("login")) {
        window.location.replace("login.html");
        return;
      }
      if (response.data.error.length > 0) {
        console.log(response.data.error);
        if (typeof props.onError === "function") {
          props.onError(response.data.error);
        }
        setIsLoading(false);
      }
      else {
        refreshTable();
        if (typeof props.onSuccess === "function") {
          props.onSuccess(`Campul ${header.field} a fost editat.`);
        }
        const editTimeout = setTimeout(() => {
          setIsLoading(false);
        }, 100);
        return () => clearTimeout(editTimeout);
      }
    }, (error) => {
      console.log(error);
      if (typeof props.onError === "function") {
        props.onError(`Eroare de conexiune ${error.statusText} ${error.xhrStatus}`);
      }
      setIsLoading(false);
    })
  };

  const deleteHandler = (item) => {
    if (typeof props.customDelete === "function") {
      props.customDelete(item);
      return;
    }
    setIsLoading(true);

    const URL = `${props.delete}?id=${item.id}`
    axios.get(URL)
    .then((response) => {
      if (response.data.error.startsWith("login")) {
        window.location.replace("login.html") 
        return;
      }
      if (response.data.error.length > 0) {
        console.log(response.data.error);
        if (typeof props.onError === "function") {
          props.onError(response.data.error);
        }
        setIsLoading(false);
      }
      else {
        refreshTable();
        if (typeof props.onSuccess === "function") {
          props.onSuccess("Elementul a fost sters");
        }
        const deleteTimeout = setTimeout(() => {
          setIsLoading(false);
        }, 100);
        return () => clearTimeout(deleteTimeout);
      }
    }, (error) => {
      console.log(error);
      if (typeof props.onError === "function") {
        props.onError(`Eroare de conexiune ${error.statusText} ${error.xhrStatus}`);
      }
      setIsLoading(false);
    })
  };

  const deactivateHandler = (item) => {
    if (typeof props.customDeactivate === "function") {
      props.customDeactivate(item);
      return;
    }
    setIsLoading(true);

    const URL = `${props.deactivate}?id=${item.id}`
    axios.get(URL)
    .then((response) => {
      if (response.data.error.startsWith("login")) {
        window.location.replace("login.html") 
        return;
      }
      if (response.data.error.length > 0) {
        console.log(response.data.error);
        if (typeof props.onError === "function") {
          props.onError(response.data.error);
        }
        setIsLoading(false);
      }
      else {
        refreshTable();
        if (typeof props.onSuccess === "function") {
          props.onSuccess("Elementul a fost dezactivat");
        }
        const deactivateTimeout = setTimeout(() => {
          setIsLoading(false);
        }, 100);
        return () => clearTimeout(deactivateTimeout);
      }
    }, (error) => {
      console.log(error);
      if (typeof props.onError === "function") {
        props.onError(`Eroare de conexiune ${error.statusText} ${error.xhrStatus}`);
      }
      setIsLoading(false);
    })
  };

  const newItemChangeHandler = (event, header) => {
    if (header.type === "option") {
      const optionAux = {
        id: event.id,
        text: event.text
      };

      setNewItem((prevItem) => ({
        ...prevItem,
        [header.field]: optionAux
      }));

    } else if (event.target.type === "checkbox") {
        const isChecked = event.target.checked;
        if (header.type === "numberWithHalfHour") {
          let newHalfHourNumber = isChecked ? parseInt(newItem[header.field] + 1) : parseInt(newItem[header.field] - 1);

          setNewItem((prevItem) => ({
            ...prevItem,
            [header.field]: newHalfHourNumber
          }));
        } else if (header.type === "bool") {
          setNewItem((prevItem) => ({
            ...prevItem,
            [header.field]: isChecked ? 1 : 0
          }));
        }
    } else {
      let textInput = event.target.value;

      if (header.type === "date" || header.type === "datetime") {
        textInput = new Date(textInput);
      }

      if (header.type === "number") {
        textInput = parseInt(textInput);
      }

      if (header.type === "numberWithHalfHour") {
        if (event.target.value.length > 0) {
          textInput = parseInt(textInput);
          textInput *= 2 + newItem[header.field] % 2;
        }
      }

      setNewItem((prevItem) => ({
        ...prevItem,
        [header.field]: textInput
      }));
    }    
  };

  const checkNewItemValidity = (displayError) => {
    setIsNewItemValid(true);
    props.headers.map((header) => {
      if (header.type === "button") {
        return;
      }

      const newValue = newItem[header.field];
      const SPECIAL_CHARACTERS = /[#&%`]/;

      header.valid = true;

      if (header.mandatoryAdd) {
        if (header.type === "number" && (isNaN(newValue) || typeof newValue !== "number" )) {
          header.valid = false;
          setIsNewItemValid(false);
          if (displayError) {
            if (typeof props.onError === "function") {
              console.log(`Lipseste campul ${header.name}.`)
              props.onError(`Lipseste campul ${header.name}.`)
            }
          }
        } else if (header.type === "string" && (typeof newValue !== "string" || newValue.length === 0 || SPECIAL_CHARACTERS.test(newValue))) {
          header.valid = false;
          setIsNewItemValid(false);
          if (displayError) {
            if (typeof props.onError === "function") {
              console.log(`Lipseste campul ${header.name}.`)
              props.onError(`Lipseste campul ${header.name}.`)
            }
          }
        } else if ((header.type === "date" || header.type === "datetime") && !(newValue instanceof Date)) {
          header.valid = false;
          setIsNewItemValid(false);
          if (displayError) {
            if (typeof props.onError === "function") {
              console.log(`Lipseste campul ${header.name}.`)
              props.onError(`Lipseste campul ${header.name}.`)
            }
          }
        } else if (header.type === "numberWithHalfHour" && (isNaN(newValue) || typeof newValue !== "number" )) {
          header.valid = false;
          setIsNewItemValid(false);
          if (displayError) {
            if (typeof props.onError === "function") {
              console.log(`Lipseste campul ${header.name}.`)
              props.onError(`Lipseste campul ${header.name}.`)
            }
          }
        } else if (header.type === "option" && (typeof newValue !== "object" || newValue.id === -1)) {
          header.valid = false;
          setIsNewItemValid(false);
          if (displayError) {
            if (typeof props.onError === "function") {
              console.log(`Lipseste campul ${header.name}.`)
              props.onError(`Lipseste campul ${header.name}.`)
            }
          }
        }
      }
    })
  }

  useEffect(() => {
    checkNewItemValidity(false);
  }, [newItem])

  const addItemHandler = () => {
    setIsLoading(true);

    checkNewItemValidity(true)

    if (typeof props.customAdd === "function") {
      props.customAdd(newItem);
      return;
    }

    const toSend = {};
    Object.keys(newItem).forEach((key) => {
      if (typeof newItem[key] === "object" && newItem[key].id !== -1) {
        toSend[key] = newItem[key].id
      } else if (newItem[key] !== "") {
        toSend[key] = newItem[key]
      }
    })
    const URL = `${props.add}?newitem=${encodeURIComponent(JSON.stringify(toSend).replace(/[#&%`]/gi,''))}`

    axios.get(URL)
      .then((response) => {
        if (response.data.error.startsWith("login")) {
          window.location.replace("login.html");
          return;
        }
        if (response.data.error.length > 0) {
          console.log(response.data.error);
          if (typeof props.onError === "function") {
            props.onError(response.data.error);
          }
          setIsLoading(false);
        }
        else {
          refreshTable();
          if (typeof props.onSuccess === "function") {
            props.onSuccess("Elementul a fost adaugat");
          }
          const deactivateTimeout = setTimeout(() => {
            setIsLoading(false);
            setNewItem(initializeNewItem(props.headers, props.customAddParams));

          }, 100);
          return () => clearTimeout(deactivateTimeout);
        }
      }, (error) => {
        console.log(error);
        if (typeof props.onError === "function") {
          props.onError(`Eroare de conexiune ${error.statusText} ${error.xhrStatus}`);
        }
        setIsLoading(false);
      })
  }

  const changeItemsPerPageHandler = (event) => {
    setPaginationOptions((prevPaginationOptions) => ({
      ...prevPaginationOptions,
      itemsPerPage: parseInt(event.target.value),
      currentPage: 1
    }));
    
    refreshTable();
  }

  const changePageHandler = (newPage) => {
    setPaginationOptions((prevPaginationOptions) => ({
      ...prevPaginationOptions,
      currentPage: newPage
    }));
    
    refreshTable();
  };

  const getPagination = () => {
    return `start=${(paginationOptions.currentPage - 1) * paginationOptions.itemsPerPage}&count=${paginationOptions.itemsPerPage}`
  }

  return (
    <Fragment>
      <table
      className="table1"
      style={{
        margin: "auto",
        position: "relative",
      }}
      >
        <thead>
          <tr>
            {props.headers.map((header, index) => (
              <th
                key={index}
                style={{
                  position: "relative",
                  backgroundColor: "#78B2FF",
                  paddingRight: "30px",
                }}  
              >
                {header.name}
                {!(header.type === "button" || (header.useFilter !== true && header.sortable === false) || header.sortable === false) && <div style={{
                  position: "absolute",
                  top: "0",
                  right: "0",
                  lineHeight: "0.5"
                }}>
                  <ExpandLess onMouseDown={() => setOrderBy(`${header.field} ASC`)} className="orderbyicon material-icons" style={{backgroundColor: orderBy === `${header.field} ASC` ? "blue" : ""}} />
                  <br />
                  <ExpandMore onMouseDown={() => setOrderBy(`${header.field} DESC`)} className="orderbyicon material-icons" style={{backgroundColor: orderBy === `${header.field} DESC` ? "blue" : ""}} />
                </div>}
              </th>
            ))}
            <th style={{backgroundColor: "#78B2FF", padding: "0", whiteSpace: "nowrap"}}>
              <Refresh onMouseDown={refreshTable} className="material-icons iconbtnok" style={{color: "white"}} />
              {props.downloadHeaders && 
                <DownloadTable 
                  downloadHeaders={props.downloadHeaders} 
                  apiGet={props.get} 
                  getFilters={props.getFilters} 
                  getAdditionalParams={props.getAdditionalParams} 
                  filterId={props.filterId} 
                  addCustomUserId="userid" 
                />
              }
            </th>
          </tr>
          <tr>
            {props.headers.map((header, index) => (
              <td key={index}>
                {header.useFilter && header.type === "string" &&
                  <input 
                    className="form-control"
                    onKeyDown={debouncedSearchHandler}
                    onChange={(event) => searchChangeHandler(event, header.field)}
                    value={searchFilters[header.field]}
                    type="string"
                    style={{minWidth: "54px"}}
                    placeholder="🔎︎"
                  />
                }
                {header.useFilter && header.type === "option" &&
                  <input 
                    className="form-control"
                    onKeyDown={debouncedSearchHandler}
                    onChange={(event) => searchChangeHandler(event, header.field)}
                    value={searchFilters[header.optionText]}
                    type="string"
                    style={{minWidth: "54px"}}
                    placeholder="🔎︎"
                  />
                }
                {header.useFilter && header.type === "number" &&
                  <input 
                    className="form-control"
                    onKeyDown={debouncedSearchHandler}
                    onChange={(event) => searchChangeHandler(event, header.field)}
                    value={searchFilters[header.optionText]}
                    type="number"
                    style={{minWidth: "54px"}}
                    placeholder="🔎︎"
                  />
                }
                {header.useFilter && header.type === "datetime" && 
                  <div style={{display: "flex", justifyContent: "space-between"}}>
                    {<div> 
                      {!showMinDateInput[header.field] && 
                        <button className="stampbtn" onMouseDown={() => showMinDateHandler(header.field)}>
                          Min
                        </button>
                      }
                      {showMinDateInput[header.field] &&
                        <div style={{display: "flex"}}>
                          <input
                            onKeyDown={debouncedSearchHandler}
                            onChange={(event) => dateChangeHandler(event, header.field, true)}
                            value={getPrintableDate("datetime", searchFilters[header.field].minDate)}
                            type="datetime-local"
                            name="set-date"
                            required
                          />
                          <Clear 
                            className="cleardate material-icons"
                            onMouseDown={(event) => {
                              showMinDateHandler(header.field); 
                              event.stopPropagation()
                              }}
                          />
                        </div>
                      }
                    </div>}
                    {<div> 
                      {!showMaxDateInput[header.field] && 
                        <button className="stampbtn" onMouseDown={() => showMaxDateHandler(header.field)}>
                          Max
                        </button>
                      }
                      {showMaxDateInput[header.field] &&
                        <div style={{display: "flex"}}>
                          <input
                            onKeyDown={debouncedSearchHandler}
                            onChange={(event) => dateChangeHandler(event, header.field, false)}
                            value={getPrintableDate("datetime", searchFilters[header.field].maxDate)}
                            type="datetime-local"
                            name="set-date"
                            required
                          />
                          <Clear 
                            className="cleardate material-icons"
                            onMouseDown={(event) => {
                              showMaxDateHandler(header.field); 
                              event.stopPropagation()
                              }}
                          />
                        </div>
                      }
                    </div>}
                  </div>
                }
                {header.useFilter && header.type === "date" && 
                  <div style={{display: "flex", justifyContent: "space-between"}}>
                    {<div> 
                      {!showMinDateInput[header.field] && 
                        <button className="stampbtn" onMouseDown={() => showMinDateHandler(header.field)}>
                          Min
                        </button>
                      }
                      {showMinDateInput[header.field] &&
                        <div style={{display: "flex"}}>
                          <input
                            onKeyDown={debouncedSearchHandler}
                            onChange={(event) => dateChangeHandler(event, header.field, true)}
                            value={getPrintableDate("date", searchFilters[header.field].minDate)}
                            type="date"
                            name="set-date"
                            required
                          />
                          <Clear 
                            className="cleardate material-icons"
                            onMouseDown={(event) => {
                              showMinDateHandler(header.field); 
                              event.stopPropagation()
                              }}
                          />
                        </div>
                      }
                    </div>}
                    {<div> 
                      {!showMaxDateInput[header.field] && 
                        <button className="stampbtn" onMouseDown={() => showMaxDateHandler(header.field)}>
                          Max
                        </button>
                      }
                      {showMaxDateInput[header.field] &&
                        <div style={{display: "flex"}}>
                          <input
                            onKeyDown={debouncedSearchHandler}
                            onChange={(event) => dateChangeHandler(event, header.field, false)}
                            value={getPrintableDate("date", searchFilters[header.field].maxDate)}
                            type="date"
                            name="set-date"
                            required
                          />
                          <Clear 
                            className="cleardate material-icons"
                            onMouseDown={(event) => {
                              showMaxDateHandler(header.field); 
                              event.stopPropagation()
                              }}
                          />
                        </div>
                      }
                    </div>}
                  </div>
                }
              </td>
            ))}
            <td />
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr
              key={index}
              style={TR_STYLE}
            >
              {!props.edit && props.headers.map((header, headerIndex) => (
                <td
                  key={headerIndex}
                  style={{height: "28px"}}
                  onMouseDown={() => clickItemHandler(item, true)}
                >
                  {(header.type === "string" || header.type === "number") && 
                  <span style={{whiteSpace: "nowrap"}}>
                    {item[header.field]}
                  </span>}
                  {header.type === "date" && 
                  <EditDate
                    readOnly={true}
                    timestamp={item[header.field]}
                    type="date"
                    style={{position: "relative", display: "block"}}
                  />}
                  {header.type === "datetime" && 
                  <EditDate
                    readOnly={true}
                    timestamp={item[header.field]}
                    type="datetime-local"
                    style={{position: "relative", display: "block"}}
                  />}
                  {header.type === "bool" && <EditBool value={item[header.field]} readOnly={true} />}
                  {header.type === "numberWithHalfHour" && 
                    <EditNumber isHalfHour number={item[header.field]} readOnly={true} style={{position:"relative", display: "block"}} />}
                  {header.type === "option" && 
                    <span style={{whiteSpace: "nowrap"}}>
                      {item[header.field]}
                    </span>
                  }
                  {header.type === "button" &&
                    <button className="button1" style={{whiteSpace: "nowrap"}} onMouseDown={() => buttonClickHandler(item, header)}>
                      {header.name}
                    </button>
                  }
                </td>
              ))}
              {props.edit && props.headers.map((header, index) => (
                <td
                  key={index}
                  style={{height: "28px"}}
                  onMouseDown={() => clickItemHandler(item, header.readOnly)}
                >
                  {header.type === "string" && 
                    <EditString 
                      isLoading={isLoading} 
                      text={item[header.field]} 
                      onFinish={(newValue) => editHandler(item, header, newValue)} 
                      style={{position: "relative", display: "block"}} 
                      maxLength={header.maxLength}
                      readOnly={header.readOnly}
                    />
                  }
                  {header.type === "number" &&
                    <EditNumber 
                      isLoading={isLoading} 
                      number={item[header.field]}
                      onFinish={(newValue) => editHandler(item, header, newValue)}
                      style={{position: "relative", display: "block"}} 
                      min={header.min}
                      max={header.max}
                      readOnly={header.readOnly}
                    />
                  }
                  {header.type === "date" && 
                    <EditDate
                      isLoading={isLoading}
                      readOnly={header.readOnly}
                      timestamp={item[header.field]}
                      onFinish={(newValue) => editHandler(item, header, newValue)} 
                      type="date"
                      style={{position: "relative", display: "block"}}
                    />
                  }
                  {header.type === "datetime" && 
                    <EditDate
                      isLoading={isLoading}
                      readOnly={header.readOnly}
                      timestamp={item[header.field]}
                      onFinish={(newValue) => editHandler(item, header, newValue)} 
                      type="datetime-local"
                      style={{position: "relative", display: "block"}}
                    />
                  }
                  {header.type === "bool" && 
                    <EditBool 
                      isLoading={isLoading}
                      readOnly={header.readOnly}
                      value={item[header.field]} 
                      onFinish={(newValue) => editHandler(item, header, newValue)} 
                      style={{padding: "6px"}}
                    />
                  }
                  {header.type === "numberWithHalfHour" && 
                    <EditNumber 
                      isLoading={isLoading}
                      readOnly={header.readOnly}
                      number={item[header.field]} 
                      isHalfHour
                      onFinish={(newValue) => editHandler(item, header, newValue)} 
                      style={{position:"relative", display: "block"}} 
                      min={header.min}
                      max={header.max}
                    />
                  }
                  {header.type === "option" && 
                    <AutoComplete 
                      needsConfirmation={true}
                      isLoading={isLoading}
                      readOnly={header.readOnly}
                      url={header.optionUrl}
                      idField={header.optionIdField}
                      printField1={header.optionPrintField1}
                      printField2={header.optionPrintField2}
                      text={item[header.optionText]}
                      onFinish={(newValue) => editHandler(item, header, newValue)} 
                      style={{
                        display: "block",
                        whiteSpace: "nowrap",
                      }}
                    />
                  }
                  {header.type === "button" &&
                    <button className="button1" style={{whiteSpace: "nowrap"}} onMouseDown={() => buttonClickHandler(item, header)}>
                      {header.name}
                    </button>
                  }
                </td>
              ))}
              <td style={{height: "28px"}}>
                {
                  props.delete && !props.deactivate && !isLoading &&
                    <Delete style={{color: "rgb(255, 88, 88)", cursor: "pointer"}} onClick={() => deleteHandler(item)} />
                }
                {
                  !props.delete && props.deactivate && !isLoading &&
                    <Delete style={{color: "rgb(255, 111, 0)", cursor: "pointer"}} onClick={() => deactivateHandler(item)} />
                }
                <Loading isLoading={isLoading} />
              </td>
            </tr>
          ))}
          {props.add && 
            <tr style={{height: "40px"}}>
              {props.headers.map((header, index) => (
                <td key={index} style={{height: "28px"}}>
                  {!header.dontAdd && header.type === "string" && 
                    <input 
                      type="text"
                      style={{
                        height: "32px", 
                        display: "inline-block", 
                        borderWidth: "2px", 
                        borderColor: header.valid ? "#b8ff7ec5" : "#ff7e7ec5"
                      }} 
                      className="form-control me-sm-1"
                      value={newItem[header.field]}
                      onChange={(event) => newItemChangeHandler(event, header)}
                      maxLength={header.maxLength}
                    />
                  }
                  {!header.dontAdd && header.type === "number" && 
                    <input 
                      type="number"
                      style={{
                        height: "32px", 
                        display: "inline-block", 
                        borderWidth: "2px", 
                        borderColor: header.valid ? "#b8ff7ec5" : "#ff7e7ec5"
                      }} 
                      className="form-control me-sm-1"
                      value={newItem[header.field]}
                      onChange={(event) => newItemChangeHandler(event, header)}
                      min={header.min}
                      max={header.max}
                    />
                  }
                  {!header.dontAdd && header.type === "date" && 
                    <input 
                      type="date"
                      style={{
                        height: "32px", 
                        display: "inline-block", 
                        borderWidth: "2px", 
                        borderColor: header.valid ? "#b8ff7ec5" : "#ff7e7ec5"
                      }} 
                      className="form-control me-sm-1"
                      value={newItem[header.field]}
                      onChange={(event) => newItemChangeHandler(event, header)}
                    />
                  }
                  {!header.dontAdd && header.type === "datetime" && 
                    <input 
                      type="datetime-local"
                      style={{
                        height: "32px", 
                        display: "inline-block", 
                        borderWidth: "2px", 
                        borderColor: header.valid ? "#b8ff7ec5" : "#ff7e7ec5"
                      }} 
                      className="form-control me-sm-1"
                      value={newItem[header.field]}
                      onChange={(event) => newItemChangeHandler(event, header)}
                      maxLength={header.maxLength}
                    />
                  }
                  {!header.dontAdd && header.type === "numberWithHalfHour" && 
                    <div id="bloc1" style={{whiteSpace: "nowrap"}}>
                      <input 
                        type="number" 
                        min={header.min} 
                        max={header.max}
                        style={{
                          height: "32px", 
                          width: "70px",
                          whiteSpace: "nowrap",
                          display: "inline-block", 
                          borderWidth: "2px", 
                          borderColor: header.valid ? "#b8ff7ec5" : "#ff7e7ec5"
                        }} 
                        className="form-control me-sm-1" 
                        value={parseInt(newItem[header.field] / 2)}
                        onChange={(event) => newItemChangeHandler(event, header)}
                      />
                      <div className="checkboxHalfHour" id="bloc2" style={{whiteSpace: "nowrap"}}>
                        <label style={{ whiteSpace: "nowrap" }}>
                          <input
                            type="checkbox"
                            checked={newItem[header.field] % 2 === 1}
                            onChange={(event) => newItemChangeHandler(event, header)}
                            style={{ whiteSpace: "nowrap" }}
                          />
                          <span style={{ whiteSpace: "nowrap" }}>
                            {newItem[header.field] % 2 === 1 ? ":30" : "00"}
                          </span>
                        </label>
                      </div>
                    </div>
                  }
                  {!header.dontAdd && header.type === "bool" &&
                    <input 
                      type="checkbox"
                      style={{display: "inline-block", width: "25px", height: "25px"}}
                      value={newItem[header.field]}
                      checked={newItem[header.field]}
                      onChange={(event) => newItemChangeHandler(event, header)}
                    />
                  }
                  {!header.dontAdd && header.type === "option" &&
                    <AutoComplete 
                      url={header.optionUrl} 
                      idField={header.optionIdField} 
                      printField1={header.optionPrintField1} 
                      printField2={header.optionPrintField2} 
                      text={newItem[header.field].text}
                      isLoading={isLoading}
                      onFinish={(newElement) => newItemChangeHandler(newElement, header)}
                      style={{
                        display: "block",
                        whiteSpace: "nowrap"
                      }}
                    />
                  }
                </td>
              ))}
              <td style={{height: "59px"}}>
                {isNewItemValid && !isLoading &&
                  <AddBox
                    style={{color: "rgb(88, 88, 255)", cursor: "pointer"}}
                    onClick={addItemHandler}
                  />
                }
                {!isNewItemValid && !isLoading &&
                  <AddBox
                    style={{color: "grey", cursor: "not-allowed"}}
                    className="material-icons buttonitembest"
                  />
                }
                <Loading isLoading={isLoading} />
              </td>
            </tr>
          }
        </tbody>
      </table>
      <div style={{ display: "block", marginLeft: "auto", marginRight: "auto", marginTop: "20px", textAlign: "center",}}>
        {paginationOptions.numberOfItems} {paginationOptions === 1 ? "Rezultat" : "Rezultate"}
        <span style={{display: "inline-block"}}>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;	Elemente pe pagina:
          <select value={paginationOptions.itemsPerPage} onChange={changeItemsPerPageHandler} >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
          </select>
        </span>
        <br />
        <Pagination page={paginationOptions.currentPage} pageCount={paginationOptions.numberOfPages} changePage={(page) => changePageHandler(page)} />
      </div>
    </Fragment>
  );
};

export default AdvancedTable;

const initializeSearchFilters = (headers, filterId, customAddUserId, getFilters) => {
  const searchFiltersAux = {};

  headers.map((header) => {
    if (header.type === "option") {
      searchFiltersAux[header.optionText] = "";
    } else if (header.type === "datetime" || header.type === "date") {
      searchFiltersAux[header.field] = {
        "minDate": "",
        "maxDate": ""
      }
    } else {
      searchFiltersAux[header.field] = "";
    }
  });

  if (typeof filterId === "number" && typeof customAddUserId === "string") {
    searchFiltersAux[customAddUserId] = filterId;
  }

  if (typeof getFilters === "function") {
    const filters = getFilters();
    if (typeof filters !== "undefined") {
      for (let i = 0; i < filters.length - 1; i += 2) {
        searchFiltersAux[filters[i]] = filters[i + 1];
      }
    }
  }

  return searchFiltersAux;
}

const initializeMinDateFilters = (headers) => {
  const minDateFiltersAux = {};

  headers.map((header) => {
    if (header.type === "datetime" || header.type === "date") {
      minDateFiltersAux[header.field] = false;
    }
  });

  return minDateFiltersAux;
}

const initializeMaxDateFilters = (headers) => {
  const maxDateFiltersAux = {};

  headers.map((header) => {
    if (header.type === "datetime" || header.type === "date") {
      maxDateFiltersAux[header.field] = false;
    }
  });

  return maxDateFiltersAux;
}

const initializeNewItem = (headers, customAddParams) => {
  const newItemAux = {};

  headers.map((header) => {
    if (!header.dontAdd) {
      if (["string", "number", "date", "datetime", "numberWithHalfHour"].includes(header.type)) {
        newItemAux[header.field] = "";
      } else if (["numberWithHalfHour", "bool"].includes(header.type)) {
        newItemAux[header.field] = 0;
      } else if (header.type === "option") {
        newItemAux[header.field] = {
          id: -1,
          text: ""
        }
      }
    }
  });

  if (typeof customAddParams === "object") {
      Object.keys(customAddParams).forEach((key) => {
        newItemAux[key] = customAddParams[key]
      })
  }

  return newItemAux;
}
