import React from "react";

export default function ShadcnButton({ children }: { children?: React.ReactNode }) {
  return (
    <button className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-white">
      {children ?? "Button"}
    </button>
  );
}
