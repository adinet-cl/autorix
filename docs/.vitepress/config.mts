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
        text: "Packages",
        items: [
          { text: "Core", link: "/packages/core" },
          { text: "Express", link: "/packages/express" },
          { text: "NestJS", link: "/packages/nestjs" },
          { text: "Storage", link: "/packages/storage" },
          { text: "Storage MongoDB", link: "/packages/storage-mongodb" },
          { text: "Storage Postgres", link: "/packages/storage-postgres" },
          { text: "Storage Prisma", link: "/packages/storage-prisma" },
          { text: "Storage Redis", link: "/packages/storage-redis" }
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
