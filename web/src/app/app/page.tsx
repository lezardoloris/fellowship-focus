import { Suspense } from "react";
import { FocusApp } from "@/components/FocusApp";

export const metadata = {
  title: "Fellowship Focus — App",
  description: "Block distractions, play focus soundscapes, and stay accountable with your guild.",
};

export default function AppPage() {
  return (
    <Suspense fallback={null}>
      <FocusApp />
    </Suspense>
  );
}
