import { Suspense } from "react";
import { GuestList } from "./GuestList";

/** The full guest list. The filter and search come from the URL, which needs
 *  a Suspense boundary around the client component that reads it. */
export default function GuestListPage() {
  return (
    <Suspense fallback={null}>
      <GuestList />
    </Suspense>
  );
}
