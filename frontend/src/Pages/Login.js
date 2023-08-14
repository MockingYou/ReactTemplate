import React, { Fragment, useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import axios from "axios";

function Login (props) {
	const [user, setUser] = useState("")
	const [pass, setPass] = useState("")
	const [error, setError] = useState("")
	const navigate = useNavigate();

	const login = () => {
		axios.get(encodeURI("login?username="+user+"&password="+pass))
		.then(function(response) {
			if(response.data.success) {
				props.setIsLoggedIn(true)
				navigate('/dashboard');
				console.log('redirect');
           } else {
			   setError(response.data.error);
		   }
        }, (response) => {
			setError(response);
			console.log(response)
        });
	}

	const inputUser = (event) => {
		setUser(event.target.value);
	  };
	const inputPass = (event) => {
		setPass(event.target.value);
	};

	useEffect(() => {
		window.addEventListener("keypress", function(event) {
			if (event.code === "Enter" || event.code === "NumpadEnter") {
				login();
			}
		});
	})

	return (
		<Fragment>
			<div className="contentextended">
				<br />
				<br />
				<br />
				<div className="form-group" style={{maxWidth: "40%",margin:"auto",textAlign: "center"}}>
					<span>{error}</span>
					<label className="col-form-label col-form-label-lg mt-4" htmlFor="inputLarge"></label>
					<input
						className="form-control form-control-lg"
						value={user}
						onChange={inputUser}
						type="text"
						placeholder="Utilizator"
						id="inputLarge"
					/>
				</div>
				<div className="form-group" style={{maxWidth: "40%",margin:"auto"}}>
					<label className="col-form-label col-form-label-lg mt-4" htmlFor="inputLarge"></label>
					<input
						className="form-control form-control-lg"
						value={pass}
						onChange={inputPass}
						type="password"
						placeholder="Parola"
						id="inputLarge"
					/>
				</div>
				<br />
				<br />
				<button onClick={() => login()} type="button" className="btn btn-primary btn-lg"  style={{marginLeft:"44%"}}>Autentificare</button>
			</div>
		</Fragment>
	);
};


export default Login;