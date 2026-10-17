"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/**
 * Toasts (front-end spec §18): bottom, one at a time, 5 s, dark pill in both themes.
 * On mobile they sit above the tab bar; Undo actions use the link blue.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-center"
      visibleToasts={1}
      duration={5000}
      offset={{ bottom: 24 }}
      mobileOffset={{ bottom: "calc(56px + env(safe-area-inset-bottom) + 8px)" }}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "#262626",
          "--normal-text": "#ffffff",
          "--normal-border": "transparent",
          "--border-radius": "9999px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !text-sm !px-4 !py-3",
          actionButton: "!bg-transparent !text-link !font-semibold !text-sm",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
