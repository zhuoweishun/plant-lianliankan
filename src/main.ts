import "./styles.css";
import { mountApp } from "./app/App.ts";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("#app not found");
mountApp(root);
