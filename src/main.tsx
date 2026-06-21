import React from "react";
import ReactDOM from "react-dom/client";
import PSLApp from "./PSLApp";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PSLApp initialRole={"spectator"} hideRoleSelector={true} />
  </React.StrictMode>
);
