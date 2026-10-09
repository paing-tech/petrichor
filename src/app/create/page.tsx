import type { Metadata } from "next";
import { CreateCardFlow } from "@/components/create/create-card-flow";

export const metadata: Metadata = {
  title: "Create a card",
};

export default function CreatePage() {
  return <CreateCardFlow />;
}
