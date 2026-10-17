"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { applyMockSettings, readMockSettings, type MockSettings } from "@/mocks/browser";

/**
 * The MOCK badge (spec §20), doubling as a menu to reach every empty and error state in mock
 * mode (spec F7 check): demo data, an empty account, and "Simulate errors".
 */
export function MockMenu() {
  const queryClient = useQueryClient();
  const [s, setS] = useState<MockSettings>(readMockSettings);

  function apply(next: MockSettings) {
    setS(next);
    applyMockSettings(next);
    void queryClient.resetQueries(); // refetch everything against the new data
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Mock mode options"
        className="fixed bottom-[calc(64px+env(safe-area-inset-bottom))] left-2 z-[80] rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-black md:bottom-2"
      >
        MOCK{s.preset === "empty" ? " · EMPTY" : ""}
        {s.failRequests ? " · ERRORS" : ""}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="z-[90] w-56">
        <DropdownMenuLabel>Mock data</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => apply({ ...s, preset: "demo" })}>
          {s.preset === "demo" ? <Check /> : <span className="size-4" />} Demo data (reset)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => apply({ ...s, preset: "empty" })}>
          {s.preset === "empty" ? <Check /> : <span className="size-4" />} Empty account
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={s.failRequests}
          onCheckedChange={(failRequests) => apply({ ...s, failRequests })}
        >
          Simulate errors
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
