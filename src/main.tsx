import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import { loadLocalEquipmentCatalog } from './lib/equipmentCatalog';

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(<p role="status">正在加载本机装备目录...</p>);
void loadLocalEquipmentCatalog().then(() => root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
));
