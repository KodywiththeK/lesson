"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
} from "react";

type PageHeaderActionsContextValue = {
  setHeaderActions: Dispatch<SetStateAction<ReactNode>>;
};

export const PageHeaderActionsContext =
  createContext<PageHeaderActionsContextValue | null>(null);

export function usePageHeaderActions(
  actions: ReactNode,
) {
  const context = useContext(PageHeaderActionsContext);

  useEffect(() => {
    if (!context) {
      return undefined;
    }

    context.setHeaderActions(actions);

    return () => {
      context.setHeaderActions(null);
    };
  }, [actions, context]);

  return Boolean(context);
}

export function PageHeaderActionFallback({
  children,
  isMounted,
}: {
  children: ReactNode;
  isMounted: boolean;
}) {
  if (isMounted) {
    return null;
  }

  return <div className="flex justify-end">{children}</div>;
}
