import Footer from "@/Components/Fotter";
import Navbar from "@/Components/Navbar";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { store } from "../store/store";
import { Provider, useDispatch } from "react-redux";
import { useEffect } from "react";
import type { User } from "firebase/auth";
import { auth } from "@/firebase/firebase";
import { login, logout } from "@/Feature/Userslice";
import { getUserAvatar } from "@/utils/avatar";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
export default function App({ Component, pageProps }: AppProps) {
  function AuthListener() {
    const dispatch = useDispatch();
    useEffect(() => {
      const storedAccount = localStorage.getItem("internareaAccount");
      if (storedAccount) {
        const account = JSON.parse(storedAccount);
        account.photo = getUserAvatar(account.email || account.id);
        localStorage.setItem("internareaAccount", JSON.stringify(account));
        dispatch(login(account));
      }
      auth.onAuthStateChanged((authuser: User | null) => {
        if (authuser) {
          const identity = authuser.email || authuser.uid;
          const storedAccount = localStorage.getItem("internareaAccount");
          const account = storedAccount ? JSON.parse(storedAccount) : {};
          dispatch(
            login({
              ...account,
              uid: authuser.uid,
              photo: getUserAvatar(identity),
              name: authuser.displayName || account.name,
              email: authuser.email || account.email,
              phoneNumber: authuser.phoneNumber,
            })
          );
        } else {
          const storedAccount = localStorage.getItem("internareaAccount");
          if (!storedAccount) dispatch(logout());
        }
      });
    }, [dispatch]);
    return null;
  }

  return (
    <Provider store={store}>
      <AuthListener />
      <div className="app-shell min-h-screen">
        <ToastContainer/>
        <Navbar />
        <div key={Component.displayName || Component.name || "page"} className="app-content">
          <Component {...pageProps} />
        </div>
        <Footer />
      </div>
    </Provider>
  );
}