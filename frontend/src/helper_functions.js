const A_KEYCODE = 65;
const Z_KEYCODE = 90;
const ZERO_KEYCODE = 48;
const NINE_KEYCODE = 57;
const BACKSPACE_KEYCODE = 8;
const SPACE_KEYCODE = 32;

export const isValidCharacter = (keyCode) => {
  return (keyCode >= A_KEYCODE && keyCode <= Z_KEYCODE) ||
         (keyCode >= ZERO_KEYCODE && keyCode <= NINE_KEYCODE) || 
         keyCode === BACKSPACE_KEYCODE || keyCode === SPACE_KEYCODE;
};

export const isValidDigit = (keyCode) => {
  return (keyCode >= ZERO_KEYCODE && keyCode <= NINE_KEYCODE) || keyCode === BACKSPACE_KEYCODE;
};

export const getMonthName = (date) => {
  const MONTH_NAMES =["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];
  
  if (date instanceof Date) {
    return MONTH_NAMES[date.getMonth()];
  } else if (typeof date === "number") {
    return MONTH_NAMES[date];
  }
};

export const downloadTextFile = (text, fileName) => {
  const CSV_URL = `data:text/csv;charset=utf-8,${text}`;
  const downloadLink = document.createElement("a");

  downloadLink.setAttribute("href", encodeURI(CSV_URL));
  downloadLink.setAttribute("download", fileName);
  
  document.body.appendChild(downloadLink);

  downloadLink.click();
};

export const downloadBase64BinaryFile = (fileBytes, fileName, fileType) => {
  const BUFFER_STRING = window.atob(fileBytes);
  const bytes = new Uint8Array(BUFFER_STRING.length)

  for (let i = 0; i < BUFFER_STRING.length; i++) {
    bytes[i] = BUFFER_STRING.charCodeAt(i);
  }

  const BLOB = new Blob([bytes], {
    responseType: `application/${fileType}`
  });
  const downloadLink = document.createElement("a");
  const URL = window.URL || window.webkitURL;

  downloadLink.href = URL.createObjectURL(BLOB);
  downloadLink.download = fileName;
  downloadLink.innerHTML = "Click here to download the file";
  
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}
