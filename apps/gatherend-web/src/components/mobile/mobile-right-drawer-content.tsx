"use client";

import { ReactNode } from "react";

interface MobileRightDrawerContentProps {
  rightbar: ReactNode;
}

export function MobileRightDrawerContent({
  rightbar,
}: MobileRightDrawerContentProps) {
  return <div className="h-full bg-theme-bg-secondary">{rightbar}</div>;
}
