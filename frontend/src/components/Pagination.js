import React, { useEffect, useState } from "react";

const Pagination = (props) => {
  const [pagesLeft, setPagesLeft] = useState([]);
  const [pagesCenter, setPagesCenter] = useState([]);
  const [pagesRight, setPagesRight] = useState([]);
  const [spacerLeft, setSpacerLeft] = useState(true);
  const [spacerRight, setSpacerRight] = useState(true);

  useEffect(() => {
    setPagesLeft([]);
    setPagesCenter([]);
    setPagesRight([]);
    if (props.pageCount < 10) {
      setSpacerLeft(false);
      setSpacerRight(false);
      for (let pageNum = 1; pageNum <= props.pageCount; pageNum++) {
        setPagesCenter((prevPagesCenter) => [...prevPagesCenter, pageNum]);
      }
    } else {
      for (let pageNum = 1; pageNum < 4; pageNum++) {
        setPagesLeft((prevPagesLeft) => [...prevPagesLeft, pageNum]);
      }
      for (let pageNum = props.pageCount - 2; pageNum <= props.pageCount; pageNum++) {
        setPagesRight((prevPagesRight) => [...prevPagesRight, pageNum]);
      }
      for (
        let pageNum = Math.min(Math.max(props.page - 1, 4), props.pageCount - 5),
          max = pageNum + 3;
        pageNum < max;
        pageNum++
      ) {
        setPagesCenter((prevPagesCenter) => [...prevPagesCenter, pageNum]);
      }
      setSpacerLeft(props.page > 5);
      setSpacerRight(props.page < props.pageCount - 4);
    }
  }, [props.pageCount, props.page]);

  const changePageHandler = (newPage) => {
    if (newPage < 1 || newPage > props.pageCount) return;
    props.changePage(newPage);
  };

  return (
    <span
      style={{
        marginTop: "0px",
        paddingTop: "0px",
        display: "inline-block",
      }}
    >
      <div
        onClick={() => changePageHandler(props.page - 1)}
        className={
          props.page === 1 || props.pageCount < 2 ? "pgdisabled" : "pg"
        }
      >
        &lt;
      </div>
      {pagesLeft.map((page, index) => (
        <div
          key={index}
          className={page === props.page ? "pgselected" : "pg"}
          onClick={() => changePageHandler(page)}
        >
          {page}
        </div>
      ))}
      {spacerLeft && (
        <span style={{ width: "42px", height: "42px", useSelect: "none" }}>
          ...
        </span>
      )}
      {pagesCenter.map((page, index) => (
        <div
          key={index}
          className={page === props.page ? "pgselected" : "pg"}
          onClick={() => changePageHandler(page)}
        >
          {page}
        </div>
      ))}
      {spacerRight && (
        <span style={{ width: "42px", height: "42px", useSelect: "none" }}>
          ...
        </span>
      )}
      {pagesRight.map((page, index) => (
        <div
          key={index}
          className={page === props.page ? "pgselected" : "pg"}
          onClick={() => changePageHandler(page)}
        >
          {page}
        </div>
      ))}
      <div
        onClick={() => changePageHandler(props.page + 1)}
        className={
          props.page === props.pageCount || props.pageCount < 2
            ? "pgdisabled"
            : "pg"
        }
      >
        &gt;
      </div>
    </span>
  );
};

export default Pagination;
