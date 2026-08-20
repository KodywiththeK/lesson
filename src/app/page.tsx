import { AppShell } from "./app-shell";

export default function Home() {
  return (
    <AppShell
      academyName="더 클래식"
      permissionContext={{
        role: "owner",
      }}
    />
  );
}
