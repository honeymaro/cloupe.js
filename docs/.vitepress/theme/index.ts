import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import "./custom.css";

// Interactive example components
import FileUploader from "./components/FileUploader.vue";
import BasicExample from "./components/BasicExample.vue";
import ProjectionViewer from "./components/ProjectionViewer.vue";
import ExpressionViewer from "./components/ExpressionViewer.vue";
import DemoPage from "./components/DemoPage.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // Register global components
    app.component("FileUploader", FileUploader);
    app.component("BasicExample", BasicExample);
    app.component("ProjectionViewer", ProjectionViewer);
    app.component("ExpressionViewer", ExpressionViewer);
    app.component("DemoPage", DemoPage);
  },
} satisfies Theme;
