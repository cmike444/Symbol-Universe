import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const root = document.getElementById("root")!;
createRoot(root).render(<App />);

const loader = document.getElementById("app-loader");
if (loader) {
  loader.style.opacity = "0";
  setTimeout(() => loader.remove(), 250);
}
