import React, { Fragment, useState, useEffect } from 'react'

import EditNumber from "../Edit/EditNumber";

const DownloadOptionsList = (props) => {
  const [downloadOptions, setDownloadOptions] = useState(props.downloadOptions)

  useEffect(() => {
    props.changeInputHandler(downloadOptions);
  }, [downloadOptions]);

  const inputHandler = (event, key) => {
    const updatedValue = event.target.value;

    setDownloadOptions(prevDownloadOptions => ({
      ...prevDownloadOptions,
      [key]: updatedValue
    }));
  };

  return (
    <Fragment>
      Nr. maxim elemente:
      <EditNumber number={downloadOptions.maxNumber} min={1} max={300000} onFinish={(event) => inputHandler(event, "maxNumber")} />
      <br />

      Format: 
      <select value={downloadOptions.format} onChange={(event) => inputHandler(event, "format")} >
        <option value="csv">.csv</option>
        <option value="txt">.txt</option>
        <option value="xlsx">.xlsx</option>
      </select>

      &nbsp;&nbsp;Separator:
      <input type="text" value={downloadOptions.separator} onChange={(event) => inputHandler(event, "separator")} style={{width: "30px"}} />
    </Fragment> 
  )
}

export default DownloadOptionsList