"use client";

import type { ReactNode } from "react";
import { MotionConfig, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function PortalMotionContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className={cn("portal-motion-content", className)}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
