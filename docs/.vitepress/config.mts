import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Autorix",
  description: "Policy-based authorization for Node.js (RBAC + ABAC)",
  base: "/autorix/",
  themeConfig: {
    nav: [
      { text: "Getting Started", link: "/getting-started" },
      { text: "Express", link: "/express" }
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/chechooxd/autorix" }
    ],
    sidebar: [
      {
        text: "Introduction",
        items: [
          { text: "Home", link: "/" },
          { text: "Getting Started", link: "/getting-started" }
        ]
      },
      {
        text: "Adapters",
        items: [
          { text: "Express", link: "/express" }
        ]
      }
    ]
  }
});
