"use client";

import { useEffect } from "react";
import { injectContentsquareScript } from "@contentsquare/tag-sdk";

export function Contentsquare() {
  useEffect(() => {
    injectContentsquareScript({ clientId: "800100beae6f6" });
  }, []);

  return null;
}
