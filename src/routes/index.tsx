import { createFileRoute } from "@tanstack/react-router";
import SonaChat from "@/components/SonaChat";

export const Route = createFileRoute("/")({
  component: SonaChat,
  head: () => ({
    meta: [
      { title: "Sona — Talk Gold" },
      { name: "description", content: "Sona is a beautiful WhatsApp-style chat experience with themes, images and rich conversations." },
      { property: "og:title", content: "Sona — Talk Gold" },
      { property: "og:description", content: "A modern chat app. Charcoal, milky and sky blue. Talk gold." },
    ],
  }),
});
