import { Outlet, Link } from "react-router-dom";

import {SyncAlt} from "@mui/icons-material";


const Layout = () => {
  return (
    <>
      <nav>
        <ul>
          <li>
            <Link to="/" className= "menubutton">
                <div>Home</div>

                <SyncAlt/>
            </Link>
          </li>
          <li>
            <Link to="/blogs">Blogs</Link>
          </li>
          <li>
            <Link to="/contact">Contact</Link>
          </li>
        </ul>
      </nav>

      <Outlet />
    </>
  )
};

export default Layout;