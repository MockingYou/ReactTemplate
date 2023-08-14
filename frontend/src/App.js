import React, { useState, useEffect, Fragment } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./Pages/Login";
import Dashboard from "./Pages/Dashboard";
import LeftMenu from "./components/LeftMenu/LeftMenu";
import Menu from "./components/Menu";
import Demo from "./Pages/Demo"

import Layout from "./components/LeftMenu/Layout";

import Home from "./Pages/Home";
import Blogs from "./Pages/Blogs";
import Contact from "./Pages/Contact";
import NoPage from "./Pages/Nopage";
import AdvancedTable from "./components/AdvancedTable/AdvancedTable";
import DownloadTable from "./components/DownloadTable/DownloadTable";
import EditString from "./components/Edit/EditString";
import EditNumber from "./components/Edit/EditNumber";
import EditDate from "./components/Edit/EditDate";

function App() {

  const [collapsed, setCollapsed] = useState(false);
  const [smallWindow, setSmallWindow] = useState(false)
  const [debounce, setDebounce] = useState(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const ismobile = (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))

  const Collapse = () => {
		setCollapsed(!collapsed)
	}

	useEffect(() => {
		const checkIsMobile = () => {
			if(smallWindow!==(window.innerWidth<900)) {
				setCollapsed(ismobile||window.innerWidth<900)
			}
			setSmallWindow(window.innerWidth<900)
		}
		const handleResize = () => {
			if(debounce)clearTimeout(debounce)
			setDebounce(setTimeout(() => {checkIsMobile()}, 1000))
		}
		window.addEventListener("resize", handleResize);

		return () => {
			window.removeEventListener("resize", handleResize)
		}
	});

  //download table nu aplica filtrele todo
  return (
    <Fragment >
        <BrowserRouter>
          {isLoggedIn ? <LeftMenu collapsed={collapsed}  Collapse={Collapse} /> : <Menu collapsed={collapsed}  Collapse={Collapse} /> }
          <LeftMenu collapsed={collapsed}  Collapse={Collapse} />
          <div className= {collapsed ? "content contentextended" : "content"}>  
            <Routes>
                <Route path="/" element={ isLoggedIn ? <Navigate  to="/dashboard"/> : <Login setIsLoggedIn={setIsLoggedIn} />} />
                <Route path="/dashboard" element={<Dashboard isLoggedIn={isLoggedIn} />} />
                <Route path="/demo" element={ isLoggedIn ? <Navigate  to="/"/> : <Demo />}/>
                <Route path="*" element={<NoPage />} />
            </Routes>
          </div>
        </BrowserRouter>
      
    </Fragment>


    // <BrowserRouter>
    //   <Routes>
    //     <Route path="/" element={<Layout />}>
    //       <Route index element={<Home />} />
    //       <Route path="blogs" element={<Blogs />} />
    //       <Route path="contact" element={<Contact />} />
    //       <Route path="*" element={<NoPage />} />
    //     </Route>
    //   </Routes>
    // </BrowserRouter>
      
    );
}

export default App;
