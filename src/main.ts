import { createApp } from "vue";
import App from "./App.vue";
import "./index.css";

String.prototype.insert = function (index, string) {
  if (index > 0) {
    return (
      this.substring(0, index) + string + this.substring(index, this.length)
    );
  }

  return string + this;
};

createApp(App).mount("#app");
